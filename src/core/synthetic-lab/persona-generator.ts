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

  let roleInstruction = '';
  if (targetRoles && targetRoles.length > 0) {
    roleInstruction = `CRITICAL ROLE & COMPOSITION MIRRORING REQUIREMENT:
You are generating a fresh Hold-Out Committee (Cohort B) that mirrors the initial panel 1-to-1 in sequence.
Roles to mirror:
${targetRoles.map((r, i) => `Persona #${i + 1}: ${r}${mirrorPersonas && mirrorPersonas[i]?.isOutOfMarket ? ' [OUT_OF_MARKET STRESS TEST]' : ' [IN_MARKET ICP]'}`).join('\n')}
Generate fresh individual names, companies, and perspectives matching this exact sequence.`;
  } else {
    roleInstruction = `AUDIENCE COMPOSITION REQUIREMENT:
1. FIRST, extract the product's true Ideal Customer Profile (ICP) from:
   - Target Audience: "${input.targetAudience}"
   - Product: "${input.productName}" — ${input.tagline}
   - Description: "${input.description}"
   - Category: ${input.category}

2. Generate ${count} personas based directly on this ICP:
   - Exactly ${Math.max(1, count - 2)} personas MUST be genuine IN-MARKET buyers directly matching the extracted ICP.
     (e.g., for indie developer tools: solo iOS devs, boutique app studio founders, freelance mobile engineers, bootstrapped app publishers; for consumer apps: daily subscribers, cost-conscious users, fitness enthusiasts; for local SMBs: restaurant owners, shop managers).
     Set "isOutOfMarket": false.
   - At most 2 personas MUST be OUT-OF-MARKET stress-test personas who might encounter this pitch unexpectedly (e.g. enterprise procurement director, HIPAA SecOps auditor, corporate controller).
     Set "isOutOfMarket": true.

3. DO NOT use a hardcoded role list. Give each persona an authentic title and role fitting their context (e.g. 'indie_developer', 'studio_founder', 'solo_creator', 'app_publisher', 'procurement_director').`;
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
      "name": "Alex Mercer",
      "role": "indie_developer",
      "title": "Solo iOS App Developer",
      "companyProfile": "Self-funded studio with 2 lifestyle iOS apps ($8k MRR)",
      "budgetCeiling": 30,
      "budgetPeriod": "${input.billingPeriod}",
      "riskTolerance": "medium",
      "primaryConstraint": "Cash-conscious; seeks immediate launch speed and no recurring overage traps",
      "existingStack": ["SwiftUI", "Xcode", "TestFlight", "RevenueCat"],
      "evaluationCriteria": ["Low upfront cost", "Fast preflight audits", "Zero lock-in"],
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

        return {
          id: `persona_${isHoldOut ? 'holdout_' : ''}${Date.now()}_${idx}`,
          name,
          role: assignedRole,
          title: p.title || 'Technical Decision Maker',
          companyProfile: p.companyProfile || 'Growth Venture',
          budgetCeiling: typeof p.budgetCeiling === 'number' ? p.budgetCeiling : Math.round(input.proposedPrice * (isOutOfMarket ? 2.5 : 1.2)),
          budgetPeriod: input.billingPeriod,
          riskTolerance: p.riskTolerance || (idx % 2 === 0 ? 'low' : 'medium'),
          primaryConstraint: p.primaryConstraint || 'Budget and workflow compatibility requirements',
          existingStack: Array.isArray(p.existingStack) && p.existingStack.length > 0 ? p.existingStack : ['Development Tools'],
          evaluationCriteria: Array.isArray(p.evaluationCriteria) && p.evaluationCriteria.length > 0 ? p.evaluationCriteria : ['Value', 'Reliability'],
          isHoldOut,
          isOutOfMarket,
          audienceMatch: isOutOfMarket ? 'out_of_market' : 'in_market',
        };
      });

      if (generated.length >= count) {
        return generated.slice(0, count);
      }

      // If model returned fewer than requested count, augment with ICP fallbacks
      const existingNames = new Set(generated.map((g) => g.name.toLowerCase()));
      const fallbacks = getCalibratedFallbackPersonas(input, count, isHoldOut, targetRoles, excludeNames, mirrorPersonas)
        .filter((f) => !existingNames.has(f.name.toLowerCase()));
      return [...generated, ...fallbacks].slice(0, count);
    }
  } catch (err) {
    console.warn('Nebius persona generation failed, using calibrated archetypes fallback:', err);
  }

  // Resilient fallback calibrated archetypes
  return getCalibratedFallbackPersonas(input, count, isHoldOut, targetRoles, excludeNames, mirrorPersonas);
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

  // A. Mobile / iOS Indie Developer Archetypes
  if (
    combinedText.includes('ios') ||
    combinedText.includes('app store') ||
    combinedText.includes('mobile') ||
    combinedText.includes('swift') ||
    combinedText.includes('indie dev')
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
  // B. Consumer / Wellness / Subscription App Archetypes
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
  // D. Default: B2B DevTools / Cloud Infrastructure (VectorStream, etc.)
  else {
    archetypes = [
      {
        id: `p_dev1_${Date.now()}`,
        name: isHoldOut ? 'Elena Rostova' : 'Marcus Vance',
        role: 'engineering_cto',
        title: isHoldOut ? 'Chief Technology Officer' : 'VP of Engineering & Architecture',
        companyProfile: isHoldOut ? 'AI Agent Workflow Startup ($500k ARR)' : 'High-Growth AI Agent Startup ($2M ARR, 18 engineers)',
        budgetCeiling: Math.round(input.proposedPrice * 1.5),
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
        budgetCeiling: Math.round(input.proposedPrice * 2.0),
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
        budgetCeiling: Math.round(input.proposedPrice * 0.9),
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
        budgetCeiling: Math.round(input.proposedPrice * 1.6),
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
        budgetCeiling: Math.round(input.proposedPrice * 2.0),
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
        budgetCeiling: Math.round(input.proposedPrice * 1.1),
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
        budgetCeiling: Math.round(input.proposedPrice * 1.8),
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
        budgetCeiling: Math.round(input.proposedPrice * 1.7),
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
        budgetCeiling: Math.round(input.proposedPrice * 3.5),
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
        budgetCeiling: Math.round(input.proposedPrice * 2.5),
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
