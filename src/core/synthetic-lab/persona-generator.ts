import { SimulationInput, SyntheticPersona } from './types';
import { nebiusNemotron } from '@/core/ai/nebius';

const FAST_MODEL_ID = process.env.NEBIUS_FAST_MODEL_ID || 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B';

export async function generateSyntheticPersonas(
  input: SimulationInput,
  options?: { count?: number; isHoldOut?: boolean }
): Promise<SyntheticPersona[]> {
  const count = options?.count || 5;
  const isHoldOut = options?.isHoldOut || false;

  const prompt = `You are an expert market analyst and organizational sociologist.
Based on the following product pitch, generate ${count} DISTINCT, HETEROGENEOUS synthetic decision-maker personas who would realistically evaluate this purchase.

PRODUCT DETAILS:
Name: ${input.productName}
Tagline: ${input.tagline}
Description: ${input.description}
Proposed Price: $${input.proposedPrice} per ${input.billingPeriod}
Target Audience: ${input.targetAudience}

REQUIREMENTS:
1. Personas must have conflicting priorities (e.g. one is obsessed with cash-flow/budget, one cares about developer UX/latency, one is paranoid about security/compliance, one represents SMB frugality, one represents enterprise procurement).
2. Give each persona realistic budget ceilings, risk tolerances, and specific pain points.
3. ${isHoldOut ? 'This is a FRESH HOLD-OUT PANEL. Ensure these personas have distinct organizational perspectives from standard buyer personas.' : 'Create standard representative buyers.'}

You MUST return a JSON object with a "personas" key containing an array of ${count} objects matching this exact structure:
{
  "personas": [
    {
      "id": "persona_1",
      "name": "Sarah Chen",
      "role": "enterprise_cfo",
      "title": "VP of Finance & Operations",
      "companyProfile": "Series B B2B SaaS (120 employees, $15M ARR)",
      "budgetCeiling": 500,
      "budgetPeriod": "month",
      "riskTolerance": "low",
      "primaryConstraint": "Requires clear 3x ROI justification and no variable overage spikes",
      "existingStack": ["AWS", "QuickBooks", "Stripe"],
      "evaluationCriteria": ["Cost predictability", "Contract cancellation flexibility", "ROI visibility"]
    }
  ]
}

Valid roles are: enterprise_cfo, staff_engineer, security_lead, smb_founder, procurement_director, devops_lead, end_user.
Return ONLY valid JSON.`;

  try {
    const response = await nebiusNemotron.chat(
      [
        {
          role: 'system',
          content: 'You output only strict, valid JSON matching the requested persona schema.',
        },
        { role: 'user', content: prompt },
      ],
      {
        modelId: FAST_MODEL_ID, // Use fast Nano model on Token Factory for persona synthesis
        responseFormat: 'json_object',
        temperature: isHoldOut ? 0.7 : 0.4,
      }
    );

    const jsonText = cleanJsonText(response.text);
    const parsed = JSON.parse(jsonText);

    if (Array.isArray(parsed.personas) && parsed.personas.length > 0) {
      const generated: SyntheticPersona[] = parsed.personas.map((p: Partial<SyntheticPersona>, idx: number) => ({
        id: `persona_${isHoldOut ? 'holdout_' : ''}${Date.now()}_${idx}`,
        name: p.name || `Persona ${idx + 1}`,
        role: p.role || (idx === 0 ? 'enterprise_cfo' : idx === 1 ? 'staff_engineer' : 'smb_founder'),
        title: p.title || 'Technical Decision Maker',
        companyProfile: p.companyProfile || 'Growth Tech Company',
        budgetCeiling: typeof p.budgetCeiling === 'number' ? p.budgetCeiling : input.proposedPrice * 1.5,
        budgetPeriod: input.billingPeriod,
        riskTolerance: p.riskTolerance || (idx % 2 === 0 ? 'low' : 'medium'),
        primaryConstraint: p.primaryConstraint || 'Budget and security approvals required',
        existingStack: Array.isArray(p.existingStack) ? p.existingStack : ['Cloud Infra', 'GitHub'],
        evaluationCriteria: Array.isArray(p.evaluationCriteria) ? p.evaluationCriteria : ['Price', 'Reliability'],
        isHoldOut,
      }));

      if (generated.length >= count) {
        return generated.slice(0, count);
      }

      // If model returned fewer than requested count, augment with distinct fallback roles
      const existingRoles = new Set(generated.map((g) => g.role));
      const fallbacks = getFallbackPersonas(input, count, isHoldOut).filter((f) => !existingRoles.has(f.role));
      return [...generated, ...fallbacks].slice(0, count);
    }
  } catch (err) {
    console.warn('Nebius persona generation failed, using calibrated archetypes fallback:', err);
  }

  // Resilient fallback calibrated archetypes
  return getFallbackPersonas(input, count, isHoldOut);
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

function getFallbackPersonas(input: SimulationInput, count: number, isHoldOut: boolean): SyntheticPersona[] {
  const baseArchetypes: SyntheticPersona[] = [
    {
      id: `p_cfo_${Date.now()}`,
      name: isHoldOut ? 'Elena Rostova' : 'Marcus Vance',
      role: 'enterprise_cfo',
      title: isHoldOut ? 'Chief Financial Officer' : 'VP of Finance & Operations',
      companyProfile: 'Mid-Market SaaS ($20M ARR, 150 employees)',
      budgetCeiling: Math.round(input.proposedPrice * 1.2),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'low',
      primaryConstraint: 'Demands transparent, predictable unit costs with no unbudgeted variable spikes.',
      existingStack: ['NetSuite', 'Stripe', 'AWS'],
      evaluationCriteria: ['Gross margin protection', 'Audit compliance', 'Annual contract discounts'],
      isHoldOut,
    },
    {
      id: `p_eng_${Date.now()}`,
      name: isHoldOut ? 'Devon Park' : 'Alex Rivera',
      role: 'staff_engineer',
      title: isHoldOut ? 'Principal Systems Architect' : 'Staff Backend Engineer',
      companyProfile: 'High-Scale AI Startup (Series A)',
      budgetCeiling: Math.round(input.proposedPrice * 2.0),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'high',
      primaryConstraint: 'Zero patience for high p99 latency, proprietary lock-in, or poor SDK documentation.',
      existingStack: ['PostgreSQL', 'Docker', 'Kubernetes', 'Python/TypeScript'],
      evaluationCriteria: ['p99 response latency', 'Open API specs', 'Self-hosting escape hatch'],
      isHoldOut,
    },
    {
      id: `p_sec_${Date.now()}`,
      name: isHoldOut ? 'Liam Gallagher' : 'Rachel O\'Connor',
      role: 'security_lead',
      title: isHoldOut ? 'Director of Information Security' : 'Head of SecOps',
      companyProfile: 'HealthTech / FinTech SaaS',
      budgetCeiling: Math.round(input.proposedPrice * 1.5),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'low',
      primaryConstraint: 'Data must never leave customer VPC or be used for public model retraining.',
      existingStack: ['Datadog', 'Okta', 'CrowdStrike', 'GCP'],
      evaluationCriteria: ['SOC-2 Type II report', 'Zero data retention policy', 'Role-based access control'],
      isHoldOut,
    },
    {
      id: `p_smb_${Date.now()}`,
      name: isHoldOut ? 'Tariq Al-Mansoor' : 'Chloe Bennet',
      role: 'smb_founder',
      title: isHoldOut ? 'Bootstrapped Founder' : 'Solo Founder & CEO',
      companyProfile: 'Early-stage Micro-SaaS ($15k MRR, 2 team members)',
      budgetCeiling: Math.round(input.proposedPrice * 0.6),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'medium',
      primaryConstraint: 'Extremely cash-sensitive; actively seeks free tiers or open-source self-hosted alternatives.',
      existingStack: ['Supabase', 'Next.js', 'Vercel', 'Stripe'],
      evaluationCriteria: ['Low barrier to entry', 'Monthly pay-as-you-go', 'Zero sales call required'],
      isHoldOut,
    },
    {
      id: `p_devops_${Date.now()}`,
      name: isHoldOut ? 'Kenji Sato' : 'Dmitri Volkov',
      role: 'devops_lead',
      title: isHoldOut ? 'Lead Site Reliability Engineer' : 'Lead Infrastructure Engineer',
      companyProfile: 'E-commerce Infrastructure Platform',
      budgetCeiling: Math.round(input.proposedPrice * 1.1),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'low',
      primaryConstraint: 'Refuses to introduce dependencies that require manual operational babysitting.',
      existingStack: ['Terraform', 'Prometheus', 'Grafana', 'AWS EKS'],
      evaluationCriteria: ['Terraform provider support', 'SLA uptime guarantees', 'Automated failover'],
      isHoldOut,
    },
  ];

  return baseArchetypes.slice(0, count);
}
