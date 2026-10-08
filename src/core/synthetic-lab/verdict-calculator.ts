import {
  SimulationInput,
  PersonaEvaluation,
  SimulationVerdict,
} from './types';
import { normalizePricingCadence } from './pricing-normalizer';
import { areObjectionsSemanticallyRelated } from './semantic-matcher';

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

  // Detect if this is a performance-based / contingency fee product (e.g. success fee, rev share, contingency tier)
  const pitchText = `${input.productName} ${input.tagline} ${input.description} ${input.pricingTiers || ''}`.toLowerCase();
  const isPerformanceModel =
    pitchText.includes('success fee') ||
    pitchText.includes('success-fee') ||
    pitchText.includes('pay only when') ||
    pitchText.includes('contingency') ||
    pitchText.includes('recovered') ||
    pitchText.includes('commission') ||
    pitchText.includes('rev share') ||
    pitchText.includes('revenue share') ||
    pitchText.includes('% of') ||
    pitchText.includes('per won') ||
    pitchText.includes('per recovery');

  // Commercial conversion metrics (distinguishing paid commercial adoption vs pure zero-dollar free tier)
  const isCommercialAdopter = (e: PersonaEvaluation): boolean => {
    if (e.vote !== 'adopt') return false;
    if (e.acceptablePrice > 0) return true;
    if (isPerformanceModel) return true;
    const rationaleLower = `${e.rationale} ${e.dealMakers?.join(' ') || ''}`.toLowerCase();
    return (
      rationaleLower.includes('success fee') ||
      rationaleLower.includes('success-fee') ||
      rationaleLower.includes('contingency') ||
      rationaleLower.includes('rev share') ||
      rationaleLower.includes('revenue share') ||
      rationaleLower.includes('pay-only-when') ||
      rationaleLower.includes('pay only when') ||
      rationaleLower.includes('% of recovered')
    );
  };

  const paidAdoptCount = evaluations.filter(isCommercialAdopter).length;
  const freeAdoptCount = evaluations.filter((e) => e.vote === 'adopt' && !isCommercialAdopter(e)).length;
  const paidAcceptanceRate = Number((paidAdoptCount / total).toFixed(2));

  // In-market vs out-of-market segmentation
  const inMarketEvals = evaluations.filter((e) => !e.isOutOfMarket);
  const outOfMarketEvals = evaluations.filter((e) => Boolean(e.isOutOfMarket));

  const inMarketTotal = inMarketEvals.length;
  const inMarketAdoptCount = inMarketEvals.filter((e) => e.vote === 'adopt').length;
  const inMarketPaidAdoptCount = inMarketEvals.filter(isCommercialAdopter).length;
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
