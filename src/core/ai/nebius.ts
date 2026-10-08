import OpenAI from 'openai';
import { z } from 'zod';
import { AIProvider, ChatMessage, CompletionOptions, CompletionResult, TokenUsage } from './provider';
import { env } from '@/config/env';
import { logger } from '@/core/logger';

export interface NebiusProviderConfig {
  apiKey?: string;
  baseURL?: string;
  modelId?: string;
}

export class NebiusNemotronProvider implements AIProvider {
  public readonly providerName = 'Nebius Token Factory';
  public readonly defaultModelId: string;
  private client: OpenAI | null = null;
  private baseURL: string;

  private static cumulativeTokens = 0;

  public static recordUsage(tokens: number): void {
    if (tokens > 0) {
      NebiusNemotronProvider.cumulativeTokens += tokens;
    }
  }

  public static getCumulativeTokens(): number {
    return NebiusNemotronProvider.cumulativeTokens;
  }

  public static resetCumulativeTokens(): void {
    NebiusNemotronProvider.cumulativeTokens = 0;
  }

  constructor(config?: NebiusProviderConfig) {
    this.baseURL = config?.baseURL ?? process.env.NEBIUS_BASE_URL ?? env.NEBIUS_BASE_URL;
    this.defaultModelId = config?.modelId ?? process.env.NVIDIA_MODEL_ID ?? env.NVIDIA_MODEL_ID;

    const apiKey = config?.apiKey ?? process.env.NEBIUS_API_KEY ?? env.NEBIUS_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: this.baseURL,
      });
    }
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.NEBIUS_API_KEY ?? env.NEBIUS_API_KEY;
      if (apiKey) {
        this.client = new OpenAI({
          apiKey,
          baseURL: this.baseURL,
        });
        return this.client;
      }
      throw new Error(
        'Nebius Token Factory API key is not configured. Set NEBIUS_API_KEY in your environment to enable NVIDIA Nemotron reasoning.'
      );
    }
    return this.client;
  }

  public async chat(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    const client = this.getClient();
    const startTime = Date.now();
    const targetModel = options?.modelId ?? process.env.NVIDIA_MODEL_ID ?? this.defaultModelId;

    try {
      const formattedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => {
        if (m.role === 'system') {
          return { role: 'system', content: m.content, ...(m.name ? { name: m.name } : {}) };
        }
        if (m.role === 'assistant') {
          return { role: 'assistant', content: m.content, ...(m.name ? { name: m.name } : {}) };
        }
        if (m.role === 'tool') {
          return { role: 'tool', content: m.content, tool_call_id: m.toolCallId ?? 'call_default' };
        }
        return { role: 'user', content: m.content, ...(m.name ? { name: m.name } : {}) };
      });

      const response = await client.chat.completions.create(
        {
          model: targetModel,
          messages: formattedMessages,
          temperature: options?.temperature ?? 0.2,
          top_p: options?.topP ?? 0.95,
          max_tokens: options?.maxTokens ?? 4096,
          response_format:
            options?.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
          stop: options?.stop,
        },
        { signal: options?.abortSignal }
      );

      const choice = response.choices[0];
      const msg = choice?.message as unknown as Record<string, unknown> | undefined;
      let text = (msg?.content as string) ?? '';
      if (!text.trim() && typeof msg?.reasoning_content === 'string' && msg.reasoning_content.trim()) {
        text = msg.reasoning_content;
      }
      if (!text.trim() && typeof msg?.reasoning === 'string' && msg.reasoning.trim()) {
        text = msg.reasoning;
      }

      const usage: TokenUsage | undefined = response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined;

      if (usage?.totalTokens) {
        NebiusNemotronProvider.recordUsage(usage.totalTokens);
      } else {
        const approxPrompt = Math.ceil(messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 4);
        const approxComp = Math.ceil((text?.length || 0) / 4);
        NebiusNemotronProvider.recordUsage(approxPrompt + approxComp);
      }

      logger.debug('Nebius Nemotron completion finished', {
        durationMs: Date.now() - startTime,
        model: this.defaultModelId,
        usage,
        finishReason: choice?.finish_reason,
      });

      return {
        text,
        usage,
        finishReason: choice?.finish_reason,
      };
    } catch (error: unknown) {
      if (options?.abortSignal?.aborted) {
        const abortErr = new Error('Nemotron request aborted by controller.');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      // Handle OpenAI API error specifics
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status?: number; message?: string };
        if (apiError.status === 429) {
          logger.error('Nebius rate limit exceeded (429)', error, { model: this.defaultModelId });
          throw new Error('Nebius Token Factory rate limit exceeded. Please back off before retrying.');
        }
        if (apiError.status === 401) {
          logger.error('Nebius authentication failed (401)', error);
          throw new Error('Nebius Token Factory authentication failed. Check your NEBIUS_API_KEY.');
        }
      }

      logger.error('Nebius Nemotron chat completion failed', error, {
        model: this.defaultModelId,
      });
      throw error;
    }
  }

  public async generateStructured<T>(
    messages: ChatMessage[],
    schema: z.ZodType<T>,
    options?: CompletionOptions
  ): Promise<{ data: T; usage?: TokenUsage }> {
    const systemAugmentation: ChatMessage = {
      role: 'system',
      content:
        'You must return a valid, strictly conformant JSON object matching the requested schema. Do not include markdown code block backticks (```json or ```). Return purely valid JSON without commentary or surrounding text.',
    };

    const combinedMessages = [systemAugmentation, ...messages];

    let result = await this.chat(combinedMessages, {
      ...options,
      maxTokens: options?.maxTokens ?? 4096,
      responseFormat: 'json_object',
    });

    let cleanedText = this.extractJsonText(result.text);

    // If initial attempt yielded empty text, retry once with raw prompt fallback
    if (!cleanedText.trim()) {
      logger.warn('Initial structured response was empty, retrying with raw prompt fallback...');
      result = await this.chat(combinedMessages, {
        ...options,
        maxTokens: 4096,
      });
      cleanedText = this.extractJsonText(result.text);
    }

    try {
      const parsedRaw = JSON.parse(cleanedText);
      const validation = schema.safeParse(parsedRaw);

      if (!validation.success) {
        const errorSummary = validation.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(', ');
        logger.error('Structured output schema validation failed', validation.error, {
          rawText: result.text,
          cleanedText,
        });
        throw new Error(`AI output did not match expected schema: ${errorSummary}`);
      }

      return {
        data: validation.data,
        usage: result.usage,
      };
    } catch (err) {
      if (err instanceof SyntaxError) {
        logger.error('Failed to parse JSON from AI response', err, {
          rawText: result.text,
          cleanedText,
        });
        throw new Error(`Nemotron returned invalid JSON: ${err.message}`);
      }
      throw err;
    }
  }

  /**
   * Sanitizes potential markdown wrappers or surrounding text from LLM response
   */
  private extractJsonText(text: string): string {
    const trimmed = text.trim();

    // If wrapped in markdown code fence, strip it
    const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // If JSON is embedded in surrounding text, extract between first { and last }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return trimmed.substring(firstBrace, lastBrace + 1);
    }

    return trimmed;
  }
}

export const nebiusNemotron = new NebiusNemotronProvider();
