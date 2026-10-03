import { SimulationInput, GroundedEvidence } from './types';
import { SIMULATION_PRESETS } from './presets';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

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
 * Scouts real-world market and competitor evidence.
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

  // 2. Custom input: Execute targeted live Tavily search
  if (TAVILY_API_KEY && TAVILY_API_KEY !== 'placeholder_tavily_key') {
    try {
      // Build search queries specific to the product's ICP, category, and value proposition
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
                      id: `ev_live_${i}_${idx}`,
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
          console.warn(`Tavily search query "${query}" failed:`, searchErr);
        }

        // If we found 3-5 solid live evidence pieces, stop to conserve rate limits
        if (allResults.length >= 4) break;
      }

      if (allResults.length > 0) {
        return allResults;
      }
    } catch (err) {
      console.warn('Live Tavily search failed for custom pitch:', err);
    }
  }

  // 3. If no live evidence is found for this custom niche:
  // STRICT RULE: Return an empty array. NEVER silently fall back to preset evidence (e.g. Pinecone/Vector DB)!
  return [];
}
