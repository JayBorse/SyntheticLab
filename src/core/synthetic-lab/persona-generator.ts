import { SimulationInput, SyntheticPersona, PersonaRole } from './types';
import { nebiusNemotron } from '@/core/ai/nebius';

const FAST_MODEL_ID = process.env.NEBIUS_FAST_MODEL_ID || 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B';

export interface GeneratePersonasOptions {
  count?: number;
  isHoldOut?: boolean;
  excludeNames?: Set<string>;
  targetRoles?: PersonaRole[];
  mirrorPersonas?: SyntheticPersona[];
}

/**
 * Extracts and generates personas strictly aligned to the product pitch's Ideal Customer Profile (ICP).
 * Rule: Generates 8 in-market buyers matching the pitch ICP + at most 2 out-of-market stress-test buyers.
 */
export async function generateSyntheticPersonas(
  input: SimulationInput,
  options?: GeneratePersonasOptions
): Promise<SyntheticPersona[]> {
  const targetRoles = options?.targetRoles;
  const mirrorPersonas = options?.mirrorPersonas;
  const count = targetRoles ? targetRoles.length : (options?.count || 10);
  const isHoldOut = options?.isHoldOut || false;
  const excludeNames = options?.excludeNames;

  // Scale gracefully for swarms larger than 20 personas (e.g. 50 or 100) using parallel segmented clusters
  if (count > 20 && !targetRoles) {
    const batchSize = 20;
    const numBatches = Math.ceil(count / batchSize);
    const segmentThemes = [
      'High-Growth Tech Startups (Series A-C) & Scaleups',
      'Global Enterprise & Regulated Cloud Infrastructure',
      'Mid-Market B2B SaaS, E-Commerce & Digital Agencies',
      'Technical Teams, Engineering Studios & Consultancies',
      'Cost-Conscious SMBs, Bootstrapped Founders & Operators',
    ];

    const batchPromises = Array.from({ length: numBatches }).map(async (_, bIdx) => {
      const thisBatchCount = Math.min(batchSize, count - bIdx * batchSize);
      const segment = segmentThemes[bIdx % segmentThemes.length];
      const batchInput: SimulationInput = {
        ...input,
        targetAudience: `${input.targetAudience} (${segment})`,
      };
      return generateSyntheticPersonas(batchInput, {
        ...options,
        count: thisBatchCount,
      });
    });

    const allBatches = await Promise.all(batchPromises);
    const combined = allBatches.flat();
    return combined.slice(0, count);
  }

  let roleInstruction = '';
  if (targetRoles && targetRoles.length > 0) {
    roleInstruction = `CRITICAL ROLE & COMPOSITION MIRRORING REQUIREMENT:
You are generating a fresh Hold-Out Committee (Cohort B) that mirrors the initial panel 1-to-1 in sequence.
Roles to mirror:
${targetRoles.map((r, i) => `Persona #${i + 1}: ${r}${mirrorPersonas && mirrorPersonas[i]?.isOutOfMarket ? ' [OUT_OF_MARKET STRESS TEST]' : ' [IN_MARKET ICP]'}`).join('\n')}
Generate fresh individual names, companies, and perspectives matching this exact sequence.`;
  } else {
    roleInstruction = `AUDIENCE COMPOSITION & ECONOMIC REALISM REQUIREMENTS:
1. FIRST, extract the product's true Ideal Customer Profile (ICP) from:
   - Target Audience: "${input.targetAudience}"
   - Product: "${input.productName}" — ${input.tagline}
   - Description: "${input.description}"
   - Category: ${input.category}

2. Generate ${count} personas based directly on this ICP:
   - Exactly ${Math.max(1, count - 2)} personas MUST be genuine IN-MARKET buyers directly matching the extracted ICP.
     (e.g., for e-commerce / payments: Shopify founders, e-com ops managers, DTC heads of growth, finance leads, subscription brand owners; for indie devtools: solo iOS devs, boutique app studio founders; for consumer apps: daily subscribers; for local SMBs: restaurant owners, shop operators).
     Set "isOutOfMarket": false.
   - At most 2 personas MUST be OUT-OF-MARKET stress-test personas who might encounter this pitch unexpectedly (e.g. enterprise procurement director, HIPAA SecOps auditor, corporate controller).
     Set "isOutOfMarket": true.

3. ECONOMIC SCALE & BUDGET REALISM:
   - Calculate realistic company revenue (MRR/ARR or annual GMV) and team scale appropriate to the ICP.
   - For EVERY persona, estimate their "monthlyLossOrProblemCost":
     What does this specific problem currently cost them each month in dollars, lost revenue, chargeback fees, or wasted labor hours? (e.g. "$1,500/mo in lost chargeback disputes + $25 processor fees", "$3,500/mo in engineering preflight auditing time", "$15,000 potential App Store rejection delay", "$600/mo in guest no-shows").
   - Set "budgetCeiling" realistically and proportionally:
     * For B2B/SMB software that solves a costly problem: budget ceiling MUST be proportionally rational (typically 10%–30% of their monthlyLossOrProblemCost). If losing $1,500/mo to chargebacks, a budget ceiling of $200–$450/month is rational, NEVER an arbitrary tiny number like $30 or $60!
     * For contingency / performance / success-fee models ($0 upfront + % cut of recovered money): budget ceiling represents acceptable monthly threshold if high volume is recovered, but remember contingency fees come from won funds!
     * For Indie dev tools: $20–$100/mo or $50–$300/quarter.
     * For Consumer apps: $5–$25/mo or $30–$100/year.
     * For Enterprise: $2,000–$25,000+/mo.

4. DO NOT use a hardcoded role list. Give each persona an authentic title and role fitting their context (e.g. 'ecommerce_founder', 'ops_manager', 'indie_developer', 'studio_founder', 'procurement_director').`;
  }

  const prompt = `You are a Principal Market Researcher and Organizational Sociologist.
Analyze this product pitch and generate ${count} DISTINCT, HETEROGENEOUS synthetic decision-maker personas.

PRODUCT PITCH:
Name: ${input.productName}
Tagline: ${input.tagline}
Description: ${input.description}
Proposed Baseline Price: $${input.proposedPrice} per ${input.billingPeriod}${input.pricingTiers ? `\nPricing Tiers & Packaging:\n${input.pricingTiers}` : ''}
Target Audience: ${input.targetAudience}
Category: ${input.category}

${roleInstruction}

${isHoldOut ? 'This is a FRESH HOLD-OUT PANEL (Cohort B). Use completely different names, distinct company profiles, and fresh perspectives from Cohort A.' : 'This is the initial buyer evaluation panel (Cohort A).'}
${excludeNames && excludeNames.size > 0 ? `DO NOT use any of these existing names: ${Array.from(excludeNames).join(', ')}.` : ''}

You MUST return a JSON object with a "personas" key containing an array of ${count} objects matching this exact structure:
{
  "personas": [
    {
      "name": "Jordan Lee",
      "role": "ecommerce_founder",
      "title": "Founder & CEO, DTC Apparel",
      "companyProfile": "Shopify store selling accessories ($50k MRR, ~180 orders/day)",
      "monthlyLossOrProblemCost": "$1,400/mo in lost chargebacks + $300 in bank dispute penalty fees",
      "budgetCeiling": 350,
      "budgetPeriod": "${input.billingPeriod}",
      "riskTolerance": "medium",
      "primaryConstraint": "No dedicated dispute team; founder wastes hours manually gathering evidence",
      "existingStack": ["Shopify", "Stripe", "Klaviyo", "ShipStation"],
      "evaluationCriteria": ["Pay-only-when-you-win", "Automated evidence gathering", "Net-positive cash recovery"],
      "isOutOfMarket": false
    }
  ]
}

Return ONLY valid JSON.`;

  try {
    const response = await nebiusNemotron.chat(
      [
        {
          role: 'system',
          content: 'You output only strict, valid JSON matching the requested persona schema. Never wrap in Markdown backticks.',
        },
        { role: 'user', content: prompt },
      ],
      {
        modelId: FAST_MODEL_ID,
        responseFormat: 'json_object',
        temperature: isHoldOut ? 0.7 : 0.4,
      }
    );

    const jsonText = cleanJsonText(response.text);
    const parsed = JSON.parse(jsonText);

    if (Array.isArray(parsed.personas) && parsed.personas.length > 0) {
      const generated: SyntheticPersona[] = parsed.personas.map((p: Partial<SyntheticPersona>, idx: number) => {
        let name = p.name || `Persona ${idx + 1}`;
        if (excludeNames && excludeNames.has(name.toLowerCase())) {
          name = `${name} (Cohort B #${idx + 1})`;
        }

        const assignedRole = targetRoles && targetRoles[idx]
          ? targetRoles[idx]
          : (p.role || (idx < count - 2 ? 'indie_developer' : 'enterprise_procurement'));

        const isOutOfMarket = mirrorPersonas && mirrorPersonas[idx]
          ? Boolean(mirrorPersonas[idx].isOutOfMarket)
          : (typeof p.isOutOfMarket === 'boolean' ? p.isOutOfMarket : idx >= count - 2);

        const defaultBudget = isOutOfMarket
          ? 5000
          : (input.proposedPrice > 0 ? Math.round(input.proposedPrice * 1.5) : 350);

        return {
          id: `persona_${isHoldOut ? 'holdout_' : ''}${Date.now()}_${idx}`,
          name,
          role: assignedRole,
          title: p.title || 'Technical Decision Maker',
          companyProfile: p.companyProfile || 'Growth Venture',
          monthlyLossOrProblemCost: p.monthlyLossOrProblemCost || 'Significant monthly operational friction and lost time/revenue',
          budgetCeiling: typeof p.budgetCeiling === 'number' && p.budgetCeiling > 0 ? p.budgetCeiling : defaultBudget,
          budgetPeriod: input.billingPeriod,
          riskTolerance: p.riskTolerance || (idx % 2 === 0 ? 'low' : 'medium'),
          primaryConstraint: p.primaryConstraint || 'Budget and workflow compatibility requirements',
          existingStack: Array.isArray(p.existingStack) && p.existingStack.length > 0 ? p.existingStack : ['Standard Stack'],
          evaluationCriteria: Array.isArray(p.evaluationCriteria) && p.evaluationCriteria.length > 0 ? p.evaluationCriteria : ['Value', 'Reliability'],
          isHoldOut,
          isOutOfMarket,
          audienceMatch: isOutOfMarket ? 'out_of_market' : 'in_market',
        };
      });

      let finalPersonas = generated;
      if (generated.length < count) {
        const existingNames = new Set(generated.map((g) => g.name.toLowerCase()));
        const fallbacks = getCalibratedFallbackPersonas(input, count, isHoldOut, targetRoles, excludeNames, mirrorPersonas)
          .filter((f) => !existingNames.has(f.name.toLowerCase()));
        finalPersonas = [...generated, ...fallbacks].slice(0, count);
      } else {
        finalPersonas = generated.slice(0, count);
      }

      if (targetRoles && targetRoles.length > 0) {
        finalPersonas.forEach((p, idx) => {
          if (targetRoles[idx]) {
            p.role = targetRoles[idx];
          }
        });
      }

      return finalPersonas;
    }
  } catch (err) {
    console.warn('Nebius persona generation failed, using calibrated archetypes fallback:', err);
  }

  // Resilient fallback calibrated archetypes
  return getCalibratedFallbackPersonas(input, count, isHoldOut, targetRoles, excludeNames, mirrorPersonas);
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
        // 2. If truncated inside an array, iteratively find the last valid completed object
        let searchIndex = lastBrace;
        while (searchIndex > firstBrace) {
          const prevBrace = trimmed.lastIndexOf('}', searchIndex - 1);
          if (prevBrace <= firstBrace) break;
          const attempt = trimmed.substring(firstBrace, prevBrace + 1)
            .replace(/,\s*}/g, '}') + '\n  ]\n}';
          try {
            JSON.parse(attempt);
            return attempt;
          } catch {
            searchIndex = prevBrace;
          }
        }
      }
    }
  }

  return trimmed;
}

/**
 * Generates tailored fallback archetypes based on detected ICP category:
 * - Mobile / iOS indie app developers
 * - Consumer / subscription apps
 * - Local / SMB services
 * - B2B devtools / cloud infrastructure (default)
 *
 * Each set contains 8 authentic in-market personas + 2 out-of-market stress test personas.
 */
function getCalibratedFallbackPersonas(
  input: SimulationInput,
  count: number,
  isHoldOut: boolean,
  targetRoles?: PersonaRole[],
  excludeNames?: Set<string>,
  mirrorPersonas?: SyntheticPersona[]
): SyntheticPersona[] {
  const combinedText = `${input.productName} ${input.tagline} ${input.description} ${input.targetAudience} ${input.category}`.toLowerCase();

  let archetypes: SyntheticPersona[] = [];

  // A. E-Commerce / Merchant / Payments / Fraud & Disputes (DisputeVantage, etc.)
  if (
    combinedText.includes('dispute') ||
    combinedText.includes('chargeback') ||
    combinedText.includes('ecommerce') ||
    combinedText.includes('e-commerce') ||
    combinedText.includes('shopify') ||
    combinedText.includes('stripe') ||
    combinedText.includes('merchant') ||
    combinedText.includes('fraud') ||
    combinedText.includes('checkout') ||
    combinedText.includes('cart') ||
    combinedText.includes('payment')
  ) {
    archetypes = [
      {
        id: `p_ecom1_${Date.now()}`,
        name: isHoldOut ? 'Marcus Sterling' : 'Jordan Lee',
        role: 'ecommerce_founders',
        title: 'Founder & CEO, DTC Apparel',
        companyProfile: 'Shopify brand ($45k MRR, ~150 orders/day, Stripe payments)',
        monthlyLossOrProblemCost: '$1,200/mo in lost chargeback disputes + $25/dispute penalty fees',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 1.5) : 350, 300),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'No dedicated dispute team; founder wastes hours manually gathering evidence and tracking delivery slips.',
        existingStack: ['Shopify', 'Stripe', 'Klaviyo', 'ShipStation'],
        evaluationCriteria: ['Pay-only-when-you-win', 'Automated evidence gathering', 'Net-positive cash recovery', 'Zero upfront fee'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_ecom2_${Date.now()}`,
        name: isHoldOut ? 'Ananya Sen' : 'Priya Mehta',
        role: 'ops_manager',
        title: 'Operations & Fulfillment Manager',
        companyProfile: 'Shopify Plus electronics store ($80k MRR, 5 staff)',
        monthlyLossOrProblemCost: '$2,400/mo in chargebacks and friendly fraud',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 2.0) : 500, 450),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'High order volume strains finance team; needs automated response submission before 7-day deadlines.',
        existingStack: ['Shopify Plus', 'Stripe', 'NetSuite', 'Returnly', 'Slack'],
        evaluationCriteria: ['Automated evidence generation', 'Card network rule compliance', 'Success-based pricing', 'Scalability'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_ecom3_${Date.now()}`,
        name: isHoldOut ? 'Mateo Silva' : 'Luis Ortega',
        role: 'finance_lead',
        title: 'Finance & Bookkeeping Lead',
        companyProfile: 'WooCommerce home goods boutique ($30k MRR)',
        monthlyLossOrProblemCost: '$900/mo in unrecovered chargebacks',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 1.2) : 250, 200),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Strict ROI focus: loves success-fee models where fees are funded directly from won recoveries with zero upfront risk.',
        existingStack: ['WooCommerce', 'Stripe', 'QuickBooks Online', 'ShipBob'],
        evaluationCriteria: ['Zero upfront subscription', 'Pay-per-recovery', 'Transparent reporting', 'Minimal IT setup'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_ecom4_${Date.now()}`,
        name: isHoldOut ? 'Jessica Wu' : 'Emily Chen',
        role: 'growth_head',
        title: 'Head of Growth & Retention',
        companyProfile: 'DTC beauty brand ($70k MRR, Recharge subscriptions)',
        monthlyLossOrProblemCost: '$1,800/mo in subscription chargebacks eroding ad ROAS',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 1.8) : 400, 350),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'high',
        primaryConstraint: 'Chargeback spikes hurt payment processor trust; needs pre-dispute alerts and fast evidence defense.',
        existingStack: ['Shopify', 'Stripe', 'Recharge', 'Klaviyo', 'Facebook Ads'],
        evaluationCriteria: ['Pay-only-when-win', 'Fast implementation', 'Refund threshold control', 'No monthly overhead'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_ecom5_${Date.now()}`,
        name: isHoldOut ? 'Vikram Nair' : 'Samir Patel',
        role: 'store_owner',
        title: 'Solo Founder & Store Owner',
        companyProfile: 'Niche gadgets brand on Shopify ($25k MRR, fulfills via ShipStation)',
        monthlyLossOrProblemCost: '$750/mo in lost merchandise & dispute penalties',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 1.0) : 200, 150),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Time spent disputing chargebacks steals hours from product development; needs hands-off automation.',
        existingStack: ['Shopify', 'Stripe', 'ShipStation', 'Google Sheets'],
        evaluationCriteria: ['Zero monthly fee', 'Automatic evidence gathering', 'Clear fee cap', 'Set-and-forget'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_ecom6_${Date.now()}`,
        name: isHoldOut ? 'Claire Danvers' : 'Natalie Brooks',
        role: 'coo',
        title: 'Chief Operating Officer',
        companyProfile: 'Omnichannel retailer ($90k MRR across Shopify, Amazon, own site)',
        monthlyLossOrProblemCost: '$3,200/mo in cross-channel dispute leakage',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 2.5) : 600, 500),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Disputes across channels create reconciliation headaches; needs unified defense dashboard.',
        existingStack: ['Shopify', 'Stripe', 'Amazon Pay', 'QuickBooks', 'Slack'],
        evaluationCriteria: ['Centralized dispute handling', 'Success-based cost', 'Audit trail', 'Zero extra headcount needed'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_ecom7_${Date.now()}`,
        name: isHoldOut ? 'Arman Qureshi' : 'Ravi Singh',
        role: 'subscription_founders',
        title: 'Founder & CEO, Subscription Box',
        companyProfile: 'Curated subscription box ($55k MRR, Recharge billing)',
        monthlyLossOrProblemCost: '$1,500/mo in recurring billing disputes',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 1.5) : 350, 300),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Recurring billing disputes hurt gateway standing; needs automated proof of recurring subscription terms.',
        existingStack: ['Shopify', 'Stripe', 'Recharge', 'Klaviyo', 'ShipBob'],
        evaluationCriteria: ['Pay-only-when-win', 'Handles subscription disputes', 'Automated recurring evidence', 'Low overhead'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_ecom8_${Date.now()}`,
        name: isHoldOut ? 'Brendan Cole' : 'Megan O\'Neil',
        role: 'ecom_manager',
        title: 'E-commerce & Store Manager',
        companyProfile: 'Specialty food store on WooCommerce ($40k MRR)',
        monthlyLossOrProblemCost: '$1,100/mo in delivery-related chargebacks',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 1.3) : 300, 250),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Perishable goods lead to shipping claims; needs fast evidence collection and auto-refund below threshold.',
        existingStack: ['WooCommerce', 'Stripe', 'ShipStation', 'Mailchimp'],
        evaluationCriteria: ['Fast carrier tracking evidence', 'Pay-per-success', 'Auto-refund threshold', 'WooCommerce integration'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      // 2 Out-of-Market Stress-Test Personas
      {
        id: `p_ecom9_out_${Date.now()}`,
        name: isHoldOut ? 'Richard Sterling' : 'Daniel Ruiz',
        role: 'procurement_director',
        title: 'Director of Enterprise Payment Procurement',
        companyProfile: 'Fortune 500 Retail Enterprise ($2B annual online GMV, SAP, Adyen)',
        monthlyLossOrProblemCost: '$250,000/mo in fraud losses handled by 20-person internal risk team',
        budgetCeiling: 10000,
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Out of domain: Requires enterprise SOC-2 Type II audit, dedicated support SLA, and direct SAP/Adyen integration for >1M orders/month.',
        existingStack: ['SAP', 'Adyen', 'CyberSource', 'RSA Archer', 'ServiceNow'],
        evaluationCriteria: ['SOC-2 Type II compliance', 'API scalability (>1M orders/mo)', 'Custom rules engine', 'Dedicated 24/7 SLA'],
        isHoldOut,
        isOutOfMarket: true,
        audienceMatch: 'out_of_market',
      },
      {
        id: `p_ecom10_out_${Date.now()}`,
        name: isHoldOut ? 'Evelyn Vance' : 'Laura Kim',
        role: 'corporate_controller',
        title: 'Corporate Controller & Risk Officer',
        companyProfile: 'Enterprise B2B SaaS ($20M ARR, NetSuite, corporate invoicing)',
        monthlyLossOrProblemCost: 'Negligible B2C chargebacks; deals with corporate contract terms and wire reconciliation',
        budgetCeiling: 3000,
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Out of domain: We do not process high-volume B2C consumer chargebacks; we require NetSuite ERP automated invoice reconciliation.',
        existingStack: ['NetSuite', 'Stripe B2B', 'Expensify', 'Avalara'],
        evaluationCriteria: ['NetSuite ERP integration', 'Corporate card dispute workflows', 'Predictable flat monthly subscription', 'Audit trail'],
        isHoldOut,
        isOutOfMarket: true,
        audienceMatch: 'out_of_market',
      },
    ];
  }
  // B. Mobile / iOS Indie Developer Archetypes
  else if (
    combinedText.includes('ios app') ||
    combinedText.includes('app store') ||
    combinedText.includes('swiftui') ||
    combinedText.includes('swift') ||
    combinedText.includes('testflight') ||
    combinedText.includes('mobile app developer')
  ) {
    archetypes = [
      // 8 In-Market Indie iOS Personas
      {
        id: `p_ios1_${Date.now()}`,
        name: isHoldOut ? 'Liam Murphy' : 'Chloe Bennet',
        role: 'solo_founder',
        title: isHoldOut ? 'Solo Indie iOS Creator' : 'Solo Founder & iOS Developer',
        companyProfile: isHoldOut ? 'Self-funded App Studio ($12k MRR, 2 utility apps)' : 'Early-stage Micro-SaaS ($15k MRR, 2 utility iOS apps)',
        budgetCeiling: Math.round(input.proposedPrice * 0.9),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Extremely cash-sensitive; wants instant self-serve without multi-month lock-in or sales demos.',
        existingStack: ['SwiftUI', 'Xcode', 'RevenueCat', 'TestFlight'],
        evaluationCriteria: ['Transparent pricing', 'Low upfront cost', 'Catches App Store review rejections locally'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_ios2_${Date.now()}`,
        name: isHoldOut ? 'Devon Chen' : 'Julian Vance',
        role: 'app_studio_founder',
        title: isHoldOut ? 'Boutique iOS Studio Co-Founder' : 'Co-founder, Indie App Studio',
        companyProfile: isHoldOut ? 'App Studio with 4 utility apps (3 people, $35k MRR)' : 'Seed-Stage Mobile Studio ($500k raised, 3 apps)',
        budgetCeiling: Math.round(input.proposedPrice * 1.5),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Needs hard monthly caps on add-on scans; hates unexpected variable overages.',
        existingStack: ['Swift', 'Fastlane', 'GitHub Actions', 'PostHog'],
        evaluationCriteria: ['Predictable cost', 'Fast App Store preflight audit', 'CLI integration'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_ios3_${Date.now()}`,
        name: isHoldOut ? 'Siddharth Rao' : 'Marco Rossi',
        role: 'freelance_ios_engineer',
        title: isHoldOut ? 'Contract iOS Developer' : 'Senior iOS Freelancer',
        companyProfile: isHoldOut ? 'Freelance client consultant shipping 5 apps/year' : 'Solo iOS contractor working with startup founders',
        budgetCeiling: Math.round(input.proposedPrice * 1.2),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Wants preflight checks to run 100% locally with zero client code uploads to third-party servers.',
        existingStack: ['Xcode', 'SPM', 'CocoaPods', 'Firebase'],
        evaluationCriteria: ['Local execution', 'Zero code leak risk', 'Speed of niche keyword scan'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_ios4_${Date.now()}`,
        name: isHoldOut ? 'Evelyn Wood' : 'Sarah Lindqvist',
        role: 'app_publisher',
        title: isHoldOut ? 'Indie App Portfolio Publisher' : 'Growth & App Store Optimization Lead',
        companyProfile: isHoldOut ? 'Bootstrapped portfolio of 6 niche productivity apps' : 'Solo mobile publisher with 4 monetized iOS titles',
        budgetCeiling: Math.round(input.proposedPrice * 1.3),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Needs actionable keyword intelligence and competitor niche data to justify new app concepts.',
        existingStack: ['App Store Connect', 'Sensor Tower Lite', 'Stripe'],
        evaluationCriteria: ['App Store keyword accuracy', 'Actionable niche gap scores', 'Simple monthly billing'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_ios5_${Date.now()}`,
        name: isHoldOut ? 'Tomasz Kowalski' : 'Alex Rivera',
        role: 'indie_developer',
        title: isHoldOut ? 'Part-time Indie Hacker' : 'Side-Project iOS Engineer',
        companyProfile: isHoldOut ? 'Building weekend apps alongside day job ($2k MRR)' : 'Solo developer launching first commercial iOS app',
        budgetCeiling: Math.round(input.proposedPrice * 0.7),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'high',
        primaryConstraint: 'High price sensitivity; needs a low-cost trial or monthly option rather than lump-sum commitments.',
        existingStack: ['SwiftUI', 'App Store Connect', 'Supabase'],
        evaluationCriteria: ['Low barrier to entry', 'Clear monthly pricing equivalent', 'Immediate audit report'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_ios6_${Date.now()}`,
        name: isHoldOut ? 'Amara Okafor' : 'Priya Sharma',
        role: 'mobile_tech_lead',
        title: isHoldOut ? 'Head of Mobile' : 'Lead Mobile Architect',
        companyProfile: isHoldOut ? 'FinTech mobile micro-team (4 mobile engineers)' : 'Mobile-first startup team (5 engineers)',
        budgetCeiling: Math.round(input.proposedPrice * 2.0),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Requires privacy compliance: zero source code uploads and explicit guarantee of local analysis.',
        existingStack: ['Swift', 'Kotlin Multiplatform', 'Bitrise', 'Sentry'],
        evaluationCriteria: ['Zero cloud code ingestion', 'App Store guideline compliance', 'Team seat sharing'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_ios7_${Date.now()}`,
        name: isHoldOut ? 'Lucas Moreau' : 'Kenji Sato',
        role: 'indie_developer',
        title: isHoldOut ? 'Swift Open-Source Maintainer' : 'Independent Mac & iOS Developer',
        companyProfile: isHoldOut ? 'Independent macOS & iOS utility developer' : 'Solo creator of 3 developer utility apps',
        budgetCeiling: Math.round(input.proposedPrice * 1.0),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Prefers command-line preflight tools that can integrate into local pre-commit hooks.',
        existingStack: ['Swift CLI', 'Git', 'Xcodebuild', 'Homebrew'],
        evaluationCriteria: ['CLI support', 'Fast execution (<30s)', 'Clear pricing without hidden tiers'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_ios8_${Date.now()}`,
        name: isHoldOut ? 'Zoe Henderson' : 'Elena Rostova',
        role: 'aso_specialist',
        title: isHoldOut ? 'App Store Marketing Specialist' : 'Mobile ASO & Discovery Consultant',
        companyProfile: isHoldOut ? 'App Store discovery boutique agency' : 'Independent mobile marketing consultant',
        budgetCeiling: Math.round(input.proposedPrice * 1.8),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Needs niche scans with high data freshness and competitor saturation analysis.',
        existingStack: ['AppTweak', 'Apple Search Ads', 'Notion'],
        evaluationCriteria: ['Data freshness', 'Exportable scan reports', 'Fair scan pack pricing'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      // 2 Out-of-Market Stress-Test Personas (Clearly Labeled)
      {
        id: `p_ios9_out_${Date.now()}`,
        name: isHoldOut ? 'Victoria Liu' : 'Marcus Vance',
        role: 'enterprise_procurement',
        title: isHoldOut ? 'Global Procurement Director' : 'VP of Enterprise Vendor Procurement',
        companyProfile: isHoldOut ? 'Fortune 500 Enterprise IT Division' : 'Global Financial Corporation',
        budgetCeiling: Math.round(input.proposedPrice * 4.0),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Outside our domain: We run enterprise backend services and require Coupa/ServiceNow, net-60 terms, and master SLAs.',
        existingStack: ['Coupa', 'ServiceNow', 'Oracle ERP', 'AWS Marketplace'],
        evaluationCriteria: ['Enterprise MSA', 'Centralized billing', 'Volume tiering'],
        isHoldOut,
        isOutOfMarket: true,
        audienceMatch: 'out_of_market',
      },
      {
        id: `p_ios10_out_${Date.now()}`,
        name: isHoldOut ? 'Arthur Dent' : 'Rachel O\'Connor',
        role: 'security_lead',
        title: isHoldOut ? 'Enterprise HIPAA Security Officer' : 'Head of SecOps & Cloud Compliance',
        companyProfile: isHoldOut ? 'HealthTech Hospital Systems' : 'Regulated Healthcare SaaS',
        budgetCeiling: Math.round(input.proposedPrice * 3.0),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Out of domain: Requires SOC-2 Type II audit report, CMEK encryption, and BAA agreements before any tool evaluation.',
        existingStack: ['HashiCorp Vault', 'Wiz', 'Datadog', 'GCP'],
        evaluationCriteria: ['SOC-2 Type II', 'BAA signed', 'Dedicated VPC isolation'],
        isHoldOut,
        isOutOfMarket: true,
        audienceMatch: 'out_of_market',
      },
    ];
  }
  // C. Consumer / Wellness / Subscription App Archetypes
  else if (
    combinedText.includes('consumer') ||
    combinedText.includes('b2c') ||
    combinedText.includes('meditation') ||
    combinedText.includes('fitness') ||
    combinedText.includes('lifestyle') ||
    combinedText.includes('wellness')
  ) {
    archetypes = [
      {
        id: `p_c1_${Date.now()}`,
        name: isHoldOut ? 'Maya Lin' : 'Chloe Bennet',
        role: 'consumer_subscriber',
        title: 'Daily Mindfulness Practitioner',
        companyProfile: 'Consumer power user (uses app 20 mins every morning)',
        budgetCeiling: Math.round(input.proposedPrice * 1.2),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'high',
        primaryConstraint: 'Values smooth user experience and habit tracking; will churn if sound quality or content gets stale.',
        existingStack: ['Apple Health', 'Spotify', 'iPhone 15'],
        evaluationCriteria: ['Audio immersion', 'Fresh daily sessions', 'Family sharing'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_c2_${Date.now()}`,
        name: isHoldOut ? 'David Kim' : 'Alex Rivera',
        role: 'price_conscious_consumer',
        title: 'Budget-Conscious Student User',
        companyProfile: 'College student looking for stress relief on tight budget',
        budgetCeiling: Math.round(input.proposedPrice * 0.8),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Subscription fatigue; demands clear free trial and easy in-app cancellation.',
        existingStack: ['iOS', 'YouTube Free', 'Notion'],
        evaluationCriteria: ['Affordable monthly cost', 'Free trial without immediate charge', 'No dark patterns'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_c3_${Date.now()}`,
        name: isHoldOut ? 'Sarah Jenkins' : 'Rachel O\'Connor',
        role: 'annual_subscriber',
        title: 'Working Professional Parent',
        companyProfile: 'Full-time marketing director managing stress & sleep',
        budgetCeiling: Math.round(input.proposedPrice * 1.5),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Wants tangible sleep improvements and offline listening mode for travel.',
        existingStack: ['Apple Watch', 'Calm (churning)', 'Headspace'],
        evaluationCriteria: ['Sleep story variety', 'Offline sync', 'Discounted annual plan'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_c4_${Date.now()}`,
        name: isHoldOut ? 'Jordan Hayes' : 'Julian Vance',
        role: 'casual_switcher',
        title: 'Casual Wellness Enthusiast',
        companyProfile: 'Tries wellness apps occasionally (2-3x per week)',
        budgetCeiling: Math.round(input.proposedPrice * 0.9),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Will not commit to annual upfront fee; prefers affordable monthly billing under $10/mo.',
        existingStack: ['Android', 'Spotify', 'Google Fit'],
        evaluationCriteria: ['Low barrier to entry', 'Zero push notification spam', 'Bite-sized 5-min sessions'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_c5_${Date.now()}`,
        name: isHoldOut ? 'Amara Okafor' : 'Elena Rostova',
        role: 'habit_builder',
        title: 'Executive Coach & Practitioner',
        companyProfile: 'Uses guided breathwork for client sessions and personal routine',
        budgetCeiling: Math.round(input.proposedPrice * 2.0),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Needs scientifically grounded breathwork methods, not generic ambient music.',
        existingStack: ['Oura Ring', 'Whoop', 'Apple Health'],
        evaluationCriteria: ['Biometric integration', 'Science-backed protocols', 'Custom timer settings'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_c6_${Date.now()}`,
        name: isHoldOut ? 'Liam Murphy' : 'Kenji Sato',
        role: 'privacy_focused_user',
        title: 'Privacy-Conscious Consumer',
        companyProfile: 'Tech-savvy user wary of biometric and mood data tracking',
        budgetCeiling: Math.round(input.proposedPrice * 1.1),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Zero third-party advertising trackers or selling of emotional/mood data.',
        existingStack: ['Signal', 'Brave Browser', 'DuckDuckGo'],
        evaluationCriteria: ['No advertising SDKs', 'Local device storage', 'Clear privacy policy'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_c7_${Date.now()}`,
        name: isHoldOut ? 'Zoe Henderson' : 'Priya Sharma',
        role: 'family_plan_buyer',
        title: 'Household Decision Maker',
        companyProfile: 'Wants meditation & bedtime stories for 2 children and partner',
        budgetCeiling: Math.round(input.proposedPrice * 1.6),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Must support family sharing with separate profiles without quadrupling price.',
        existingStack: ['Apple Family Sharing', 'iPad', 'HomePod'],
        evaluationCriteria: ['Multi-profile support', 'Child-friendly content', 'Family bundle discount'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_c8_${Date.now()}`,
        name: isHoldOut ? 'Tomasz Kowalski' : 'Marco Rossi',
        role: 'free_tier_seeker',
        title: 'Freemium Exploring Consumer',
        companyProfile: 'Prefers ad-supported or generous free tier before ever entering card',
        budgetCeiling: 0,
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Refuses paywalls on day one; wants 7 days of full access with zero credit card prompt.',
        existingStack: ['Free iOS apps', 'YouTube'],
        evaluationCriteria: ['Free trial without credit card', 'No immediate auto-billing'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      // 2 Out-of-Market Stress-Test Personas
      {
        id: `p_c9_out_${Date.now()}`,
        name: isHoldOut ? 'Victoria Liu' : 'Marcus Vance',
        role: 'enterprise_procurement',
        title: 'Corporate Benefits Procurement Director',
        companyProfile: 'Fortune 500 Employee Benefits & Wellness Division',
        budgetCeiling: Math.round(input.proposedPrice * 10.0),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Out of domain: We require employee SSO, HRIS integrations (Workday), and B2B volume invoicing.',
        existingStack: ['Workday', 'Coupa', 'Okta SSO'],
        evaluationCriteria: ['Workday integration', 'Aggregated anonymous reporting', 'Net-30 billing'],
        isHoldOut,
        isOutOfMarket: true,
        audienceMatch: 'out_of_market',
      },
      {
        id: `p_c10_out_${Date.now()}`,
        name: isHoldOut ? 'Arthur Dent' : 'David Zhang',
        role: 'corporate_controller',
        title: 'Corporate Controller',
        companyProfile: 'Late-Stage Enterprise SaaS',
        budgetCeiling: 0,
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Out of domain: Cannot approve individual consumer app expenses on corporate procurement cards.',
        existingStack: ['NetSuite', 'Expensify'],
        evaluationCriteria: ['Commercial expense justification', 'Tax invoice compliance'],
        isHoldOut,
        isOutOfMarket: true,
        audienceMatch: 'out_of_market',
      },
    ];
  }
  // C. SMB / Local Service Archetypes (e.g. restaurant booking, local business)
  else if (
    combinedText.includes('restaurant') ||
    combinedText.includes('local') ||
    combinedText.includes('salon') ||
    combinedText.includes('retail') ||
    combinedText.includes('booking system') ||
    combinedText.includes('hospitality')
  ) {
    archetypes = [
      {
        id: `p_smb1_${Date.now()}`,
        name: isHoldOut ? 'Tariq Al-Mansoor' : 'Chloe Bennet',
        role: 'restaurant_owner',
        title: 'Independent Bistro Owner & Operator',
        companyProfile: 'Neighborhood 60-seat Italian bistro ($60k monthly gross)',
        budgetCeiling: Math.round(input.proposedPrice * 1.1),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Tight restaurant margins; hates per-cover fees (e.g. OpenTable $1-2 per cover) that eat into profits.',
        existingStack: ['Toast POS', 'Google Reserve', 'Instagram'],
        evaluationCriteria: ['Flat monthly fee', 'Zero per-cover commission', 'Easy iPad table management'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_smb2_${Date.now()}`,
        name: isHoldOut ? 'Devon Park' : 'Julian Vance',
        role: 'general_manager',
        title: 'Restaurant General Manager',
        companyProfile: 'High-volume urban gastropub (140 seats, high weekend turns)',
        budgetCeiling: Math.round(input.proposedPrice * 1.5),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'System downtime on Friday night means chaotic walk-ins and lost revenue; must be 99.99% reliable.',
        existingStack: ['Square POS', 'OpenTable (looking to switch)', '7shifts'],
        evaluationCriteria: ['SMS guest reminders', 'Fast two-way table status sync', 'Offline backup mode'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_smb3_${Date.now()}`,
        name: isHoldOut ? 'Elena Rostova' : 'Sarah Lin',
        role: 'hospitality_director',
        title: 'Multi-Location Hospitality Director',
        companyProfile: 'Regional group with 3 boutique cocktail bars & dining spots',
        budgetCeiling: Math.round(input.proposedPrice * 2.2),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Needs unified guest CRM across all 3 locations to recognize VIP guests and preferences.',
        existingStack: ['Toast POS', 'Mailchimp', 'SevenRooms'],
        evaluationCriteria: ['Multi-venue guest profile', 'Custom deposit policy', 'POS revenue integration'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_smb4_${Date.now()}`,
        name: isHoldOut ? 'Marco Rossi' : 'Alex Rivera',
        role: 'cafe_operator',
        title: 'Artisan Cafe & Bakery Owner',
        companyProfile: 'Daytime cafe with weekend brunch reservations (40 seats)',
        budgetCeiling: Math.round(input.proposedPrice * 0.8),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'high',
        primaryConstraint: 'Extremely cost-sensitive; seeks simple online widget without complex hardware setup.',
        existingStack: ['Square POS', 'Wix Website', 'WhatsApp Business'],
        evaluationCriteria: ['Low monthly software fee', 'No technical maintenance', 'Zero setup fee'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_smb5_${Date.now()}`,
        name: isHoldOut ? 'Priya Sharma' : 'Kenji Sato',
        role: 'lead_host',
        title: 'Head Host & Front-of-House Lead',
        companyProfile: 'Bustling seafood restaurant with high walk-in volume',
        budgetCeiling: Math.round(input.proposedPrice * 1.0),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Host staff turnover is high; table layout interface must take under 10 minutes to learn.',
        existingStack: ['iPad', 'Resy', 'Paper waitlist'],
        evaluationCriteria: ['Dead-simple UI', 'Fast guest check-in (<5s)', 'Waitlist SMS notifications'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_smb6_${Date.now()}`,
        name: isHoldOut ? 'Lucas Moreau' : 'Rachel O\'Connor',
        role: 'franchise_manager',
        title: 'Franchise Operations Manager',
        companyProfile: 'Franchise group running 5 casual dining branches',
        budgetCeiling: Math.round(input.proposedPrice * 2.5),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Requires central management dashboard with branch permissions and automated no-show fee charging.',
        existingStack: ['Toast POS', 'QuickBooks Online', 'Zapier'],
        evaluationCriteria: ['Automated no-show protection via Stripe', 'Centralized analytics', 'Staff role control'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_smb7_${Date.now()}`,
        name: isHoldOut ? 'Amara Okafor' : 'David Zhang',
        role: 'bar_manager',
        title: 'Bar & Lounge GM',
        companyProfile: 'Upscale rooftop lounge with bottle service reservations',
        budgetCeiling: Math.round(input.proposedPrice * 1.4),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Requires pre-paid minimum spend deposits to curb high weekend no-show rates.',
        existingStack: ['Square POS', 'Stripe', 'Instagram DM'],
        evaluationCriteria: ['Credit card pre-authorization', 'Custom minimum spend rules', 'Instant confirmation'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_smb8_${Date.now()}`,
        name: isHoldOut ? 'Jordan Hayes' : 'Kevin Flynn',
        role: 'boutique_operator',
        title: 'Boutique Fine-Dining Chef-Owner',
        companyProfile: '24-seat chef tasting menu restaurant (booked 4 weeks out)',
        budgetCeiling: Math.round(input.proposedPrice * 1.3),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Needs full dietary requirement collection and ticketed reservation prepayments.',
        existingStack: ['Tock', 'Stripe', 'Squarespace'],
        evaluationCriteria: ['Prepaid ticketed model', 'Dietary allergy intake', 'Personalized guest messaging'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      // 2 Out-of-Market Stress-Test Personas
      {
        id: `p_smb9_out_${Date.now()}`,
        name: isHoldOut ? 'Victoria Liu' : 'Marcus Vance',
        role: 'enterprise_procurement',
        title: 'Enterprise Vendor Procurement Director',
        companyProfile: 'Global Hotel Chain Corporate IT (400 properties)',
        budgetCeiling: Math.round(input.proposedPrice * 8.0),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Out of domain: Requires enterprise PMS integration (Opera), multi-currency settlement, and global MSA.',
        existingStack: ['Oracle Hospitality Opera', 'SAP ERP', 'ServiceNow'],
        evaluationCriteria: ['Opera PMS certification', 'Global tax compliance', '24/7 enterprise SLA'],
        isHoldOut,
        isOutOfMarket: true,
        audienceMatch: 'out_of_market',
      },
      {
        id: `p_smb10_out_${Date.now()}`,
        name: isHoldOut ? 'Arthur Dent' : 'Marcus Bell',
        role: 'security_lead',
        title: 'Enterprise Data Protection Officer',
        companyProfile: 'Global Hospitality Group',
        budgetCeiling: Math.round(input.proposedPrice * 4.0),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Out of domain: PCI-DSS Level 1 compliance verification and ISO 27001 data governance certification.',
        existingStack: ['CyberArk', 'Splunk', 'AWS Security Hub'],
        evaluationCriteria: ['PCI-DSS Level 1', 'ISO 27001', 'Dedicated database tenancy'],
        isHoldOut,
        isOutOfMarket: true,
        audienceMatch: 'out_of_market',
      },
    ];
  }
  // E. B2B DevTools / Cloud Infrastructure (VectorStream, etc.)
  else if (
    combinedText.includes('api') ||
    combinedText.includes('dev') ||
    combinedText.includes('cloud') ||
    combinedText.includes('vector') ||
    combinedText.includes('database') ||
    combinedText.includes('infra') ||
    combinedText.includes('code') ||
    combinedText.includes('software') ||
    combinedText.includes('engineering') ||
    combinedText.includes('backend') ||
    combinedText.includes('sdk') ||
    combinedText.includes('cli')
  ) {
    archetypes = [
      {
        id: `p_dev1_${Date.now()}`,
        name: isHoldOut ? 'Elena Rostova' : 'Marcus Vance',
        role: 'engineering_cto',
        title: isHoldOut ? 'Chief Technology Officer' : 'VP of Engineering & Architecture',
        companyProfile: isHoldOut ? 'AI Agent Workflow Startup ($500k ARR)' : 'High-Growth AI Agent Startup ($2M ARR, 18 engineers)',
        monthlyLossOrProblemCost: '$3,500/mo in engineering preflight auditing time and unexpected vector bill shock',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 1.5) : 500, 350),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Demands hard spend caps to avoid month-end vector bill shock like Pinecone.',
        existingStack: ['Python', 'PostgreSQL', 'Docker', 'AWS'],
        evaluationCriteria: ['Cost predictability', 'Sub-15ms p99 latency', 'Clean Python SDK'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_dev2_${Date.now()}`,
        name: isHoldOut ? 'Devon Park' : 'Alex Rivera',
        role: 'staff_engineer',
        title: isHoldOut ? 'Principal Systems Architect' : 'Staff Backend Engineer',
        companyProfile: isHoldOut ? 'High-Throughput Autonomous Agent Platform' : 'High-Scale AI Startup (Series A)',
        monthlyLossOrProblemCost: '$5,000/mo in infrastructure latency bottlenecks and manual SDK maintenance',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 2.0) : 600, 450),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'high',
        primaryConstraint: 'Zero patience for high p99 latency or proprietary lock-in; needs open export.',
        existingStack: ['PostgreSQL', 'Docker', 'Kubernetes', 'Python/TypeScript'],
        evaluationCriteria: ['p99 response latency', 'Open API specs', 'Self-hosting escape hatch'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_dev3_${Date.now()}`,
        name: isHoldOut ? 'Tariq Al-Mansoor' : 'Chloe Bennet',
        role: 'smb_founder',
        title: isHoldOut ? 'Solo AI Product Builder' : 'Solo Founder & CEO',
        companyProfile: isHoldOut ? 'Self-funded Micro-SaaS ($20k MRR)' : 'Early-stage Micro-SaaS ($15k MRR, 2 team members)',
        monthlyLossOrProblemCost: '$1,200/mo in cloud bill volatility',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 0.9) : 250, 150),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Extremely cash-sensitive; actively seeks clear usage caps and instant self-serve.',
        existingStack: ['Supabase', 'Next.js', 'Vercel', 'Stripe'],
        evaluationCriteria: ['Low barrier to entry', 'Monthly pay-as-you-go', 'Zero sales call required'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_dev4_${Date.now()}`,
        name: isHoldOut ? 'Dmitri Volkov' : 'Kenji Sato',
        role: 'devops_lead',
        title: isHoldOut ? 'Lead Cloud Infrastructure Architect' : 'Lead Site Reliability Engineer',
        companyProfile: isHoldOut ? 'High-Volume Agent Execution Platform' : 'E-commerce Infrastructure Platform',
        monthlyLossOrProblemCost: '$4,000/mo in downtime risk and on-call operational toil',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 1.6) : 550, 400),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Refuses to introduce dependencies that require manual operational babysitting.',
        existingStack: ['Terraform', 'Prometheus', 'Grafana', 'AWS EKS'],
        evaluationCriteria: ['Terraform provider support', 'SLA uptime guarantees', 'Automated failover'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_dev5_${Date.now()}`,
        name: isHoldOut ? 'Caleb Wright' : 'Priya Sharma',
        role: 'staff_engineer',
        title: isHoldOut ? 'Staff Distributed Systems Engineer' : 'Principal AI Systems Architect',
        companyProfile: isHoldOut ? 'Autonomous Agent Framework Lab' : 'Enterprise Search Platform',
        monthlyLossOrProblemCost: '$6,000/mo in developer time spent profiling vector index bottlenecks',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 2.0) : 700, 500),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'high',
        primaryConstraint: 'Requires native TypeScript and Python SDKs with sub-10ms benchmark proof.',
        existingStack: ['Rust', 'Python', 'ClickHouse', 'Vector DBs'],
        evaluationCriteria: ['Throughput at scale', 'Clean developer ergonomics', 'Zero lock-in export'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_dev6_${Date.now()}`,
        name: isHoldOut ? 'Maya Lin' : 'Julian Vance',
        role: 'smb_founder',
        title: isHoldOut ? 'Founder & CEO, Agent Studio' : 'Co-founder & CTO, Seed Stage',
        companyProfile: isHoldOut ? 'AI Workflow Agency (6 people)' : 'Seed-Stage Agent Studio ($500k raised)',
        monthlyLossOrProblemCost: '$1,800/mo in manual API stitching',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 1.1) : 350, 200),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Needs instant setup without waiting for enterprise sales demos.',
        existingStack: ['Node.js', 'Postgres', 'Vercel'],
        evaluationCriteria: ['Credit-card self-serve', 'Generous developer tier', 'Fast time-to-value'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_dev7_${Date.now()}`,
        name: isHoldOut ? 'Jordan Hayes' : 'Kevin Flynn',
        role: 'devops_lead',
        title: isHoldOut ? 'Principal Cloud Infrastructure Engineer' : 'Staff SRE',
        companyProfile: isHoldOut ? 'High-Throughput Streaming Platform' : 'Cloud Native SaaS',
        monthlyLossOrProblemCost: '$3,800/mo in infrastructure toil',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 1.8) : 600, 450),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Needs automated Terraform providers, zero manual provisioning, and clear p99 latency SLA.',
        existingStack: ['Terraform', 'Kubernetes', 'Prometheus'],
        evaluationCriteria: ['Infrastructure as Code', 'p99 latency', 'High availability'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_dev8_${Date.now()}`,
        name: isHoldOut ? 'Beatrice Gomez' : 'David Zhang',
        role: 'engineering_manager',
        title: isHoldOut ? 'Engineering Manager, Core Platform' : 'Engineering Lead, Data Platform',
        companyProfile: isHoldOut ? 'Series A Agent Analytics' : 'B2B Analytics Platform',
        monthlyLossOrProblemCost: '$4,200/mo in unpredictable third-party SaaS rate limits',
        budgetCeiling: Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 1.7) : 550, 400),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Wants transparent monthly query pricing with no hidden overage multipliers.',
        existingStack: ['Python', 'FastAPI', 'Redis', 'Docker'],
        evaluationCriteria: ['Predictable pricing', 'Accurate SDK typing', 'Clear error codes'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      // 2 Out-of-Market Stress-Test Personas
      {
        id: `p_dev9_out_${Date.now()}`,
        name: isHoldOut ? 'Arthur Dent' : 'Victoria Liu',
        role: 'enterprise_procurement',
        title: isHoldOut ? 'Head of IT Vendor Procurement' : 'Global Procurement Director',
        companyProfile: isHoldOut ? 'Global Media Enterprise' : 'Fortune 500 Enterprise IT Division',
        monthlyLossOrProblemCost: '$150,000/mo IT infrastructure procurement spend',
        budgetCeiling: 15000,
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Out of domain: Requires centralized billing, volume discount tiers, and multi-year contract options.',
        existingStack: ['Coupa', 'ServiceNow', 'AWS Marketplace'],
        evaluationCriteria: ['MSA flexibility', 'Financial escrow / SLA penalties', 'Volume discounting'],
        isHoldOut,
        isOutOfMarket: true,
        audienceMatch: 'out_of_market',
      },
      {
        id: `p_dev10_out_${Date.now()}`,
        name: isHoldOut ? 'Liam Gallagher' : 'Rachel O\'Connor',
        role: 'security_lead',
        title: isHoldOut ? 'Director of Information Security' : 'Head of SecOps',
        companyProfile: isHoldOut ? 'FinTech Banking Infrastructure' : 'HealthTech / HIPAA SaaS',
        monthlyLossOrProblemCost: 'Enterprise compliance audit & regulatory risk',
        budgetCeiling: 8000,
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Out of domain: Data must never leave customer VPC; requires SOC-2 Type II report before testing.',
        existingStack: ['Datadog', 'Okta', 'CrowdStrike', 'GCP'],
        evaluationCriteria: ['SOC-2 Type II report', 'Zero data retention policy', 'Role-based access control'],
        isHoldOut,
        isOutOfMarket: true,
        audienceMatch: 'out_of_market',
      },
    ];
  }
  // F. Dynamic Generic Business Archetypes (Adapts dynamically to ANY other business domain entered)
  else {
    const audienceClean = (input.targetAudience || 'business owners').slice(0, 45);
    const domainProblemCost = Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 6) : 1500, 1000);
    const domainBudget = Math.max(input.proposedPrice > 0 ? Math.round(input.proposedPrice * 1.5) : 350, 250);

    archetypes = [
      {
        id: `p_gen1_${Date.now()}`,
        name: isHoldOut ? 'Julian Vance' : 'Alex Mercer',
        role: 'founder_operator',
        title: `Founder & Managing Operator, ${audienceClean}`,
        companyProfile: `Independent growing business ($40k MRR, target audience: ${audienceClean})`,
        monthlyLossOrProblemCost: `$${domainProblemCost}/mo in lost operational efficiency and manual process waste`,
        budgetCeiling: domainBudget,
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Seeks clear ROI, zero multi-month contract lock-in, and fast self-serve adoption.',
        existingStack: ['Core Business Tools', 'Stripe', 'Google Workspace'],
        evaluationCriteria: ['Clear ROI', 'Fast setup (<1 day)', 'Predictable cost', 'No heavy enterprise overhead'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_gen2_${Date.now()}`,
        name: isHoldOut ? 'Devon Park' : 'Sarah Lin',
        role: 'operations_lead',
        title: 'Operations Director',
        companyProfile: `Mid-sized operational team in ${audienceClean}`,
        monthlyLossOrProblemCost: `$${Math.round(domainProblemCost * 1.5)}/mo in labor hours spent on manual workflow friction`,
        budgetCeiling: Math.round(domainBudget * 1.4),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Needs dependable workflow execution without creating maintenance headaches for team.',
        existingStack: ['Internal Workflow', 'Slack', 'Airtable', 'Zapier'],
        evaluationCriteria: ['Reliability', 'Workflow automation', 'Staff training ease'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_gen3_${Date.now()}`,
        name: isHoldOut ? 'Siddharth Rao' : 'Marco Rossi',
        role: 'finance_decision_maker',
        title: 'Finance & Budget Lead',
        companyProfile: `Financially disciplined operation in ${audienceClean}`,
        monthlyLossOrProblemCost: `$${Math.round(domainProblemCost * 0.8)}/mo in unrecovered operational leakage`,
        budgetCeiling: Math.round(domainBudget * 1.1),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Requires verifiable ROI where software costs are significantly lower than current financial loss.',
        existingStack: ['QuickBooks Online', 'Stripe', 'Excel'],
        evaluationCriteria: ['Net-positive ROI', 'Transparent pricing', 'No surprise fee escalation'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_gen4_${Date.now()}`,
        name: isHoldOut ? 'Maya Lin' : 'Chloe Bennet',
        role: 'practitioner_user',
        title: `Lead Practitioner in ${audienceClean}`,
        companyProfile: `Hands-on specialist handling core workload`,
        monthlyLossOrProblemCost: `$${Math.round(domainProblemCost * 1.2)}/mo in repetitive task fatigue`,
        budgetCeiling: Math.round(domainBudget * 0.9),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'high',
        primaryConstraint: 'Values product UX, speed, and eliminating tedious manual steps.',
        existingStack: ['Modern productivity tools', 'Web apps'],
        evaluationCriteria: ['Ease of use', 'Modern UI', 'Immediate utility'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_gen5_${Date.now()}`,
        name: isHoldOut ? 'Caleb Wright' : 'Kenji Sato',
        role: 'growth_lead',
        title: 'Head of Growth & Commercial Strategy',
        companyProfile: `Fast-moving growth team targeting ${audienceClean}`,
        monthlyLossOrProblemCost: `$${Math.round(domainProblemCost * 1.4)}/mo in missed expansion opportunities`,
        budgetCeiling: Math.round(domainBudget * 1.3),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Wants measurable velocity improvements that directly increase customer conversion.',
        existingStack: ['HubSpot', 'Segment', 'Analytics'],
        evaluationCriteria: ['Revenue lift', 'Quick integration', 'Self-serve billing'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_gen6_${Date.now()}`,
        name: isHoldOut ? 'Elena Rostova' : 'Priya Sharma',
        role: 'managing_director',
        title: 'Managing Director & Partner',
        companyProfile: `Boutique service firm in ${audienceClean} ($1M annual revenue)`,
        monthlyLossOrProblemCost: `$${Math.round(domainProblemCost * 1.8)}/mo in operational inefficiency`,
        budgetCeiling: Math.round(domainBudget * 1.6),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Needs consistent service quality across clients without adding overhead.',
        existingStack: ['Client Portal', 'Billing', 'CRM'],
        evaluationCriteria: ['Quality assurance', 'Client data security', 'Multi-seat access'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_gen7_${Date.now()}`,
        name: isHoldOut ? 'Amara Okafor' : 'David Zhang',
        role: 'solo_consultant',
        title: `Independent Consultant in ${audienceClean}`,
        companyProfile: `Solo boutique practice`,
        monthlyLossOrProblemCost: `$${Math.round(domainProblemCost * 0.7)}/mo in billable time lost to admin work`,
        budgetCeiling: Math.round(domainBudget * 0.8),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: 'Zero patience for complex enterprise software setups or multi-week onboarding.',
        existingStack: ['MacBook', 'SaaS tools', 'Stripe'],
        evaluationCriteria: ['Instant setup', 'Low upfront commitment', 'Clear value proposition'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      {
        id: `p_gen8_${Date.now()}`,
        name: isHoldOut ? 'Tomasz Kowalski' : 'Rachel O\'Connor',
        role: 'department_lead',
        title: 'Department Team Lead',
        companyProfile: `Functional team of 6 handling core operations in ${audienceClean}`,
        monthlyLossOrProblemCost: `$${Math.round(domainProblemCost * 1.1)}/mo in workflow bottlenecks`,
        budgetCeiling: Math.round(domainBudget * 1.2),
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Needs predictable monthly subscription pricing with clear team permissions.',
        existingStack: ['Team collaboration tools', 'Google Workspace'],
        evaluationCriteria: ['Team collaboration', 'Clear licensing', 'Fast onboarding'],
        isHoldOut,
        isOutOfMarket: false,
        audienceMatch: 'in_market',
      },
      // 2 Out-of-Market Stress-Test Personas
      {
        id: `p_gen9_out_${Date.now()}`,
        name: isHoldOut ? 'Arthur Dent' : 'Victoria Liu',
        role: 'enterprise_procurement',
        title: 'Enterprise Vendor Procurement Director',
        companyProfile: 'Fortune 500 Corporate IT Division',
        monthlyLossOrProblemCost: '$100,000/mo enterprise IT infrastructure spend',
        budgetCeiling: 10000,
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Out of domain: Requires master services agreement (MSA), SOC-2 Type II attestation, and enterprise invoice billing.',
        existingStack: ['Coupa', 'ServiceNow', 'SAP ERP'],
        evaluationCriteria: ['SOC-2 Type II', 'Enterprise MSA', 'Volume discounting', 'Dedicated account manager'],
        isHoldOut,
        isOutOfMarket: true,
        audienceMatch: 'out_of_market',
      },
      {
        id: `p_gen10_out_${Date.now()}`,
        name: isHoldOut ? 'Liam Gallagher' : 'Marcus Bell',
        role: 'compliance_auditor',
        title: 'Corporate Risk & Compliance Officer',
        companyProfile: 'Regulated Enterprise Risk Management',
        monthlyLossOrProblemCost: 'Enterprise regulatory compliance audit risks',
        budgetCeiling: 5000,
        budgetPeriod: input.billingPeriod,
        riskTolerance: 'low',
        primaryConstraint: 'Out of domain: Tools must have independent third-party security audits, data residency controls, and role-based access before evaluation.',
        existingStack: ['Archer GRC', 'Splunk', 'Okta SSO'],
        evaluationCriteria: ['Independent security audit', 'Role-based access controls', 'Data residency guarantees'],
        isHoldOut,
        isOutOfMarket: true,
        audienceMatch: 'out_of_market',
      },
    ];
  }

  // If mirroring target roles for Cohort B:
  if (targetRoles && targetRoles.length > 0) {
    const selected: SyntheticPersona[] = [];
    const usedIds = new Set<string>();

    targetRoles.forEach((role, idx) => {
      const isOut = mirrorPersonas && mirrorPersonas[idx] ? Boolean(mirrorPersonas[idx].isOutOfMarket) : idx >= count - 2;

      let candidate = archetypes.find(
        (a) =>
          a.role === role &&
          !usedIds.has(a.id) &&
          Boolean(a.isOutOfMarket) === isOut &&
          (!excludeNames || !excludeNames.has(a.name.toLowerCase()))
      );

      if (!candidate) {
        // Fallback: take an archetype of similar out-of-market status and customize
        const pool = archetypes.filter((a) => Boolean(a.isOutOfMarket) === isOut);
        const base = pool[idx % pool.length] || archetypes[idx % archetypes.length];
        const uniqueName = `${base.name} (Cohort B #${idx + 1})`;
        candidate = {
          ...base,
          id: `p_matched_${role}_${Date.now()}_${idx}`,
          name: uniqueName,
          role,
          isOutOfMarket: isOut,
          audienceMatch: isOut ? 'out_of_market' : 'in_market',
          isHoldOut,
        };
      }

      usedIds.add(candidate.id);
      selected.push({
        ...candidate,
        id: `p_holdout_${idx}_${Date.now()}`,
        isHoldOut,
        isOutOfMarket: isOut,
        audienceMatch: isOut ? 'out_of_market' : 'in_market',
      });
    });

    return selected;
  }

  return archetypes.slice(0, count);
}
