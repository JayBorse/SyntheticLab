import {
  SimulationInput,
  SimulationVerdict,
  GroundedEvidence,
  OptimizedPitch,
} from './types';
import { nebiusNemotron } from '@/core/ai/nebius';

const ULTRA_MODEL_ID = process.env.NEBIUS_ULTRA_MODEL_ID || 'nvidia/Nemotron-3-Ultra-550b-a55b';

/**
 * Autonomous Pitch & Pricing Optimizer
 * Powered by NVIDIA Nemotron 3 Ultra on Nebius Token Factory
 *
 * Takes empirical objections and pricing resistance from initial swarm debate,
 * and synthesizes an optimized value proposition, packaging, and risk-reversal terms.
 */
export async function optimizeProductPitch(
  input: SimulationInput,
  verdict: SimulationVerdict,
  evidence: GroundedEvidence[]
): Promise<OptimizedPitch> {
  const topFrictionSummary = verdict.topObjections
    .map(
      (o, i) =>
        `#${i + 1} [${o.severity.toUpperCase()}] "${o.objection}" (Cited by ${o.frequency} personas; Sources: ${o.citedSources.join(', ') || 'N/A'})`
    )
    .join('\n');

  const evidenceSnippets = evidence
    .slice(0, 3)
    .map((e) => `- ${e.title} (${e.domain}): "${e.snippet}" [${e.url}]`)
    .join('\n');

  const prompt = `You are a Principal Product Strategist and B2B Monetization Scientist.
An autonomous buyer committee stress-tested the following startup pitch and uncovered severe fatal objections and pricing resistance.

ORIGINAL PRODUCT PITCH:
Product: ${input.productName}
Tagline: ${input.tagline}
Description: ${input.description}
Proposed Price: $${input.proposedPrice} per ${input.billingPeriod}${input.pricingTiers ? `\nPricing Tiers & Packaging:\n${input.pricingTiers}` : ''}
Target ICP: ${input.targetAudience}

EMPIRICAL ARENA TEST RESULTS:
- Current Acceptance Rate: ${(verdict.acceptanceRate * 100).toFixed(0)}% (${verdict.adoptCount} adopt / ${verdict.rejectCount} reject / ${verdict.hesitantCount} hesitant)
- Empirical Median Willingness to Pay: $${verdict.priceRange.median} / ${verdict.priceRange.period}
- Observed Price Resistance Range: $${verdict.priceRange.min} - $${verdict.priceRange.max}

CRITICAL FATAL OBJECTIONS RAISED BY BUYERS:
${topFrictionSummary}

RELEVANT GROUNDED MARKET EVIDENCE:
${evidenceSnippets}

YOUR STRATEGIC MISSION:
Formulate an honest, actionable Founder Action Plan & Commercial Commitment Roadmap.
IMPORTANT HONESTY RULE: DO NOT claim past achievements the startup has not done yet (e.g. do NOT say "we already achieved SOC 2" or "we already built custom enterprise pipelines").
INSTEAD, frame the offer as contractual guarantees, policy commitments, and packaging roadmaps that a real founder can commit to in contract terms:
1. Revised Tagline: Sharper, outcome-oriented, directly dispelling the primary overage or lock-in fear.
2. Revised Commercial Proposal: Formulate the commercial proposal as contractual terms (e.g. hard-capped usage tiers, SLA penalties with 10x query credits, commitment to deliver SOC-2 Type II audit within 90 days backed by escrow, and a 14-day production sandbox).
3. Calibrated Price & Packaging: Calibrate baseline price to the empirical median ($${verdict.priceRange.median}/${input.billingPeriod}) with hard usage limits and zero unexpected variable fees.
4. Countermeasures: Specify the exact contractual commitment or roadmap milestone that answers each blocker.

Return ONLY a valid JSON object matching this exact schema:
{
  "revisedTagline": "Sharper outcome-oriented tagline addressing top objection",
  "revisedDescription": "Commercial proposal with contractual terms, hard caps, and roadmap commitments",
  "calibratedPrice": ${verdict.priceRange.median},
  "calibratedPeriod": "${verdict.priceRange.period}",
  "packagingFix": "Exact packaging restructuring (e.g. Free 14-day sandbox + $X base tier with hard usage caps and zero overage surcharges)",
  "objectionCountermeasures": [
    {
      "targetObjection": "The exact text or topic of the objection",
      "countermeasure": "Contractual commitment or roadmap policy that neutralizes this blocker",
      "evidenceAddressedUrl": "${evidence[0]?.url || ''}"
    }
  ],
  "strategicRationale": "Why these specific commercial terms and roadmap commitments will satisfy enterprise procurement."
}

Return ONLY valid JSON.`;

  try {
    const response = await nebiusNemotron.chat(
      [
        {
          role: 'system',
          content: 'You output only strict, valid JSON matching the requested optimization schema.',
        },
        { role: 'user', content: prompt },
      ],
      {
        modelId: ULTRA_MODEL_ID, // Use Nemotron 3 Ultra for deep strategic reasoning
        responseFormat: 'json_object',
        temperature: 0.3,
        maxTokens: 3000,
      }
    );

    const jsonText = cleanJsonText(response.text);
    const parsed = JSON.parse(jsonText);

    return {
      originalInput: input,
      revisedTagline: parsed.revisedTagline || `Guaranteed ${input.tagline}`,
      revisedDescription: parsed.revisedDescription || input.description,
      calibratedPrice: typeof parsed.calibratedPrice === 'number' ? parsed.calibratedPrice : verdict.priceRange.median,
      calibratedPeriod: parsed.calibratedPeriod === 'year' ? 'year' : input.billingPeriod,
      packagingFix: parsed.packagingFix || `Introduced predictable tier capped at $${verdict.priceRange.median}/${input.billingPeriod}`,
      objectionCountermeasures: Array.isArray(parsed.objectionCountermeasures)
        ? parsed.objectionCountermeasures.map((c: { targetObjection?: string; countermeasure?: string; evidenceAddressedUrl?: string }) => ({
            targetObjection: c.targetObjection || 'Price and integration friction',
            countermeasure: c.countermeasure || 'Transparent capped pricing with 30-day proof of concept.',
            evidenceAddressedUrl: c.evidenceAddressedUrl || evidence[0]?.url,
          }))
        : [
            {
              targetObjection: verdict.topObjections[0]?.objection || 'Budget unpredictability',
              countermeasure: `Introduced hard monthly ceiling at $${verdict.priceRange.median} to eliminate variable billing anxiety.`,
              evidenceAddressedUrl: evidence[0]?.url,
            },
          ],
      strategicRationale:
        parsed.strategicRationale ||
        `Positioning calibrated to meet empirical committee threshold of $${verdict.priceRange.median}/${input.billingPeriod} with explicit security and migration SLA.`,
    };
  } catch (err) {
    console.warn('Nebius Ultra optimization failed, using calibrated empirical fallback:', err);
    return getFallbackOptimizedPitch(input, verdict, evidence);
  }
}

function cleanJsonText(text: string): string {
  const trimmed = text.trim();
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.substring(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function getFallbackOptimizedPitch(
  input: SimulationInput,
  verdict: SimulationVerdict,
  evidence: GroundedEvidence[]
): OptimizedPitch {
  const calibratedPrice = verdict.priceRange.median > 0 ? verdict.priceRange.median : Math.round(input.proposedPrice * 0.75);
  const topBlocker = verdict.topObjections[0]?.objection || 'Variable billing and operational switching costs';

  return {
    originalInput: input,
    revisedTagline: `Predictable, SLA-Backed ${input.productName} for High-Scale Teams`,
    revisedDescription: `${input.description} Now featuring guaranteed 99.99% uptime SLAs, one-click sandbox migration, and transparent monthly cost capping at $${calibratedPrice}/${input.billingPeriod} with no surprise overages.`,
    calibratedPrice,
    calibratedPeriod: input.billingPeriod,
    packagingFix: `Shifted from variable billing to fixed monthly tier capped at $${calibratedPrice}/${input.billingPeriod} with zero-risk 30-day money-back guarantee.`,
    objectionCountermeasures: [
      {
        targetObjection: topBlocker,
        countermeasure: `Directly neutralizes "${topBlocker}" by including free assisted migration, sandbox testing environment, and guaranteed price lock.`,
        evidenceAddressedUrl: evidence[0]?.url,
      },
      {
        targetObjection: 'Security & compliance approval bottlenecks',
        countermeasure: 'Contractual commitment: 90-day SOC-2 escrow rider, zero-data-retention policy, and customer data isolation guarantees.',
        evidenceAddressedUrl: evidence[1]?.url,
      },
    ],
    strategicRationale: `By lowering the baseline price by ${Math.round(((input.proposedPrice - calibratedPrice) / (input.proposedPrice || 1)) * 100)}% to match empirical buyer WTP ($${calibratedPrice}) and eliminating variable overage risk, the pitch removes the primary enterprise procurement blocker.`,
  };
}
