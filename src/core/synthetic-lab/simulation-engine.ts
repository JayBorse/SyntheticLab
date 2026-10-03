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

ECONOMIC RATIONALITY & ROI PRINCIPLES:
1. Economic Problem vs. Solution Pricing (ROI Mindset):
   - Real customers evaluate software by comparing the solution price against what the problem actually costs them (their Current Cost of this Problem, wasted employee hours, lost revenue, chargeback penalties, or compliance fines).
   - If a product costs $50/mo or $100/mo but solves a problem that costs you $1,500/mo or 20 hours of manual work, that is an obvious 10x-30x ROI. A rational business owner does NOT reject a solution over a tiny fee when the alternative is losing thousands.
   - Do NOT act like an irrational penny-pincher who fixates on a small software charge while ignoring the massive financial bleeding it prevents.

2. Performance-Based, Success-Fee, and Contingency Pricing Models:
   - If the product uses a contingency / success fee model (e.g., "Pay only when you win", 15% of recovered disputes/revenue, commission per booking, or $0 monthly base fee + success fee):
     * You ONLY pay when the product successfully recovers or generates new cash for you that you would have otherwise 100% lost.
     * Cash flow is ALWAYS net-positive! For example, if a dispute service wins a $400 dispute and charges a 15% fee ($60), you just GAINED $340 in pure cash that was previously gone!
     * It is financially illiterate and economically absurd to reject a success fee saying "it might exceed my $60 monthly budget" when the fee comes strictly out of newly recovered profit and you have zero upfront downside.
     * For contingency/success fee products, vote "adopt" if you agree to the performance fee. In acceptablePrice, state either the maximum monthly fixed equivalent you'd pay, or 0 if you prefer the pure success-fee model.

3. Commercial Intent & Pricing Formats:
   - For standard fixed subscription / pass products: If you would only ever use a free tier and never pay anything, vote "hesitant" with acceptablePrice: 0. Vote "adopt" if you are willing to pay commercially.
   - For performance / contingency products (base fee $0 + success fee): Voting "adopt" means you are adopting the commercial service and committing to pay the success fee.
   - If the product offers multiple tiers (e.g. $19.99 for 3 months, or $49/mo agency, or one-time credit packs): evaluate the specific tier that fits your company profile.

4. Fairness, Hesitation & Rejection:
   - Vote "adopt" if the product solves your pain points, the pricing/fee structure is economically rational for your scale, and the delivery model fits your stack.
   - Vote "hesitant" if you like the value proposition but have specific ambiguities (e.g., lack of fee caps, missing integration for your stack, unclear SLAs, or unverified claims) that need concrete deal-makers.
   - Reserve "reject" for genuine blockers: wrong domain (for out-of-market personas), prohibitive fixed cost relative to value, or strict compliance violations.

5. Domain Realism:
   - Whether this product is developer tools, fintech, consumer wellness, local hospitality, legal tech, or enterprise software, behave like an authentic practitioner in that specific industry. Know your numbers, your stack, and your operational realities.

YOUR PERSONA:
Name: ${persona.name}
Role: ${persona.role} (${persona.title})
Company: ${persona.companyProfile}
Current Cost of this Problem: ${persona.monthlyLossOrProblemCost || 'Significant monthly operational friction and lost time/revenue'}
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
2. State the MAXIMUM price you would realistically pay (can be lower than, equal to, or higher than proposed price; or 0 if free-tier only / reject / contingency-only).
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

  // Detect if this is a performance-based / contingency fee product (e.g. $0 base fee + success fee)
  const pitchText = `${input.productName} ${input.tagline} ${input.description} ${input.pricingTiers || ''}`.toLowerCase();
  const isPerformanceModel =
    input.proposedPrice === 0 &&
    (pitchText.includes('success fee') ||
     pitchText.includes('pay only when') ||
     pitchText.includes('contingency') ||
     pitchText.includes('recovered') ||
     pitchText.includes('commission') ||
     pitchText.includes('rev share') ||
     pitchText.includes('revenue share') ||
     pitchText.includes('% of') ||
     pitchText.includes('per won') ||
     pitchText.includes('per recovery'));

  // Commercial conversion metrics (distinguishing paid adoption vs free tier)
  const paidAdoptCount = isPerformanceModel
    ? adoptCount
    : evaluations.filter((e) => e.vote === 'adopt' && e.acceptablePrice > 0).length;
  const freeAdoptCount = isPerformanceModel
    ? 0
    : evaluations.filter((e) => e.vote === 'adopt' && e.acceptablePrice === 0).length;
  const paidAcceptanceRate = Number((paidAdoptCount / total).toFixed(2));

  // In-market vs out-of-market segmentation
  const inMarketEvals = evaluations.filter((e) => !e.isOutOfMarket);
  const outOfMarketEvals = evaluations.filter((e) => Boolean(e.isOutOfMarket));

  const inMarketTotal = inMarketEvals.length;
  const inMarketAdoptCount = inMarketEvals.filter((e) => e.vote === 'adopt').length;
  const inMarketPaidAdoptCount = isPerformanceModel
    ? inMarketAdoptCount
    : inMarketEvals.filter((e) => e.vote === 'adopt' && e.acceptablePrice > 0).length;
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

  const priceItem = isPerformanceModel
    ? `Target empirical pricing model: Performance / Success-Fee (100% contingency, $0 upfront).`
    : `Target empirical willingness-to-pay: ${normalizedMedian.displayFull}.`;

  const suggestedActionItems = [
    priceItem,
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
    normalizedPriceDisplay: isPerformanceModel ? 'Performance Fee (Pay-on-Success, $0 Upfront)' : normalizedPrice.displayFull,
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
  let trimmed = text.trim();
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (codeBlockMatch) trimmed = codeBlockMatch[1].trim();

  const firstBrace = trimmed.indexOf('{');
  if (firstBrace === -1) return trimmed;

  const lastBrace = trimmed.lastIndexOf('}');
  if (lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.substring(firstBrace, lastBrace + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // 1. Remove trailing commas before closing braces/brackets
      const fixedCommas = candidate
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      try {
        JSON.parse(fixedCommas);
        return fixedCommas;
      } catch {
        // 2. Try closing open object
        const attempt = fixedCommas + '\n}';
        try {
          JSON.parse(attempt);
          return attempt;
        } catch {
          // fallback to trimmed
        }
      }
    }
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

  // Detect performance / contingency models
  const pitchText = `${input.productName} ${input.tagline} ${input.description} ${input.pricingTiers || ''}`.toLowerCase();
  const isPerformanceModel =
    input.proposedPrice === 0 &&
    (pitchText.includes('success fee') ||
     pitchText.includes('pay only when') ||
     pitchText.includes('contingency') ||
     pitchText.includes('recovered') ||
     pitchText.includes('commission') ||
     pitchText.includes('rev share') ||
     pitchText.includes('revenue share') ||
     pitchText.includes('% of') ||
     pitchText.includes('per won') ||
     pitchText.includes('per recovery'));

  if (isPerformanceModel) {
    const isHesitant = persona.riskTolerance === 'low';
    return {
      personaId: persona.id,
      personaName: persona.name,
      role: persona.role,
      vote: isHesitant ? 'hesitant' : 'adopt',
      acceptablePrice: isHesitant ? 0 : Math.min(persona.budgetCeiling, 49),
      acceptablePeriod: input.billingPeriod,
      isOutOfMarket: false,
      fatalObjections: isHesitant
        ? [
            {
              objection: 'Need clear monthly ceiling on success fees and fast evidence turnaround SLA.',
              severity: 'concern',
            },
          ]
        : [],
      dealMakers: [
        'Provide a predictable monthly cap on success fees so total bill never spikes unexpectedly',
        'Transparent reporting dashboard with win-rate analytics',
      ],
      rationale: `As a ${persona.title}, the pay-only-when-you-win model eliminates upfront financial risk and directly recovers revenue lost to ${persona.monthlyLossOrProblemCost || 'disputes'}.`,
    };
  }

  // In-market evaluation for standard subscription/product pricing
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
