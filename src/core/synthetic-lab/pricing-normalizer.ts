/**
 * Pricing Normalizer for SyntheticLab
 *
 * Accurately parses pricing cadences (monthly, quarterly, annual, credit packs)
 * and normalizes them to monthly-equivalent comparisons to avoid broken strings like "$19.99/3".
 */

export interface NormalizedPrice {
  originalPrice: number;
  originalPeriod: string;
  monthlyEquivalent: number;
  billingPeriodLabel: string;
  isPackOrCredit: boolean;
  displayFull: string;       // e.g. "$19.99 / 3 months ($6.66/mo equivalent)"
  displayShort: string;      // e.g. "$6.66/mo"
  displayOriginal: string;   // e.g. "$19.99 / 3 months"
}

export function normalizePricingCadence(
  price: number,
  periodInput: string | undefined | null
): NormalizedPrice {
  const rawPeriod = (periodInput || 'month').trim();
  const lower = rawPeriod.toLowerCase();

  // If price is 0 (free tier)
  if (price === 0) {
    return {
      originalPrice: 0,
      originalPeriod: rawPeriod,
      monthlyEquivalent: 0,
      billingPeriodLabel: 'free',
      isPackOrCredit: false,
      displayFull: '$0 (Free)',
      displayShort: '$0/mo',
      displayOriginal: '$0',
    };
  }

  // 1. Credit packs / pay-as-you-go (non-recurring)
  if (
    lower.includes('scan') ||
    lower.includes('credit') ||
    lower.includes('pack') ||
    lower === 'one_time' ||
    lower.includes('one-time') ||
    lower.includes('lifetime') ||
    lower.includes('per run') ||
    lower.includes('per query')
  ) {
    return {
      originalPrice: price,
      originalPeriod: rawPeriod,
      monthlyEquivalent: price, // For pack, evaluate as base unit purchase
      billingPeriodLabel: rawPeriod,
      isPackOrCredit: true,
      displayFull: `$${price} (${rawPeriod})`,
      displayShort: `$${price} pack`,
      displayOriginal: `$${price} (${rawPeriod})`,
    };
  }

  // 2. Quarterly / 3 months
  if (
    lower === 'quarter' ||
    lower === 'quarterly' ||
    lower === '3' ||
    lower === '/3' ||
    lower === '3 months' ||
    lower.includes('3 mo') ||
    lower.includes('quarter')
  ) {
    const monthly = Number((price / 3).toFixed(2));
    return {
      originalPrice: price,
      originalPeriod: '3 months',
      monthlyEquivalent: monthly,
      billingPeriodLabel: '3 months',
      isPackOrCredit: false,
      displayFull: `$${price} / 3 months ($${monthly}/mo equivalent)`,
      displayShort: `$${monthly}/mo`,
      displayOriginal: `$${price} / 3 months`,
    };
  }

  // 3. Semi-Annual / 6 months
  if (
    lower.includes('6 month') ||
    lower.includes('6 mo') ||
    lower === 'biannual' ||
    lower === 'semi-annual'
  ) {
    const monthly = Number((price / 6).toFixed(2));
    return {
      originalPrice: price,
      originalPeriod: '6 months',
      monthlyEquivalent: monthly,
      billingPeriodLabel: '6 months',
      isPackOrCredit: false,
      displayFull: `$${price} / 6 months ($${monthly}/mo equivalent)`,
      displayShort: `$${monthly}/mo`,
      displayOriginal: `$${price} / 6 months`,
    };
  }

  // 4. Annual / 12 months
  if (
    lower === 'year' ||
    lower === 'annual' ||
    lower === 'annually' ||
    lower === 'yr' ||
    lower === '/yr' ||
    lower.includes('12 month')
  ) {
    const monthly = Number((price / 12).toFixed(2));
    return {
      originalPrice: price,
      originalPeriod: 'year',
      monthlyEquivalent: monthly,
      billingPeriodLabel: 'year',
      isPackOrCredit: false,
      displayFull: `$${price} / year ($${monthly}/mo equivalent)`,
      displayShort: `$${monthly}/mo`,
      displayOriginal: `$${price}/year`,
    };
  }

  // 5. Standard Monthly default
  return {
    originalPrice: price,
    originalPeriod: 'month',
    monthlyEquivalent: price,
    billingPeriodLabel: 'month',
    isPackOrCredit: false,
    displayFull: `$${price}/month`,
    displayShort: `$${price}/mo`,
    displayOriginal: `$${price}/month`,
  };
}
