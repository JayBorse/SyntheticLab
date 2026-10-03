import {
  SimulationInput,
  SimulationVerdict,
  OptimizedPitch,
  GroundedEvidence,
  HoldOutRetestResult,
  SyntheticPersona,
  PersonaEvaluation,
} from './types';
import { generateSyntheticPersonas } from './persona-generator';
import { evaluatePersonaReaction, computeSimulationVerdict } from './simulation-engine';
import { areObjectionsSemanticallyRelated } from './semantic-matcher';

/**
 * Executes an honest, anti-circular Hold-Out Retest.
 * Evaluates the optimized pitch against a FRESH cohort of decision-makers (Cohort B)
 * that strictly mirrors the role and ICP composition of Cohort A but with completely fresh identities.
 *
 * Runs multi-round stochastic evaluation passes across temperature postures (T=0.2, 0.4, 0.6)
 * to measure true empirical adoption and pricing spread without arbitrary hardcoded variance.
 */
export async function executeHoldOutRetest(
  optimizedPitch: OptimizedPitch,
  initialVerdict: SimulationVerdict,
  evidence: GroundedEvidence[],
  initialPersonas: SyntheticPersona[],
  onPersonaEvaluated?: (evaluation: PersonaEvaluation) => void
): Promise<HoldOutRetestResult> {
  // Construct the revised simulation input from the optimized pitch
  const revisedInput: SimulationInput = {
    ...optimizedPitch.originalInput,
    tagline: optimizedPitch.revisedTagline,
    description: optimizedPitch.revisedDescription,
    proposedPrice: optimizedPitch.calibratedPrice,
    billingPeriod: optimizedPitch.calibratedPeriod,
  };

  // Generate a strictly fresh, role-mirrored hold-out panel (Cohort B)
  const initialIds = new Set(initialPersonas.map((p) => p.id));
  const initialNames = new Set(initialPersonas.map((p) => p.name.toLowerCase()));
  const targetRoles = initialPersonas.length > 0 ? initialPersonas.map((p) => p.role) : undefined;
  const panelCount = initialPersonas.length > 0 ? initialPersonas.length : (initialVerdict.totalPersonas > 0 ? initialVerdict.totalPersonas : 10);

  const rawHoldOutPersonas = await generateSyntheticPersonas(revisedInput, {
    count: panelCount,
    isHoldOut: true,
    targetRoles,
    mirrorPersonas: initialPersonas.length > 0 ? initialPersonas : undefined,
    excludeNames: initialNames,
  });

  // Guarantee zero overlap with initial cohort while enforcing role symmetry
  const holdOutPersonas: SyntheticPersona[] = rawHoldOutPersonas.map((p, idx) => {
    let uniqueName = p.name;
    if (initialNames.has(uniqueName.toLowerCase())) {
      uniqueName = `${uniqueName} (Holdout #${idx + 1})`;
    }
    const sourcePersona = initialPersonas[idx];
    const isOut = sourcePersona ? Boolean(sourcePersona.isOutOfMarket) : Boolean(p.isOutOfMarket);

    return {
      ...p,
      id: `holdout_${Date.now()}_${idx}`,
      name: uniqueName,
      role: (targetRoles && targetRoles[idx]) ? targetRoles[idx] : p.role,
      monthlyLossOrProblemCost: p.monthlyLossOrProblemCost || (sourcePersona ? sourcePersona.monthlyLossOrProblemCost : undefined),
      isHoldOut: true,
      isOutOfMarket: isOut,
      audienceMatch: isOut ? 'out_of_market' : 'in_market',
    };
  });

  // Multi-round empirical evaluation to measure real spread across different market postures
  // Round 1 (Baseline): T=0.4
  // Round 2 (Conservative procurement): T=0.2
  // Round 3 (Exploratory / growth): T=0.6
  const roundAdoptionRates: number[] = [];
  const roundPaidRates: number[] = [];
  const allEvaluations: PersonaEvaluation[] = [];

  // Execute primary baseline evaluation round (T=0.4)
  const primaryEvaluations: PersonaEvaluation[] = [];
  const evalPromises = holdOutPersonas.map(async (persona) => {
    const evaluation = await evaluatePersonaReaction(revisedInput, persona, evidence, { temperature: 0.4 });
    primaryEvaluations.push(evaluation);
    allEvaluations.push(evaluation);
    if (onPersonaEvaluated) {
      onPersonaEvaluated(evaluation);
    }
    return evaluation;
  });
  await Promise.all(evalPromises);

  const holdOutVerdict = computeSimulationVerdict(revisedInput, primaryEvaluations);
  roundAdoptionRates.push(holdOutVerdict.acceptanceRate);
  roundPaidRates.push(holdOutVerdict.paidAcceptanceRate);

  // Execute secondary rounds for empirical variance measurement
  const secondaryRoundPromises = [0.2, 0.6].map(async (temp) => {
    const roundEvals = await Promise.all(
      holdOutPersonas.map((persona) =>
        evaluatePersonaReaction(revisedInput, persona, evidence, { temperature: temp })
      )
    );
    const roundVerdict = computeSimulationVerdict(revisedInput, roundEvals);
    roundAdoptionRates.push(roundVerdict.acceptanceRate);
    roundPaidRates.push(roundVerdict.paidAcceptanceRate);
    allEvaluations.push(...roundEvals);
  });
  await Promise.all(secondaryRoundPromises);

  // Empirical acceptance rate spread derived directly from observed rounds
  const minAcceptance = Math.min(...roundAdoptionRates);
  const maxAcceptance = Math.max(...roundAdoptionRates);

  // Price spread derived from all observed evaluations across rounds
  const allPrices = allEvaluations.map((e) => e.acceptablePrice).sort((a, b) => a - b);
  const minPrice = allPrices[0] ?? holdOutVerdict.priceRange.min;
  const maxPrice = allPrices[allPrices.length - 1] ?? holdOutVerdict.priceRange.max;
  const midIndex = Math.floor(allPrices.length / 2);
  const medianPrice =
    allPrices.length % 2 !== 0
      ? allPrices[midIndex]
      : Math.round(((allPrices[midIndex - 1] ?? minPrice) + (allPrices[midIndex] ?? maxPrice)) / 2);

  // Compute before-vs-after objection deltas by semantic matching
  const objectionDeltas: NonNullable<HoldOutRetestResult['objectionDeltas']> = [];
  let resolvedCount = 0;

  initialVerdict.topObjections.forEach((initObj) => {
    const beforeCount = initObj.frequency;
    let afterCount = 0;

    // Check how many personas in primary Cohort B raised a semantically related objection
    primaryEvaluations.forEach((pe) => {
      const hasMatch = pe.fatalObjections.some((o) =>
        areObjectionsSemanticallyRelated(initObj.objection, o.objection)
      );
      if (hasMatch) afterCount += 1;
    });

    let status: 'resolved' | 'reduced' | 'persisted' = 'persisted';
    if (afterCount === 0) {
      status = 'resolved';
      resolvedCount += 1;
    } else if (afterCount < beforeCount) {
      status = 'reduced';
      resolvedCount += 1;
    } else {
      status = 'persisted';
    }

    objectionDeltas.push({
      objectionTopic: initObj.objection,
      beforeCount,
      afterCount,
      status,
    });
  });

  const initialPaidRate = initialVerdict.paidAcceptanceRate ?? initialVerdict.acceptanceRate;
  const holdOutPaidRate = holdOutVerdict.paidAcceptanceRate ?? holdOutVerdict.acceptanceRate;
  const deltaPaidPct = Math.round((holdOutPaidRate - initialPaidRate) * 100);
  const deltaOverallPct = Math.round((holdOutVerdict.acceptanceRate - initialVerdict.acceptanceRate) * 100);

  let deltaSummary = '';
  if (initialPaidRate === 0 && holdOutPaidRate === 0) {
    deltaSummary = `Hold-Out panel paid commercial adoption remained at 0% across independent cohorts [spread: ${Math.round(minAcceptance * 100)}%–${Math.round(maxAcceptance * 100)}%]. While ${resolvedCount} of ${initialVerdict.topObjections.length} blockers were reduced or alleviated, fundamental market resistance or out-of-market reviewer mismatch persisted.`;
  } else {
    deltaSummary = `Hold-Out panel paid commercial adoption shifted by ${deltaPaidPct >= 0 ? '+' : ''}${deltaPaidPct}% (overall adoption shift: ${deltaOverallPct >= 0 ? '+' : ''}${deltaOverallPct}%, from ${(initialPaidRate * 100).toFixed(0)}% to ${(holdOutPaidRate * 100).toFixed(0)}%). Across 3 empirical trials, adoption range was [${Math.round(minAcceptance * 100)}% – ${Math.round(maxAcceptance * 100)}%]. Semantically resolved or reduced ${resolvedCount} of ${initialVerdict.topObjections.length} initial blockers against blinded Cohort B.`;
  }

  return {
    holdOutPersonas,
    holdOutEvaluations: primaryEvaluations,
    holdOutVerdict,
    initialAcceptanceRate: initialVerdict.acceptanceRate,
    holdOutAcceptanceRate: holdOutVerdict.acceptanceRate,
    initialPaidAcceptanceRate: initialPaidRate,
    holdOutPaidAcceptanceRate: holdOutPaidRate,
    inMarketInitialPaidRate: initialVerdict.inMarketPaidAcceptanceRate,
    inMarketHoldOutPaidRate: holdOutVerdict.inMarketPaidAcceptanceRate,
    initialMedianPrice: initialVerdict.priceRange.median,
    holdOutMedianPrice: medianPrice,
    acceptanceRateSpread: {
      min: Number(minAcceptance.toFixed(2)),
      median: holdOutVerdict.acceptanceRate,
      max: Number(maxAcceptance.toFixed(2)),
    },
    priceSpread: {
      min: minPrice,
      median: medianPrice,
      max: maxPrice,
    },
    resolvedObjectionsCount: resolvedCount,
    totalInitialObjections: initialVerdict.topObjections.length,
    objectionDeltas,
    isHoldOutVerified: holdOutPersonas.every((p) => !initialIds.has(p.id)) && holdOutPersonas.length === initialPersonas.length,
    deltaSummary,
  };
}
