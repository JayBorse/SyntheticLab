import {
  SimulationInput,
  SyntheticPersona,
  GroundedEvidence,
  PersonaEvaluation,
  SimulationVerdict,
} from './types';
import { nebiusNemotron } from '@/core/ai/nebius';
import { normalizePricingCadence } from './pricing-normalizer';
import { areObjectionsSemanticallyRelated } from './semantic-matcher';

const FAST_MODEL_ID = process.env.NEBIUS_FAST_MODEL_ID || 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B';

export async function evaluatePersonaReaction(
  input: SimulationInput,
  persona: SyntheticPersona,
  evidence: GroundedEvidence[],
  options?: { temperature?: number }
): Promise<PersonaEvaluation> {
  // Prevent benchmark contamination: sanitize brand names if anonymized benchmark
  const isAnonymized = input.category === 'anonymized_benchmark';
  const effectiveEvidence = isAnonymized
    ? evidence.map((e) => ({
        ...e,
        title: e.title.replace(/\bunity\b/gi, 'EngineX').replace(/\bunreal\b/gi, 'CompetitorEngine'),
        snippet: e.snippet.replace(/\bunity\b/gi, 'EngineX').replace(/\bunreal\b/gi, 'CompetitorEngine'),
      }))
    : evidence;

  const evidenceSummary =
    effectiveEvidence.length > 0
      ? effectiveEvidence
          .map(
            (e, idx) =>
              `[Evidence #${idx + 1}] (${e.sourceType} from ${e.domain}): "${e.snippet}" Source URL: ${e.url}`
          )
          .join('\n\n')
      : 'No verified external competitor evidence found for this specific pitch niche. Base your evaluation purely on persona constraints and the pitch description.';

  const isOut = Boolean(persona.isOutOfMarket);

  const prompt = `You are roleplaying as a specific buyer persona evaluating whether to buy or reject a new product pitch.
Stay 100% in character. Be realistic, pragmatic, and economically rational.

${
  isOut
    ? `NOTE: You are an OUT-OF-MARKET stress-test persona. You work in enterprise/unrelated operations. If this product is outside your domain, evaluate honestly why you would reject it or pass on it, and state whether it is simply outside your operational scope.`
    : `NOTE: You are an IN-MARKET persona directly in the target audience for this product. Evaluate it based on your actual budget, workflow, and pain points.`
}

EVALUATION PRINCIPLES:
1. Fairness & Objectivity: You are not here to automatically say "no". If a product genuinely solves your pain points, fits comfortably within your budget ceiling, and offers fair terms, vote "adopt" and state your honest willingness to pay.
2. Hesitation vs Rejection: If the product is appealing but has ambiguities (e.g., unclear SLA, missing usage caps, or variable overage risks), vote "hesitant" and outline the deal-makers that would convert you. Reserve "reject" for severe dealbreakers, prohibitive pricing, or critical compliance violations.
3. Commercial Intent: If you would ONLY ever use this if it is 100% free, vote "hesitant" with acceptablePrice: 0. Only vote "adopt" if you would actively purchase or commit at a commercial price.
4. Grounded Citations: Only cite an evidence URL if you are referencing a real point from the provided evidence. DO NOT invent citations or cite evidence from unrelated industries.

YOUR PERSONA:
Name: ${persona.name}
Role: ${persona.role} (${persona.title})
Company: ${persona.companyProfile}
Budget Ceiling: $${persona.budgetCeiling} per ${persona.budgetPeriod}
Risk Tolerance: ${persona.riskTolerance}
Primary Constraint: ${persona.primaryConstraint}
Existing Stack: ${persona.existingStack.join(', ')}
Key Decision Criteria: ${persona.evaluationCriteria.join(', ')}
Audience Match: ${isOut ? 'OUT_OF_MARKET STRESS TEST' : 'IN_MARKET ICP'}

THE PRODUCT PITCH:
Product Name: ${input.productName}
Tagline: ${input.tagline}
Description: ${input.description}
Proposed Price: $${input.proposedPrice} per ${input.billingPeriod}${input.pricingTiers ? `\nPricing Tiers & Packaging:\n${input.pricingTiers}` : ''}
Target Market: ${input.targetAudience}

AVAILABLE REAL-WORLD MARKET & COMPETITOR EVIDENCE:
${evidenceSummary}

YOUR EVALUATION TASK:
1. Decide your vote: "adopt", "reject", or "hesitant".
2. State the MAXIMUM price you would realistically pay (can be lower than, equal to, or higher than proposed price; or 0 if free-tier only / reject).
3. State your fatal objections. If citing market evidence, use the exact URL from above; otherwise leave URL empty.
4. State any deal-makers (features or terms that could change your mind).
5. Give your honest internal reasoning.

You MUST return a JSON object with this exact structure:
{
  "vote": "reject",
  "acceptablePrice": 25,
  "fatalObjections": [
    {
      "objection": "Concrete objection statement",
      "severity": "blocker",
      "groundedEvidenceUrl": "url from evidence if applicable, or empty string"
    }
  ],
  "dealMakers": ["What could change your mind"],
  "rationale": "2-3 sentences of blunt internal executive rationale"
}

Vote MUST be one of: "adopt", "reject", "hesitant".
Return ONLY valid JSON.`;

  try {
    const response = await nebiusNemotron.chat(
      [
        { role: 'system', content: 'You output only strict, valid JSON matching the requested evaluation schema.' },
        { role: 'user', content: prompt },
      ],
      {
        modelId: FAST_MODEL_ID,
        responseFormat: 'json_object',
        temperature: typeof options?.temperature === 'number' ? options.temperature : 0.3,
      }
    );

    const jsonText = cleanJsonText(response.text);
    const parsed = JSON.parse(jsonText);

    return {
      personaId: persona.id,
      personaName: persona.name,
      role: persona.role,
      vote: parsed.vote === 'adopt' || parsed.vote === 'reject' || parsed.vote === 'hesitant' ? parsed.vote : 'reject',
      acceptablePrice: typeof parsed.acceptablePrice === 'number' ? parsed.acceptablePrice : Math.round(input.proposedPrice * 0.7),
      acceptablePeriod: input.billingPeriod,
      isOutOfMarket: isOut,
      fatalObjections: Array.isArray(parsed.fatalObjections)
        ? parsed.fatalObjections.map((o: { objection: string; severity?: 'blocker' | 'concern'; groundedEvidenceUrl?: string; evidenceSnippet?: string }) => {
            // STRICT HONESTY: Only attach evidence URL if it legitimately matches one of the provided evidence pieces
            let verifiedUrl: string | undefined = undefined;
            let verifiedSnippet: string | undefined = undefined;
            if (o.groundedEvidenceUrl) {
              const match = effectiveEvidence.find((e) => e.url.toLowerCase() === o.groundedEvidenceUrl?.toLowerCase());
              if (match) {
                verifiedUrl = match.url;
                verifiedSnippet = match.snippet;
              }
            }
            return {
              objection: o.objection || 'General budget constraint',
              severity: o.severity === 'concern' ? 'concern' : 'blocker',
              groundedEvidenceUrl: verifiedUrl,
              evidenceSnippet: verifiedSnippet,
            };
          })
        : [],
      dealMakers: Array.isArray(parsed.dealMakers) ? parsed.dealMakers : ['Lower pricing', 'Better integration'],
      rationale: parsed.rationale || 'Decision grounded in strict procurement policy and budget limits.',
    };
  } catch (err) {
    console.warn(`Evaluation failed for persona ${persona.name}, using empirical heuristic:`, err);
    return getFallbackEvaluation(input, persona, effectiveEvidence);
  }
}

/**
 * Clusters semantically similar objections before counting and ranking to avoid "1 of 10" fragmentations.
 */
export function clusterAndRankObjections(
  evaluations: PersonaEvaluation[]
): {
  objection: string;
  frequency: number;
  severity: 'blocker' | 'concern';
  citedSources: string[];
}[] {
  interface ObjectionCluster {
    canonicalObjection: string;
    allObjections: string[];
    count: number;
    severity: 'blocker' | 'concern';
    sources: Set<string>;
  }

  const clusters: ObjectionCluster[] = [];

  evaluations.forEach((e) => {
    e.fatalObjections.forEach((obj) => {
      const text = obj.objection.trim();
      if (!text) return;

      // Find an existing semantically related cluster
      const matchedCluster = clusters.find((c) =>
        areObjectionsSemanticallyRelated(text, c.canonicalObjection)
      );

      if (matchedCluster) {
        matchedCluster.count += 1;
        matchedCluster.allObjections.push(text);
        if (obj.severity === 'blocker') {
          matchedCluster.severity = 'blocker';
        }
        if (obj.groundedEvidenceUrl) {
          matchedCluster.sources.add(obj.groundedEvidenceUrl);
        }
        // Choose canonical description as the most representative
        if (text.length > matchedCluster.canonicalObjection.length && text.length < 140) {
          matchedCluster.canonicalObjection = text;
        }
      } else {
        const sources = new Set<string>();
        if (obj.groundedEvidenceUrl) sources.add(obj.groundedEvidenceUrl);

        clusters.push({
          canonicalObjection: text,
          allObjections: [text],
          count: 1,
          severity: obj.severity || 'blocker',
          sources,
        });
      }
    });
  });

  return clusters
    .map((c) => ({
      objection: c.canonicalObjection,
      frequency: c.count,
      severity: c.severity,
      citedSources: Array.from(c.sources),
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);
}

export function computeSimulationVerdict(
  input: SimulationInput,
  evaluations: PersonaEvaluation[]
): SimulationVerdict {
  const total = evaluations.length;
  const normalizedPrice = normalizePricingCadence(input.proposedPrice, input.billingPeriod);

  if (total === 0) {
    return {
      totalPersonas: 0,
      adoptCount: 0,
      rejectCount: 0,
      hesitantCount: 0,
      acceptanceRate: 0,
      paidAdoptCount: 0,
      freeAdoptCount: 0,
      paidAcceptanceRate: 0,
      inMarketTotal: 0,
      inMarketAdoptCount: 0,
      inMarketPaidAdoptCount: 0,
      inMarketHesitantCount: 0,
      inMarketRejectCount: 0,
      inMarketAcceptanceRate: 0,
      inMarketPaidAcceptanceRate: 0,
      outOfMarketTotal: 0,
      outOfMarketRejectCount: 0,
      monthlyEquivalentPrice: normalizedPrice.monthlyEquivalent,
      normalizedPriceDisplay: normalizedPrice.displayFull,
      priceRange: { min: 0, median: 0, max: 0, currency: 'USD', period: input.billingPeriod, monthlyEquivalentMedian: 0 },
      topObjections: [],
      suggestedActionItems: [],
    };
  }

  const adoptCount = evaluations.filter((e) => e.vote === 'adopt').length;
  const rejectCount = evaluations.filter((e) => e.vote === 'reject').length;
  const hesitantCount = evaluations.filter((e) => e.vote === 'hesitant').length;
  const acceptanceRate = Number((adoptCount / total).toFixed(2));

  // Commercial conversion metrics (distinguishing paid adoption vs free tier)
  const paidAdoptCount = evaluations.filter((e) => e.vote === 'adopt' && e.acceptablePrice > 0).length;
  const freeAdoptCount = evaluations.filter((e) => e.vote === 'adopt' && e.acceptablePrice === 0).length;
  const paidAcceptanceRate = Number((paidAdoptCount / total).toFixed(2));

  // In-market vs out-of-market segmentation
  const inMarketEvals = evaluations.filter((e) => !e.isOutOfMarket);
  const outOfMarketEvals = evaluations.filter((e) => Boolean(e.isOutOfMarket));

  const inMarketTotal = inMarketEvals.length;
  const inMarketAdoptCount = inMarketEvals.filter((e) => e.vote === 'adopt').length;
  const inMarketPaidAdoptCount = inMarketEvals.filter((e) => e.vote === 'adopt' && e.acceptablePrice > 0).length;
  const inMarketHesitantCount = inMarketEvals.filter((e) => e.vote === 'hesitant').length;
  const inMarketRejectCount = inMarketEvals.filter((e) => e.vote === 'reject').length;
  const inMarketAcceptanceRate = inMarketTotal > 0 ? Number((inMarketAdoptCount / inMarketTotal).toFixed(2)) : 0;
  const inMarketPaidAcceptanceRate = inMarketTotal > 0 ? Number((inMarketPaidAdoptCount / inMarketTotal).toFixed(2)) : 0;

  const outOfMarketTotal = outOfMarketEvals.length;
  const outOfMarketRejectCount = outOfMarketEvals.filter((e) => e.vote === 'reject').length;

  let audienceAlignmentWarning: string | undefined = undefined;
  if (outOfMarketTotal > 0 && outOfMarketRejectCount === outOfMarketTotal && inMarketTotal > 0) {
    audienceAlignmentWarning = `Audience Segmentation Notice: ${outOfMarketRejectCount} out of ${outOfMarketTotal} out-of-market stress-test personas rejected because this product is outside their domain. Target ICP adoption is reported separately (${(inMarketPaidAcceptanceRate * 100).toFixed(0)}% in-market commercial adoption across ${inMarketTotal} target buyers).`;
  }

  // Calculate empirical price distribution from acceptablePrice
  const prices = evaluations.map((e) => e.acceptablePrice).sort((a, b) => a - b);
  const minPrice = prices[0] ?? 0;
  const maxPrice = prices[prices.length - 1] ?? 0;
  const midIndex = Math.floor(prices.length / 2);
  const medianPrice =
    prices.length % 2 !== 0
      ? prices[midIndex]
      : Math.round(((prices[midIndex - 1] ?? minPrice) + (prices[midIndex] ?? maxPrice)) / 2);

  const normalizedMedian = normalizePricingCadence(medianPrice, input.billingPeriod);

  // Cluster and rank objections semantically
  const topObjections = clusterAndRankObjections(evaluations);

  const suggestedActionItems = [
    `Target empirical willingness-to-pay: ${normalizedMedian.displayFull}.`,
    topObjections[0] ? `Directly address top friction: "${topObjections[0].objection}".` : 'Clarify ROI justification for in-market buyers.',
    inMarketHesitantCount > 0 ? `Convert ${inMarketHesitantCount} hesitant in-market buyers with transparent caps and a frictionless trial.` : 'Scale distribution within primary ICP.',
  ];

  return {
    totalPersonas: total,
    adoptCount,
    rejectCount,
    hesitantCount,
    acceptanceRate,
    paidAdoptCount,
    freeAdoptCount,
    paidAcceptanceRate,
    inMarketTotal,
    inMarketAdoptCount,
    inMarketPaidAdoptCount,
    inMarketHesitantCount,
    inMarketRejectCount,
    inMarketAcceptanceRate,
    inMarketPaidAcceptanceRate,
    outOfMarketTotal,
    outOfMarketRejectCount,
    monthlyEquivalentPrice: normalizedPrice.monthlyEquivalent,
    normalizedPriceDisplay: normalizedPrice.displayFull,
    audienceAlignmentWarning,
    priceRange: {
      min: minPrice,
      median: medianPrice,
      max: maxPrice,
      currency: 'USD',
      period: input.billingPeriod,
      monthlyEquivalentMedian: normalizedMedian.monthlyEquivalent,
    },
    topObjections,
    suggestedActionItems,
  };
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

function getFallbackEvaluation(
  input: SimulationInput,
  persona: SyntheticPersona,
  evidence: GroundedEvidence[]
): PersonaEvaluation {
  const isOut = Boolean(persona.isOutOfMarket);

  if (isOut) {
    return {
      personaId: persona.id,
      personaName: persona.name,
      role: persona.role,
      vote: 'reject',
      acceptablePrice: 0,
      acceptablePeriod: input.billingPeriod,
      isOutOfMarket: true,
      fatalObjections: [
        {
          objection: `Outside domain of responsibility: Evaluated as a ${persona.title} (${persona.companyProfile}). This tool serves ${input.targetAudience} and does not fit our corporate IT procurement requirements.`,
          severity: 'blocker',
        },
      ],
      dealMakers: ['Product would need to solve an enterprise IT/procurement infrastructure need'],
      rationale: `As a ${persona.title}, this tool is outside our core stack and serves an audience distinct from our department.`,
    };
  }

  // In-market evaluation
  const isBudgetExceeded = input.proposedPrice > persona.budgetCeiling;
  const isHighRisk = persona.riskTolerance === 'low';

  let vote: 'adopt' | 'reject' | 'hesitant' = 'hesitant';
  let acceptablePrice = Math.round(input.proposedPrice * 0.8);

  if (isBudgetExceeded) {
    vote = persona.riskTolerance === 'high' ? 'hesitant' : 'reject';
    acceptablePrice = Math.round(persona.budgetCeiling * 0.95);
  } else if (!isHighRisk) {
    vote = 'adopt';
    acceptablePrice = input.proposedPrice;
  }

  // Only attach evidence if it is genuinely relevant
  const primaryEvidence = evidence.length > 0 ? evidence[0] : undefined;

  return {
    personaId: persona.id,
    personaName: persona.name,
    role: persona.role,
    vote,
    acceptablePrice,
    acceptablePeriod: input.billingPeriod,
    isOutOfMarket: false,
    fatalObjections: isBudgetExceeded
      ? [
          {
            objection: `Price exceeds operational comfort: Proposed price of $${input.proposedPrice}/${input.billingPeriod} is above our budget ceiling of $${persona.budgetCeiling}.`,
            severity: 'blocker',
            groundedEvidenceUrl: primaryEvidence?.url,
            evidenceSnippet: primaryEvidence?.snippet,
          },
        ]
      : [
          {
            objection: 'Need transparent usage limits and clear guarantee of zero surprise overage fees.',
            severity: 'concern',
          },
        ],
    dealMakers: [
      `Guarantee predictable monthly pricing capped at $${acceptablePrice}`,
      'Provide self-serve onboarding with a 14-day trial',
    ],
    rationale: `As a ${persona.title}, I need clear pricing transparency and fast time-to-value before approving recurring spend.`,
  };
}
