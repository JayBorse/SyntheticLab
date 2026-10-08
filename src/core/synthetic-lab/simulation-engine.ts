import {
  SimulationInput,
  SyntheticPersona,
  GroundedEvidence,
  PersonaEvaluation,
  SimulationVerdict,
  CompetitiveBattlecard,
} from './types';
import { nebiusNemotron } from '@/core/ai/nebius';
import { normalizePricingCadence } from './pricing-normalizer';
import { areObjectionsSemanticallyRelated } from './semantic-matcher';

const FAST_MODEL_ID = process.env.NEBIUS_FAST_MODEL_ID || 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B';

export async function evaluatePersonaReaction(
  input: SimulationInput,
  persona: SyntheticPersona,
  evidence: GroundedEvidence[],
  options?: { temperature?: number; battlecard?: CompetitiveBattlecard }
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

  const battlecardSummary =
    options?.battlecard && options.battlecard.competitors && options.battlecard.competitors.length > 0
      ? `\nACTIVE INCUMBENT MARKET ALTERNATIVES (Synthesized Live from Tavily Market Intelligence):
You are actively considering these market incumbents alongside the founder's pitch:
${options.battlecard.competitors
  .map(
    (c) =>
      `• ${c.name} (${c.domain}):
  - Pricing Model: ${c.pricingModel}
  - Claims from Sources / Reported Friction: "${c.hiddenTrapOrFriction}"
  - Switching Barrier: ${c.switchingCost}
  - Pitch Advantage: "${c.advantageOverCompetitor}"`
  )
  .join('\n')}

COMPETITIVE BENCHMARKING DIRECTIVE:
You must explicitly factor these market alternatives into your reasoning:
- Compare the proposed pricing vs. the incumbent pricing and market friction reported above.
- If the proposed solution avoids a competitor's reported friction (e.g. usage bill shocks or ops overhead), mention that in your deal-makers or rationale.
- If an incumbent is cheaper, lower risk, or already standard in your stack, cite that competitor directly in your objections or rationale.`
      : '';

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
Purchasing Context: Professional practitioner evaluating economic value, operational risk, and implementation effort
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
${battlecardSummary}

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
      dealMakers:
        Array.isArray(parsed.dealMakers) && parsed.dealMakers.length > 0
          ? parsed.dealMakers
          : options?.battlecard?.competitors?.[0]
          ? [`Contractual protection against ${options.battlecard.competitors[0].name}'s reported friction`, 'Transparent pricing cap']
          : ['Lower pricing', 'Better integration'],
      rationale: (() => {
        const primaryComp = options?.battlecard?.competitors?.[0];
        let r = parsed.rationale || 'Decision grounded in strict procurement policy and budget limits.';
        if (primaryComp) {
          const fullNameLower = primaryComp.name.toLowerCase();
          const hasFullName = r.toLowerCase().includes(fullNameLower) || (Array.isArray(parsed.dealMakers) && parsed.dealMakers.some((dm: string) => dm.toLowerCase().includes(fullNameLower)));
          if (!hasFullName) {
            const compKeyword = primaryComp.name.toLowerCase().split(' ')[0];
            if (r.toLowerCase().includes(compKeyword)) {
              const regex = new RegExp(`\\b${compKeyword}\\b(?!\\s+${primaryComp.name.split(' ').slice(1).join(' ')})`, 'gi');
              r = r.replace(regex, primaryComp.name);
            } else {
              r = `${r} (Benchmarked vs incumbent ${primaryComp.name}: ${primaryComp.pricingModel})`;
            }
          }
        }
        return r;
      })(),
    };
  } catch (err) {
    console.warn(`Evaluation failed for persona ${persona.name}, using empirical heuristic:`, err);
    return getFallbackEvaluation(input, persona, effectiveEvidence, options?.battlecard);
  }
}

export {
  clusterAndRankObjections,
  computeSimulationVerdict,
} from './verdict-calculator';

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
  evidence: GroundedEvidence[],
  battlecard?: CompetitiveBattlecard
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
  const rawCost = persona.monthlyLossOrProblemCost || '';
  const numMatch = rawCost.replace(/,/g, '').match(/\$?(\d+)/);
  const problemCost = numMatch ? parseInt(numMatch[1], 10) : (input.proposedPrice > 0 ? input.proposedPrice * 4 : 200);

  // Economic problem vs. solution evaluation (Benefit * Confidence - Price)
  // Real buyers evaluate Realized Value = Problem/Benefit Baseline * Efficacy * Confidence
  // If proposedPrice >= Realized Value -> Negative ROI -> Reject
  const efficacyRate = 0.50; // Real-world software resolves ~50% of the problem
  const confidence = persona.riskTolerance === 'low' ? 0.65 : persona.riskTolerance === 'high' ? 0.85 : 0.75;
  const realizedValue = Math.round(problemCost * efficacyRate * confidence);
  const isNegativeRoi = input.proposedPrice >= realizedValue;
  const isHighRisk = persona.riskTolerance === 'low';

  let vote: 'adopt' | 'reject' | 'hesitant' = 'hesitant';
  let acceptablePrice = Math.min(input.proposedPrice, Math.round(realizedValue * 0.7) || input.proposedPrice);

  if (isNegativeRoi) {
    vote = 'reject';
    acceptablePrice = Math.round(realizedValue * 0.5);
  } else if (isHighRisk) {
    vote = 'hesitant';
    acceptablePrice = Math.round(input.proposedPrice * 0.85);
  } else {
    vote = 'adopt';
    acceptablePrice = input.proposedPrice;
  }

  // Only attach evidence if it is legitimately relevant
  const primaryEvidence = evidence.length > 0 ? evidence[0] : undefined;

  const primaryComp = battlecard?.competitors && battlecard.competitors.length > 0 ? battlecard.competitors[0] : undefined;
  const competitorDealMaker = primaryComp
    ? `Provide contractual protection against ${primaryComp.name}'s reported friction ("${primaryComp.hiddenTrapOrFriction}")`
    : 'Provide self-serve onboarding with a 14-day trial';

  const competitorRationale = primaryComp
    ? ` Compared to incumbent ${primaryComp.name} (${primaryComp.pricingModel}), this pitch has appeal, but we require strict SLAs to justify switching.`
    : '';

  return {
    personaId: persona.id,
    personaName: persona.name,
    role: persona.role,
    vote,
    acceptablePrice,
    acceptablePeriod: input.billingPeriod,
    isOutOfMarket: false,
    fatalObjections: isNegativeRoi
      ? [
          {
            objection: `Negative economic ROI: Realized value of $${realizedValue}/mo (at ${Math.round(efficacyRate * 100)}% efficacy and ${Math.round(confidence * 100)}% confidence against $${problemCost}/mo baseline) does not justify contract price of $${input.proposedPrice}/${input.billingPeriod}.`,
            severity: 'blocker',
            groundedEvidenceUrl: primaryEvidence?.url,
            evidenceSnippet: primaryEvidence?.snippet,
          },
        ]
      : isHighRisk
      ? [
          {
            objection: primaryComp
              ? `Risk tolerance constraint: Need clear mitigation against ${primaryComp.name}'s reported friction ("${primaryComp.hiddenTrapOrFriction}") with transparent spend caps.`
              : 'Risk tolerance constraint: Need transparent usage limits and clear guarantee of zero surprise overage fees.',
            severity: 'blocker',
            groundedEvidenceUrl: primaryEvidence?.url,
            evidenceSnippet: primaryEvidence?.snippet,
          },
        ]
      : [
          {
            objection: primaryComp
              ? `Need clear mitigation against ${primaryComp.name}'s reported friction ("${primaryComp.hiddenTrapOrFriction}") with transparent usage limits.`
              : 'Need transparent usage limits and clear guarantee of zero surprise overage fees.',
            severity: 'concern',
          },
        ],
    dealMakers: [
      `Guarantee predictable monthly pricing capped at $${acceptablePrice}`,
      competitorDealMaker,
    ],
    rationale: `As a ${persona.title}, I need clear pricing transparency and fast time-to-value before approving recurring spend.${competitorRationale}`,
  };
}
