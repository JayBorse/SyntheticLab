import { z } from 'zod';

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: Role;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface CompletionOptions {
  modelId?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
  stop?: string[];
  abortSignal?: AbortSignal;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CompletionResult {
  text: string;
  usage?: TokenUsage;
  finishReason?: string;
}

/**
 * Universal interface for LLM reasoning providers
 */
export interface AIProvider {
  readonly providerName: string;
  readonly defaultModelId: string;

  /**
   * Standard chat completion
   */
  chat(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult>;

  /**
   * Structured generation with Zod schema enforcement
   */
  generateStructured<T>(
    messages: ChatMessage[],
    schema: z.ZodType<T>,
    options?: CompletionOptions
  ): Promise<{ data: T; usage?: TokenUsage }>;
}
