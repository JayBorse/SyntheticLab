import { SimulationInput, GroundedEvidence } from './types';
import { SIMULATION_PRESETS } from './presets';
import { tavily, TavilyClient } from '@tavily/core';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

let tavilyClientInstance: TavilyClient | null = null;
function getTavilyClient(): TavilyClient | null {
  if (!tavilyClientInstance && TAVILY_API_KEY && TAVILY_API_KEY !== 'placeholder_tavily_key') {
    try {
      tavilyClientInstance = tavily({ apiKey: TAVILY_API_KEY });
    } catch (e) {
      console.warn('[market-scout] Failed to initialize Tavily client:', e);
    }
  }
  return tavilyClientInstance;
}

/**
 * Derives the source type strictly from the actual domain and content.
 * Fixes bug where Reddit threads were mislabeled as G2_REVIEW.
 */
export function deriveSourceType(domain: string, title: string, content: string): GroundedEvidence['sourceType'] {
  const d = domain.toLowerCase();
  const text = (title + ' ' + content).toLowerCase();

  if (d.includes('reddit.com')) {
    return 'reddit_complaint';
  }
  if (
    d.includes('g2.com') ||
    d.includes('trustradius.com') ||
    d.includes('capterra.com') ||
    d.includes('producthunt.com')
  ) {
    return 'g2_review';
  }
  if (
    d.includes('pricing') ||
    text.includes('pricing') ||
    text.includes('per month') ||
    text.includes('billing') ||
    text.includes('overage') ||
    text.includes('$') ||
    text.includes('tier')
  ) {
    return 'competitor_pricing';
  }
  return 'market_report';
}

/**
 * Scouts real-world market and competitor evidence using Tavily Advanced Search.
 * STRICT HONESTY RULE: Never leak preset evidence into custom inputs.
 */
export async function scoutMarketEvidence(input: SimulationInput): Promise<GroundedEvidence[]> {
  // 1. Check if an official built-in preset is selected by exact productName
  const matchedPreset = SIMULATION_PRESETS.find(
    (p) => p.input.productName.toLowerCase().trim() === input.productName.toLowerCase().trim()
  );

  // Only return preset cached evidence if it is an exact match for that specific preset product
  if (matchedPreset && matchedPreset.cachedEvidence && matchedPreset.cachedEvidence.length > 0) {
    return matchedPreset.cachedEvidence;
  }

  // 2. Custom input: Execute targeted live Tavily search with advanced depth & answer synthesis
  const client = getTavilyClient();
  if (client) {
    try {
      const categoryLabel = input.category.replace(/_/g, ' ');

      // Multi-vector research strategy:
      // Query 1: Competitor pricing, overage fees & tier structure (with advanced answer synthesis)
      // Query 2: Authentic practitioner complaints on Reddit, Hacker News & review platforms
      const searchTasks = [
        client.search(`${input.productName} alternatives ${categoryLabel} pricing plans tiers overage fees`, {
          searchDepth: 'advanced',
          includeAnswer: 'advanced',
          maxResults: 4,
        }),
        client.search(`"${input.targetAudience}" tools software frustrations complaints limitations migrated away`, {
          searchDepth: 'advanced',
          includeDomains: ['reddit.com', 'news.ycombinator.com', 'g2.com', 'trustradius.com', 'capterra.com'],
          includeDomainsMode: 'prefer',
          maxResults: 4,
        }),
        client.search(`best "${input.targetAudience}" software reviews pros cons 2026`, {
          searchDepth: 'advanced',
          maxResults: 3,
        }),
      ];

      const responses = await Promise.allSettled(searchTasks);
      const allResults: GroundedEvidence[] = [];
      const seenUrls = new Set<string>();

      // Extract market consensus answer if synthesized
      let marketConsensusAnswer: string | undefined = undefined;
      for (const r of responses) {
        if (r.status === 'fulfilled' && r.value.answer && !marketConsensusAnswer) {
          marketConsensusAnswer = r.value.answer;
        }
      }

      responses.forEach((res, taskIdx) => {
        if (res.status === 'fulfilled' && Array.isArray(res.value.results)) {
          res.value.results.forEach((item, itemIdx) => {
            try {
              const urlObj = new URL(item.url);
              const domain = urlObj.hostname.replace(/^www\./, '');
              const normalizedUrl = item.url.split('?')[0].toLowerCase();

              if (!seenUrls.has(normalizedUrl)) {
                seenUrls.add(normalizedUrl);
                allResults.push({
                  id: `ev_live_${taskIdx}_${itemIdx}`,
                  sourceType: deriveSourceType(domain, item.title, item.content),
                  title: item.title,
                  snippet: item.content.substring(0, 320) + '...',
                  url: item.url,
                  domain,
                  relevanceToPitch: `Live web evidence discovered for ${input.targetAudience}`,
                  score: item.score,
                  rawContent: item.rawContent || undefined,
                  tavilyAnswer: marketConsensusAnswer,
                });
              }
            } catch {
              // ignore invalid urls
            }
          });
        }
      });

      if (allResults.length > 0) {
        return allResults;
      }
    } catch (err) {
      console.warn('[market-scout] Live Tavily advanced search error, attempting direct fetch fallback:', err);
    }
  }

  // 3. Direct fetch fallback if SDK call failed or key absent
  if (TAVILY_API_KEY && TAVILY_API_KEY !== 'placeholder_tavily_key') {
    try {
      const searchQueries = [
        `"${input.targetAudience}" tools software pricing complaints reviews`,
        `site:reddit.com "${input.targetAudience}" frustrations software`,
        `${input.productName} alternatives ${input.category.replace('_', ' ')} pricing`,
      ];

      const allResults: GroundedEvidence[] = [];
      const seenUrls = new Set<string>();

      for (let i = 0; i < searchQueries.length; i++) {
        const query = searchQueries[i];
        try {
          const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: TAVILY_API_KEY,
              query,
              search_depth: 'basic',
              max_results: 3,
              include_answer: false,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.results)) {
              data.results.forEach((item: { title: string; url: string; content: string }, idx: number) => {
                try {
                  const urlObj = new URL(item.url);
                  const domain = urlObj.hostname.replace(/^www\./, '');
                  if (!seenUrls.has(item.url)) {
                    seenUrls.add(item.url);
                    allResults.push({
                      id: `ev_live_fb_${i}_${idx}`,
                      sourceType: deriveSourceType(domain, item.title, item.content),
                      title: item.title,
                      snippet: item.content.substring(0, 240) + '...',
                      url: item.url,
                      domain,
                      relevanceToPitch: `Live web evidence discovered for ${input.targetAudience}`,
                    });
                  }
                } catch {
                  // ignore invalid urls
                }
              });
            }
          }
        } catch (searchErr) {
          console.warn(`Tavily fallback search query "${query}" failed:`, searchErr);
        }

        if (allResults.length >= 4) break;
      }

      if (allResults.length > 0) {
        return allResults;
      }
    } catch (err) {
      console.warn('Live Tavily search failed for custom pitch:', err);
    }
  }

  // 4. If no live evidence is found for this custom niche:
  // STRICT RULE: Return an empty array. NEVER silently fall back to preset evidence (e.g. Pinecone/Vector DB)!
  return [];
}

/**
 * Retrieves grounded market evidence along with Tavily's synthesized market consensus brief.
 */
export async function scoutMarketBrief(
  input: SimulationInput
): Promise<{ evidence: GroundedEvidence[]; marketConsensus?: string }> {
  const evidence = await scoutMarketEvidence(input);
  const marketConsensus = evidence.find((e) => e.tavilyAnswer)?.tavilyAnswer;
  return { evidence, marketConsensus };
}
