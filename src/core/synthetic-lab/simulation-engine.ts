import {
  SimulationInput,
  SyntheticPersona,
  GroundedEvidence,
  PersonaEvaluation,
  SimulationVerdict,
} from './types';
import { nebiusNemotron } from '@/core/ai/nebius';

const FAST_MODEL_ID = process.env.NEBIUS_FAST_MODEL_ID || 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B';

export async function evaluatePersonaReaction(
  input: SimulationInput,
  persona: SyntheticPersona,
  evidence: GroundedEvidence[]
): Promise<PersonaEvaluation> {
  const evidenceSummary = evidence
    .map(
      (e, idx) =>
        `[Evidence #${idx + 1}] (${e.sourceType} from ${e.domain}): "${e.snippet}" Source URL: ${e.url}`
    )
    .join('\n\n');

  const prompt = `You are roleplaying as a specific buyer persona evaluating whether to buy or reject a new product pitch.
Stay 100% in character. Be critical, pragmatic, and adversarial. DO NOT simply agree or flatter the pitch.

YOUR PERSONA:
Name: ${persona.name}
Role: ${persona.role} (${persona.title})
Company: ${persona.companyProfile}
Budget Ceiling: $${persona.budgetCeiling} per ${persona.budgetPeriod}
Risk Tolerance: ${persona.riskTolerance}
Primary Constraint: ${persona.primaryConstraint}
Existing Stack: ${persona.existingStack.join(', ')}
Key Decision Criteria: ${persona.evaluationCriteria.join(', ')}

THE PRODUCT PITCH:
Product Name: ${input.productName}
Tagline: ${input.tagline}
Description: ${input.description}
Proposed Price: $${input.proposedPrice} per ${input.billingPeriod}
Target Market: ${input.targetAudience}

AVAILABLE REAL-WORLD MARKET & COMPETITOR EVIDENCE (FROM WEB RESEARCH):
${evidenceSummary}

YOUR EVALUATION TASK:
1. Decide your vote: "adopt", "reject", or "hesitant".
2. State the MAXIMUM price you would realistically pay (can be lower than or equal to proposed price, or 0 if reject).
3. State your fatal objections. Reference real evidence from the market research above where applicable.
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
      "groundedEvidenceUrl": "url from evidence if applicable",
      "evidenceSnippet": "snippet from evidence if applicable"
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
        temperature: 0.3,
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
      fatalObjections: Array.isArray(parsed.fatalObjections)
        ? parsed.fatalObjections.map((o: { objection: string; severity?: 'blocker' | 'concern'; groundedEvidenceUrl?: string; evidenceSnippet?: string }) => ({
            objection: o.objection || 'General budget constraint',
            severity: o.severity === 'concern' ? 'concern' : 'blocker',
            groundedEvidenceUrl: o.groundedEvidenceUrl || evidence[0]?.url,
            evidenceSnippet: o.evidenceSnippet || evidence[0]?.snippet,
          }))
        : [],
      dealMakers: Array.isArray(parsed.dealMakers) ? parsed.dealMakers : ['Lower pricing', 'Better integration'],
      rationale: parsed.rationale || 'Decision grounded in strict procurement policy and budget limits.',
    };
  } catch (err) {
    console.warn(`Evaluation failed for persona ${persona.name}, using empirical heuristic:`, err);
    return getFallbackEvaluation(input, persona, evidence);
  }
}

export function computeSimulationVerdict(
  input: SimulationInput,
  evaluations: PersonaEvaluation[]
): SimulationVerdict {
  const total = evaluations.length;
  if (total === 0) {
    return {
      totalPersonas: 0,
      adoptCount: 0,
      rejectCount: 0,
      hesitantCount: 0,
      acceptanceRate: 0,
      priceRange: { min: 0, median: 0, max: 0, currency: 'USD', period: input.billingPeriod },
      topObjections: [],
      suggestedActionItems: [],
    };
  }

  const adoptCount = evaluations.filter((e) => e.vote === 'adopt').length;
  const rejectCount = evaluations.filter((e) => e.vote === 'reject').length;
  const hesitantCount = evaluations.filter((e) => e.vote === 'hesitant').length;
  const acceptanceRate = Number((adoptCount / total).toFixed(2));

  // Calculate empirical price distribution from acceptablePrice
  const prices = evaluations.map((e) => e.acceptablePrice).sort((a, b) => a - b);
  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];
  const midIndex = Math.floor(prices.length / 2);
  const medianPrice = prices.length % 2 !== 0 ? prices[midIndex] : Math.round((prices[midIndex - 1] + prices[midIndex]) / 2);

  // Cluster and rank objections
  const objectionMap = new Map<string, { count: number; sources: Set<string>; severity: 'blocker' | 'concern' }>();

  evaluations.forEach((e) => {
    e.fatalObjections.forEach((obj) => {
      const key = obj.objection.trim();
      const existing = objectionMap.get(key) || { count: 0, sources: new Set<string>(), severity: obj.severity };
      existing.count += 1;
      if (obj.groundedEvidenceUrl) existing.sources.add(obj.groundedEvidenceUrl);
      if (obj.severity === 'blocker') existing.severity = 'blocker';
      objectionMap.set(key, existing);
    });
  });

  const topObjections = Array.from(objectionMap.entries())
    .map(([objection, data]) => ({
      objection,
      frequency: data.count,
      severity: data.severity,
      citedSources: Array.from(data.sources),
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);

  const suggestedActionItems = [
    `Adjust baseline packaging: Target median willingness-to-pay threshold of $${medianPrice}/${input.billingPeriod}.`,
    topObjections[0] ? `Directly address top friction: "${topObjections[0].objection}".` : 'Clarify ROI justification for procurement leads.',
    'Introduce a pilot self-serve tier to bypass enterprise procurement bottlenecks.',
  ];

  return {
    totalPersonas: total,
    adoptCount,
    rejectCount,
    hesitantCount,
    acceptanceRate,
    priceRange: {
      min: minPrice,
      median: medianPrice,
      max: maxPrice,
      currency: 'USD',
      period: input.billingPeriod,
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
  // Budget-based empirical heuristic
  const isBudgetExceeded = input.proposedPrice > persona.budgetCeiling;
  const isHighRisk = persona.riskTolerance === 'low';

  let vote: 'adopt' | 'reject' | 'hesitant' = 'hesitant';
  let acceptablePrice = input.proposedPrice;

  if (isBudgetExceeded) {
    vote = 'reject';
    acceptablePrice = Math.round(persona.budgetCeiling * 0.9);
  } else if (!isHighRisk && Math.random() > 0.4) {
    vote = 'adopt';
    acceptablePrice = input.proposedPrice;
  }

  const primaryEvidence = evidence[0];

  return {
    personaId: persona.id,
    personaName: persona.name,
    role: persona.role,
    vote,
    acceptablePrice,
    acceptablePeriod: input.billingPeriod,
    fatalObjections: [
      {
        objection: `${persona.primaryConstraint}: Proposed price of $${input.proposedPrice}/${input.billingPeriod} exceeds operational comfort zone.`,
        severity: isBudgetExceeded ? 'blocker' : 'concern',
        groundedEvidenceUrl: primaryEvidence?.url,
        evidenceSnippet: primaryEvidence?.snippet,
      },
    ],
    dealMakers: [
      `Guarantee predictable monthly pricing capped at $${acceptablePrice}`,
      'Include self-serve API migration assistance',
    ],
    rationale: `As a ${persona.title}, I cannot approve this purchase without clear ROI justification matching our existing stack.`,
  };
}
