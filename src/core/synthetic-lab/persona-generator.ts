import { SimulationInput, SyntheticPersona } from './types';
import { nebiusNemotron } from '@/core/ai/nebius';

const FAST_MODEL_ID = process.env.NEBIUS_FAST_MODEL_ID || 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B';

export async function generateSyntheticPersonas(
  input: SimulationInput,
  options?: { count?: number; isHoldOut?: boolean; excludeNames?: Set<string>; targetRoles?: import('./types').PersonaRole[] }
): Promise<SyntheticPersona[]> {
  const targetRoles = options?.targetRoles;
  const count = targetRoles ? targetRoles.length : (options?.count || 10);
  const isHoldOut = options?.isHoldOut || false;
  const excludeNames = options?.excludeNames;

  const roleInstruction = targetRoles
    ? `CRITICAL ROLE PARITY REQUIREMENT: You MUST generate exactly ${targetRoles.length} personas matching this EXACT 1-to-1 role sequence:
${targetRoles.map((r, i) => `Persona #${i + 1}: ${r}`).join('\n')}
Each persona MUST match their specified role.`
    : `Generate ${count} personas across these core decision-maker roles (approx 2 per role): enterprise_cfo, staff_engineer, security_lead, smb_founder, procurement_director, devops_lead.`;

  const prompt = `You are an expert market analyst and organizational sociologist.
Based on the following product pitch, generate ${count} DISTINCT, HETEROGENEOUS synthetic decision-maker personas who would realistically evaluate this purchase.

PRODUCT DETAILS:
Name: ${input.productName}
Tagline: ${input.tagline}
Description: ${input.description}
Proposed Price: $${input.proposedPrice} per ${input.billingPeriod}
Target Audience: ${input.targetAudience}

REQUIREMENTS:
1. ${roleInstruction}
2. Give each persona realistic budget ceilings, risk tolerances, and specific pain points.
3. ${isHoldOut ? 'This is a FRESH HOLD-OUT COMMITTEE (Cohort B). Ensure distinct organizational profiles and completely different individual names from standard buyer cohorts.' : 'Create standard representative buyer committee (Cohort A).'}
${excludeNames && excludeNames.size > 0 ? `4. DO NOT use any of these existing names: ${Array.from(excludeNames).join(', ')}.` : ''}

You MUST return a JSON object with a "personas" key containing an array of ${count} objects matching this exact structure:
{
  "personas": [
    {
      "id": "persona_1",
      "name": "Sarah Chen",
      "role": "${targetRoles ? targetRoles[0] : 'enterprise_cfo'}",
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
        const assignedRole = targetRoles && targetRoles[idx] ? targetRoles[idx] : (p.role || (idx % 5 === 0 ? 'enterprise_cfo' : idx % 5 === 1 ? 'staff_engineer' : idx % 5 === 2 ? 'security_lead' : idx % 5 === 3 ? 'smb_founder' : 'procurement_director'));
        return {
          id: `persona_${isHoldOut ? 'holdout_' : ''}${Date.now()}_${idx}`,
          name,
          role: assignedRole,
          title: p.title || 'Technical Decision Maker',
          companyProfile: p.companyProfile || 'Growth Tech Company',
          budgetCeiling: typeof p.budgetCeiling === 'number' ? p.budgetCeiling : input.proposedPrice * 1.5,
          budgetPeriod: input.billingPeriod,
          riskTolerance: p.riskTolerance || (idx % 2 === 0 ? 'low' : 'medium'),
          primaryConstraint: p.primaryConstraint || 'Budget and security approvals required',
          existingStack: Array.isArray(p.existingStack) ? p.existingStack : ['Cloud Infra', 'GitHub'],
          evaluationCriteria: Array.isArray(p.evaluationCriteria) ? p.evaluationCriteria : ['Price', 'Reliability'],
          isHoldOut,
        };
      });

      if (generated.length >= count) {
        return generated.slice(0, count);
      }

      // If model returned fewer than requested count, augment with role-matched fallbacks
      const existingNames = new Set(generated.map((g) => g.name.toLowerCase()));
      const fallbacks = getFallbackPersonas(input, count, isHoldOut, targetRoles, excludeNames).filter((f) => !existingNames.has(f.name.toLowerCase()));
      return [...generated, ...fallbacks].slice(0, count);
    }
  } catch (err) {
    console.warn('Nebius persona generation failed, using calibrated archetypes fallback:', err);
  }

  // Resilient fallback calibrated archetypes
  return getFallbackPersonas(input, count, isHoldOut, targetRoles, excludeNames);
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

function getFallbackPersonas(
  input: SimulationInput,
  count: number,
  isHoldOut: boolean,
  targetRoles?: import('./types').PersonaRole[],
  excludeNames?: Set<string>
): SyntheticPersona[] {
  const baseArchetypes: SyntheticPersona[] = [
    {
      id: `p_cfo1_${Date.now()}`,
      name: isHoldOut ? 'Elena Rostova' : 'Marcus Vance',
      role: 'enterprise_cfo',
      title: isHoldOut ? 'Chief Financial Officer' : 'VP of Finance & Operations',
      companyProfile: isHoldOut ? 'Enterprise Cloud Infrastructure ($50M ARR)' : 'Mid-Market SaaS ($20M ARR, 150 employees)',
      budgetCeiling: Math.round(input.proposedPrice * 1.5),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'low',
      primaryConstraint: 'Demands transparent, predictable unit costs with no unbudgeted variable spikes.',
      existingStack: ['NetSuite', 'Stripe', 'AWS'],
      evaluationCriteria: ['Gross margin protection', 'Audit compliance', 'Annual contract discounts'],
      isHoldOut,
    },
    {
      id: `p_eng1_${Date.now()}`,
      name: isHoldOut ? 'Devon Park' : 'Alex Rivera',
      role: 'staff_engineer',
      title: isHoldOut ? 'Principal Systems Architect' : 'Staff Backend Engineer',
      companyProfile: isHoldOut ? 'Distributed Systems Unicorn' : 'High-Scale AI Startup (Series A)',
      budgetCeiling: Math.round(input.proposedPrice * 2.5),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'high',
      primaryConstraint: 'Zero patience for high p99 latency, proprietary lock-in, or poor SDK documentation.',
      existingStack: ['PostgreSQL', 'Docker', 'Kubernetes', 'Python/TypeScript'],
      evaluationCriteria: ['p99 response latency', 'Open API specs', 'Self-hosting escape hatch'],
      isHoldOut,
    },
    {
      id: `p_sec1_${Date.now()}`,
      name: isHoldOut ? 'Liam Gallagher' : 'Rachel O\'Connor',
      role: 'security_lead',
      title: isHoldOut ? 'Director of Information Security' : 'Head of SecOps',
      companyProfile: isHoldOut ? 'FinTech Banking Infrastructure' : 'HealthTech / HIPAA SaaS',
      budgetCeiling: Math.round(input.proposedPrice * 1.8),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'low',
      primaryConstraint: 'Data must never leave customer VPC or be used for public model retraining.',
      existingStack: ['Datadog', 'Okta', 'CrowdStrike', 'GCP'],
      evaluationCriteria: ['SOC-2 Type II report', 'Zero data retention policy', 'Role-based access control'],
      isHoldOut,
    },
    {
      id: `p_smb1_${Date.now()}`,
      name: isHoldOut ? 'Tariq Al-Mansoor' : 'Chloe Bennet',
      role: 'smb_founder',
      title: isHoldOut ? 'Bootstrapped Founder & CTO' : 'Solo Founder & CEO',
      companyProfile: isHoldOut ? 'Self-funded Micro-SaaS ($30k MRR)' : 'Early-stage Micro-SaaS ($15k MRR, 2 team members)',
      budgetCeiling: Math.round(input.proposedPrice * 0.8),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'medium',
      primaryConstraint: 'Extremely cash-sensitive; actively seeks free tiers or open-source self-hosted alternatives.',
      existingStack: ['Supabase', 'Next.js', 'Vercel', 'Stripe'],
      evaluationCriteria: ['Low barrier to entry', 'Monthly pay-as-you-go', 'Zero sales call required'],
      isHoldOut,
    },
    {
      id: `p_proc1_${Date.now()}`,
      name: isHoldOut ? 'Arthur Dent' : 'Victoria Liu',
      role: 'procurement_director',
      title: isHoldOut ? 'Head of IT Vendor Procurement' : 'Global Procurement Director',
      companyProfile: isHoldOut ? 'Global Media Enterprise' : 'Fortune 500 Enterprise IT Division',
      budgetCeiling: Math.round(input.proposedPrice * 3.0),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'low',
      primaryConstraint: 'Requires centralized billing, volume discount tiers, and multi-year contract options.',
      existingStack: ['Coupa', 'ServiceNow', 'AWS Marketplace'],
      evaluationCriteria: ['Master Services Agreement flexibility', 'Financial escrow / SLA penalties', 'Volume discounting'],
      isHoldOut,
    },
    {
      id: `p_devops1_${Date.now()}`,
      name: isHoldOut ? 'Dmitri Volkov' : 'Kenji Sato',
      role: 'devops_lead',
      title: isHoldOut ? 'Lead Cloud Infrastructure Architect' : 'Lead Site Reliability Engineer',
      companyProfile: isHoldOut ? 'High-Volume Payment Gateway' : 'E-commerce Infrastructure Platform',
      budgetCeiling: Math.round(input.proposedPrice * 1.6),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'low',
      primaryConstraint: 'Refuses to introduce dependencies that require manual operational babysitting.',
      existingStack: ['Terraform', 'Prometheus', 'Grafana', 'AWS EKS'],
      evaluationCriteria: ['Terraform provider support', 'SLA uptime guarantees', 'Automated failover'],
      isHoldOut,
    },
    {
      id: `p_cfo2_${Date.now()}`,
      name: isHoldOut ? 'Beatrice Gomez' : 'David Zhang',
      role: 'enterprise_cfo',
      title: isHoldOut ? 'VP of Financial Planning & Analysis' : 'Corporate Controller',
      companyProfile: isHoldOut ? 'Public Tech Holding Co.' : 'Late-Stage Enterprise SaaS',
      budgetCeiling: Math.round(input.proposedPrice * 2.0),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'low',
      primaryConstraint: 'Demands hard spend caps to prevent month-end cloud invoice shock.',
      existingStack: ['NetSuite', 'Anaplan', 'AWS Cost Explorer'],
      evaluationCriteria: ['Cost predictability', 'Capped usage billing', 'Audit trails'],
      isHoldOut,
    },
    {
      id: `p_eng2_${Date.now()}`,
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
    },
    {
      id: `p_sec2_${Date.now()}`,
      name: isHoldOut ? 'Ingrid Lindqvist' : 'Marcus Bell',
      role: 'security_lead',
      title: isHoldOut ? 'Lead Security & Privacy Architect' : 'VP of Security & Compliance',
      companyProfile: isHoldOut ? 'European Telecommunications SaaS' : 'Identity & Access Platform',
      budgetCeiling: Math.round(input.proposedPrice * 2.2),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'low',
      primaryConstraint: 'GDPR / HIPAA data residency compliance with customer-managed encryption keys.',
      existingStack: ['HashiCorp Vault', 'AWS KMS', 'Wiz'],
      evaluationCriteria: ['SOC-2 Type II', 'CMEK encryption', 'Zero-retention model policy'],
      isHoldOut,
    },
    {
      id: `p_smb2_${Date.now()}`,
      name: isHoldOut ? 'Maya Lin' : 'Julian Vance',
      role: 'smb_founder',
      title: isHoldOut ? 'Founder & CEO, Micro Agency' : 'Co-founder & CTO, Seed Stage',
      companyProfile: isHoldOut ? 'AI Workflow Agency (8 people)' : 'Seed-Stage Agent Studio ($500k raised)',
      budgetCeiling: Math.round(input.proposedPrice * 1.0),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'medium',
      primaryConstraint: 'Needs instant setup without waiting for enterprise sales demos.',
      existingStack: ['Node.js', 'Postgres', 'Vercel'],
      evaluationCriteria: ['Credit-card self-serve', 'Generous developer tier', 'Fast time-to-value'],
      isHoldOut,
    },
    // Additional pool entries to ensure high-cardinality role matching
    {
      id: `p_proc2_${Date.now()}`,
      name: isHoldOut ? 'Sarah Jenkins' : 'Gregory House',
      role: 'procurement_director',
      title: isHoldOut ? 'SVP Sourcing & Procurement' : 'Vendor Management Lead',
      companyProfile: isHoldOut ? 'Global FinTech Consortium' : 'Enterprise Healthcare Network',
      budgetCeiling: Math.round(input.proposedPrice * 2.8),
      budgetPeriod: input.billingPeriod,
      riskTolerance: 'low',
      primaryConstraint: 'Requires formal SOC 2 escrow, MSA sign-off, and net-60 payment terms.',
      existingStack: ['Coupa', 'Oracle ERP'],
      evaluationCriteria: ['Contract flexibility', 'SLA credits', 'Audit compliance'],
      isHoldOut,
    },
    {
      id: `p_devops2_${Date.now()}`,
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
    },
  ];

  if (targetRoles && targetRoles.length > 0) {
    const selectedPersonas: SyntheticPersona[] = [];
    const usedIds = new Set<string>();

    targetRoles.forEach((role, idx) => {
      // Find candidate matching role
      let candidate = baseArchetypes.find(
        (a) =>
          a.role === role &&
          !usedIds.has(a.id) &&
          (!excludeNames || !excludeNames.has(a.name.toLowerCase()))
      );

      if (!candidate) {
        // Fallback: take any candidate of that role and customize name
        const roleCandidate = baseArchetypes.find((a) => a.role === role) || baseArchetypes[idx % baseArchetypes.length];
        const uniqueName = `${roleCandidate.name} (Cohort B #${idx + 1})`;
        candidate = {
          ...roleCandidate,
          id: `p_matched_${role}_${Date.now()}_${idx}`,
          name: uniqueName,
          role,
          isHoldOut,
        };
      }

      usedIds.add(candidate.id);
      selectedPersonas.push({
        ...candidate,
        id: `p_holdout_${idx}_${Date.now()}`,
        isHoldOut,
      });
    });

    return selectedPersonas;
  }

  return baseArchetypes.slice(0, count);
}
