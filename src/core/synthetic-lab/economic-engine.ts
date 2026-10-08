import {
  SimulationInput,
  SyntheticPersona,
  NetValueFormula,
  ValueBenefitType,
} from './types';

/**
 * Computes universal economic formula:
 * Value = Estimated Gross Benefit * Confidence
 * Net Gain = Realized Value - Price
 * Works across B2B cost-mitigation, time-saved, revenue-gained, and consumer utility delight.
 */
export function calculateEconomicFormula(
  persona: SyntheticPersona,
  input: SimulationInput,
  price: number,
  overrideProblemCost?: number
): NetValueFormula {
  const rawLoss = persona.monthlyLossOrProblemCost || '';
  const match = rawLoss.replace(/,/g, '').match(/\$?(\d+)/);
  let baselineLoss = match ? parseInt(match[1], 10) : 0;
  if (!baselineLoss && overrideProblemCost && overrideProblemCost > 0) {
    baselineLoss = overrideProblemCost;
  }

  const pitchText = `${input.productName} ${input.tagline} ${input.description} ${input.category}`.toLowerCase();
  const isConsumerOrUtility =
    (input.category as string) === 'consumer_app' ||
    pitchText.includes('game') ||
    pitchText.includes('consumer') ||
    pitchText.includes('hobby') ||
    pitchText.includes('personal') ||
    (!baselineLoss && input.proposedPrice < 30);

  let valueType: ValueBenefitType = 'cost_saved';
  let valueTypeLabel = 'Cost & Loss Mitigation';
  let baseline = baselineLoss;
  let efficacyRate = 0.50; // Real-world product resolves ~50% of the problem
  let confidence = persona.riskTolerance === 'low' ? 0.65 : persona.riskTolerance === 'high' ? 0.85 : 0.75;
  let derivation = '';

  if (isConsumerOrUtility) {
    valueType = 'utility_or_delight';
    valueTypeLabel = 'Utility & Productivity Delight';
    baseline = baselineLoss > 0 ? baselineLoss : Math.max(25, (input.proposedPrice || 15) * 2.5);
    efficacyRate = 0.70;
    confidence = persona.riskTolerance === 'low' ? 0.60 : 0.80;
    const grossBenefit = Math.round(baseline * efficacyRate);
    const realizedValue = Math.round(grossBenefit * confidence);
    const netGain = realizedValue - price;
    const roiMultiple = price > 0 ? Number((realizedValue / price).toFixed(1)) : 10.0;
    derivation = `Utility benchmark: $${baseline}/mo × ${Math.round(efficacyRate * 100)}% fit = $${grossBenefit}/mo gross × ${Math.round(confidence * 100)}% confidence = $${realizedValue}/mo realized value − $${price} price = ${netGain >= 0 ? '+' : ''}$${netGain}/mo net gain`;

    return {
      valueType,
      valueTypeLabel,
      problemCost: baseline,
      estimatedGrossBenefit: grossBenefit,
      efficacyRate,
      confidence,
      realizedValue,
      price,
      netGain,
      roiMultiple,
      derivation,
    };
  }

  // Check if time-saved model (hours * rate)
  const isTimeSaved =
    rawLoss.toLowerCase().includes('hour') ||
    rawLoss.toLowerCase().includes('time') ||
    (pitchText.includes('save') && pitchText.includes('hour'));

  if (isTimeSaved) {
    valueType = 'time_saved';
    valueTypeLabel = 'Reclaimed Engineering / Labor Hours';
    const hoursMatch = rawLoss.match(/(\d+)\s*(?:hours|hrs)/i);
    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 15;
    const hourlyRate = persona.role.includes('cfo') || persona.role.includes('director') ? 120 : 85;
    baseline = hours * hourlyRate;
    efficacyRate = 0.55;
    confidence = persona.riskTolerance === 'low' ? 0.65 : 0.75;
    const grossBenefit = Math.round(baseline * efficacyRate);
    const realizedValue = Math.round(grossBenefit * confidence);
    const netGain = realizedValue - price;
    const roiMultiple = price > 0 ? Number((realizedValue / price).toFixed(1)) : 10.0;
    derivation = `~${hours} hrs/mo @ $${hourlyRate}/hr = $${baseline}/mo wasted × ${Math.round(efficacyRate * 100)}% saved = $${grossBenefit}/mo gross × ${Math.round(confidence * 100)}% confidence = $${realizedValue}/mo realized value − $${price} price = ${netGain >= 0 ? '+' : ''}$${netGain}/mo net gain`;

    return {
      valueType,
      valueTypeLabel,
      problemCost: baseline,
      estimatedGrossBenefit: grossBenefit,
      efficacyRate,
      confidence,
      realizedValue,
      price,
      netGain,
      roiMultiple,
      derivation,
    };
  }

  // Check if revenue gained model
  const isRevenueGained = pitchText.includes('growth') || pitchText.includes('conversion') || pitchText.includes('pipeline');
  if (isRevenueGained) {
    valueType = 'revenue_gained';
    valueTypeLabel = 'Incremental Revenue Gained';
    baseline = baselineLoss > 0 ? baselineLoss : Math.max(1200, (input.proposedPrice || 100) * 8);
    efficacyRate = 0.40;
    confidence = persona.riskTolerance === 'low' ? 0.60 : 0.75;
    const grossBenefit = Math.round(baseline * efficacyRate);
    const realizedValue = Math.round(grossBenefit * confidence);
    const netGain = realizedValue - price;
    const roiMultiple = price > 0 ? Number((realizedValue / price).toFixed(1)) : 10.0;
    derivation = `Target baseline pipeline: $${baseline}/mo × ${Math.round(efficacyRate * 100)}% conversion lift = $${grossBenefit}/mo gross × ${Math.round(confidence * 100)}% confidence = $${realizedValue}/mo realized value − $${price} price = ${netGain >= 0 ? '+' : ''}$${netGain}/mo net gain`;

    return {
      valueType,
      valueTypeLabel,
      problemCost: baseline,
      estimatedGrossBenefit: grossBenefit,
      efficacyRate,
      confidence,
      realizedValue,
      price,
      netGain,
      roiMultiple,
      derivation,
    };
  }

  // Default: Cost & Loss Mitigation
  baseline = baselineLoss > 0 ? baselineLoss : Math.max(500, (input.proposedPrice || 50) * 5);
  efficacyRate = 0.50; // Real-world tools recover ~50% of lost revenue/fraud
  confidence = persona.riskTolerance === 'low' ? 0.70 : 0.85;
  const grossBenefit = Math.round(baseline * efficacyRate);
  const realizedValue = Math.round(grossBenefit * confidence);
  const netGain = realizedValue - price;
  const roiMultiple = price > 0 ? Number((realizedValue / price).toFixed(1)) : 10.0;
  derivation = `Baseline loss: $${baseline}/mo × ${Math.round(efficacyRate * 100)}% recovery = $${grossBenefit}/mo gross × ${Math.round(confidence * 100)}% confidence = $${realizedValue}/mo realized value − $${price} price = ${netGain >= 0 ? '+' : ''}$${netGain}/mo net gain`;

  return {
    valueType: 'cost_saved',
    valueTypeLabel: 'Cost & Loss Mitigation',
    problemCost: baseline,
    estimatedGrossBenefit: grossBenefit,
    efficacyRate,
    confidence,
    realizedValue,
    price,
    netGain,
    roiMultiple,
    derivation,
  };
}
