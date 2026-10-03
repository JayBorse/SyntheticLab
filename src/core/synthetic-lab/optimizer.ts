import {
  SimulationInput,
  SimulationVerdict,
  GroundedEvidence,
  OptimizedPitch,
} from './types';
import { nebiusNemotron } from '@/core/ai/nebius';
import { normalizePricingCadence } from './pricing-normalizer';

const ULTRA_MODEL_ID = process.env.NEBIUS_ULTRA_MODEL_ID || 'nvidia/Nemotron-3-Ultra-550b-a55b';

/**
 * Autonomous Pitch & Pricing Optimizer
 * Powered by NVIDIA Nemotron 3 Ultra on Nebius Token Factory
 *
 * Formulates realistic, high-leverage commercial fixes strictly tailored to the product's ICP.
 * Never invents enterprise compliance for indie/consumer products, never sets price to $0 unless freemium,
 * and labels every fix with an engineering/operational effort level (low | medium | high).
 */
export async function optimizeProductPitch(
  input: SimulationInput,
  verdict: SimulationVerdict,
  evidence: GroundedEvidence[]
): Promise<OptimizedPitch> {
  const isExplicitlyFreemium =
    `${input.description} ${input.tagline} ${input.pricingTiers || ''}`.toLowerCase().includes('freemium') ||
    `${input.description} ${input.tagline} ${input.pricingTiers || ''}`.toLowerCase().includes('free tier') ||
    input.proposedPrice === 0;

  // Calibrate commercial price floor: never set to $0 unless explicitly freemium
  let floorPrice = verdict.priceRange.median;
  if (floorPrice <= 0 && !isExplicitlyFreemium) {
    floorPrice = Math.max(1, Math.round(input.proposedPrice * 0.75));
  }

  const normalizedOriginal = normalizePricingCadence(input.proposedPrice, input.billingPeriod);
  const normalizedCalibrated = normalizePricingCadence(floorPrice, input.billingPeriod);

  const topFrictionSummary = verdict.topObjections
    .map(
      (o, i) =>
        `#${i + 1} [${o.severity.toUpperCase()}] "${o.objection}" (Frequency: ${o.frequency} personas; Citations: ${o.citedSources.join(', ') || 'None'})`
    )
    .join('\n');

  const evidenceSnippets =
    evidence.length > 0
      ? evidence
          .slice(0, 3)
          .map((e) => `- ${e.title} (${e.domain}): "${e.snippet}" [${e.url}]`)
          .join('\n')
      : 'None gathered for this custom niche.';

  // Check if out-of-market rejections skew the verdict
  const isAudienceMismatch =
    verdict.outOfMarketTotal > 0 &&
    verdict.outOfMarketRejectCount >= verdict.outOfMarketTotal &&
    verdict.inMarketTotal > 0;

  const audienceNotice = isAudienceMismatch
    ? `AUDIENCE MISMATCH DETECTED: ${verdict.outOfMarketRejectCount} out of ${verdict.outOfMarketTotal} out-of-market stress-test personas rejected because this product is outside their operational scope. In-market ICP adoption is ${(verdict.inMarketPaidAcceptanceRate * 100).toFixed(0)}%. DO NOT invent enterprise features (e.g. NetSuite, SOC-2 escrow, air-gapped VPC) for an indie developer or consumer product. Keep solutions focused 100% on the core ICP (${input.targetAudience}).`
    : undefined;

  const prompt = `You are a Principal Product Strategist and Monetization Architect.
An autonomous buyer committee stress-tested the following pitch and surfaced commercial objections.

PRODUCT PITCH:
Product: ${input.productName}
Tagline: ${input.tagline}
Description: ${input.description}
Proposed Price: ${normalizedOriginal.displayFull}
Target ICP: ${input.targetAudience}
Category: ${input.category}

ARENA FEEDBACK SUMMARY:
- In-Market ICP Adoption: ${(verdict.inMarketPaidAcceptanceRate * 100).toFixed(0)}% (${verdict.inMarketPaidAdoptCount} paid adopt, ${verdict.inMarketHesitantCount} hesitant, ${verdict.inMarketRejectCount} reject out of ${verdict.inMarketTotal} in-market buyers)
- Out-of-Market Stress-Test Resistance: ${verdict.outOfMarketRejectCount} of ${verdict.outOfMarketTotal} rejected
- Empirical Target Price: ${normalizedCalibrated.displayFull}
${audienceNotice ? `\nCRITICAL AUDIENCE CONSTRAINT:\n${audienceNotice}\n` : ''}

FATAL OBJECTIONS RAISED:
${topFrictionSummary}

RELEVANT MARKET EVIDENCE:
${evidenceSnippets}

RULES FOR YOUR OPTIMIZATION:
1. STRICT ICP INTEGRITY: Stay strictly within the needs of "${input.targetAudience}".
   - If this is an indie developer tool (e.g. iOS preflight, App Store tools): DO NOT add enterprise bloat like SOC-2 escrow, NetSuite/Stripe billing sync, or air-gapped CI. Address local developer concerns (e.g. 100% local analysis, zero code uploads, transparent credit packs, affordable monthly pricing).
   - If this is a consumer app: DO NOT add enterprise SSO or HRIS integrations. Address subscription fatigue, clear free trials, and easy cancellation.
   - If this is an SMB service (e.g. restaurant booking): Focus on flat fees vs per-cover commissions, POS sync, and SMS guest reminders.
2. PRICE CONSTRAINT: The calibratedPrice MUST be > 0 (e.g. $${floorPrice}) unless the pitch is explicitly freemium.
3. EFFORT LABELS: Every objection countermeasure MUST have an "effort" field set to "low", "medium", or "high".
4. HONESTY: Frame changes as clear packaging policies, transparent terms, and roadmaps.

Return ONLY a valid JSON object matching this schema:
{
  "revisedTagline": "Sharper, benefit-driven tagline addressing primary in-market friction",
  "revisedDescription": "Clear value proposition and packaging terms tailored to ${input.targetAudience}",
  "calibratedPrice": ${floorPrice},
  "calibratedPeriod": "${input.billingPeriod}",
  "packagingFix": "Specific packaging adjustment (e.g., Transparent monthly pricing of $X/mo + 14-day trial with hard caps and zero overage surcharges)",
  "objectionCountermeasures": [
    {
      "targetObjection": "The exact objection or friction",
      "countermeasure": "Realistic solution or packaging term",
      "effort": "low",
      "evidenceAddressedUrl": ""
    }
  ],
  "strategicRationale": "Why this restructuring wins in-market buyers without adding unnecessary operational bloat."
}

Return ONLY valid JSON.`;

  try {
    const response = await nebiusNemotron.chat(
      [
        {
          role: 'system',
          content: 'You output only strict, valid JSON matching the requested optimization schema. Never wrap in Markdown code blocks.',
        },
        { role: 'user', content: prompt },
      ],
      {
        modelId: ULTRA_MODEL_ID,
        responseFormat: 'json_object',
        temperature: 0.3,
        maxTokens: 3000,
      }
    );

    const jsonText = cleanJsonText(response.text);
    const parsed = JSON.parse(jsonText);

    const calibratedPrice =
      typeof parsed.calibratedPrice === 'number' && (parsed.calibratedPrice > 0 || isExplicitlyFreemium)
        ? parsed.calibratedPrice
        : floorPrice;

    return {
      originalInput: input,
      revisedTagline: parsed.revisedTagline || `Predictable ${input.tagline}`,
      revisedDescription: parsed.revisedDescription || input.description,
      calibratedPrice,
      calibratedPeriod: parsed.calibratedPeriod || input.billingPeriod,
      packagingFix: parsed.packagingFix || `Introduced predictable tier capped at $${calibratedPrice}/${input.billingPeriod}`,
      objectionCountermeasures: Array.isArray(parsed.objectionCountermeasures)
        ? parsed.objectionCountermeasures.map((c: { targetObjection?: string; countermeasure?: string; effort?: 'low' | 'medium' | 'high'; evidenceAddressedUrl?: string }) => ({
            targetObjection: c.targetObjection || 'Pricing and usage predictability',
            countermeasure: c.countermeasure || 'Transparent pricing with zero hidden overage charges.',
            effort: c.effort === 'high' ? 'high' : c.effort === 'medium' ? 'medium' : 'low',
            evidenceAddressedUrl: c.evidenceAddressedUrl || undefined,
          }))
        : [
            {
              targetObjection: verdict.topObjections[0]?.objection || 'Budget unpredictability',
              countermeasure: `Introduced transparent pricing at $${calibratedPrice}/${input.billingPeriod} with clear usage caps.`,
              effort: 'low',
            },
          ],
      strategicRationale:
        parsed.strategicRationale ||
        `Positioning calibrated to meet empirical in-market WTP ($${calibratedPrice}/${input.billingPeriod}) while eliminating surprise overage anxiety.`,
      audienceAlignmentNotice: audienceNotice,
    };
  } catch (err) {
    console.warn('Nebius Ultra optimization failed, using calibrated empirical fallback:', err);
    return getFallbackOptimizedPitch(input, verdict, evidence, floorPrice, audienceNotice);
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
  evidence: GroundedEvidence[],
  calibratedPrice: number,
  audienceNotice?: string
): OptimizedPitch {
  const topBlocker = verdict.topObjections[0]?.objection || 'Price transparency and usage caps';

  return {
    originalInput: input,
    revisedTagline: `Transparent, Self-Serve ${input.productName} for ${input.targetAudience}`,
    revisedDescription: `${input.description} Now featuring guaranteed hard usage caps, a 14-day full sandbox trial, and transparent monthly pricing at $${calibratedPrice}/${input.billingPeriod} with zero surprise fees.`,
    calibratedPrice,
    calibratedPeriod: input.billingPeriod,
    packagingFix: `Shifted to predictable pricing at $${calibratedPrice}/${input.billingPeriod} with hard caps, self-serve onboarding, and 14-day money-back guarantee.`,
    objectionCountermeasures: [
      {
        targetObjection: topBlocker,
        countermeasure: `Neutralizes "${topBlocker}" with explicit usage caps, zero surprise overages, and self-serve onboarding.`,
        effort: 'low',
        evidenceAddressedUrl: evidence[0]?.url,
      },
      {
        targetObjection: 'Clarity on billing cadence and commitment periods',
        countermeasure: 'Introduced flexible monthly billing alongside discounted multi-month options with zero lock-in.',
        effort: 'medium',
      },
    ],
    strategicRationale: `Calibrated baseline pricing to empirical willingness-to-pay ($${calibratedPrice}/${input.billingPeriod}) and eliminated variable overage fears to convert hesitant in-market buyers.`,
    audienceAlignmentNotice: audienceNotice,
  };
}
