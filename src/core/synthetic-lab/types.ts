/**
 * Core Types for SyntheticLab
 * Autonomous Synthetic Buyer & Churn Simulation Arena
 */

export type PersonaRole =
  | 'enterprise_cfo'
  | 'staff_engineer'
  | 'security_lead'
  | 'smb_founder'
  | 'procurement_director'
  | 'devops_lead'
  | 'end_user';

export interface SyntheticPersona {
  id: string;
  name: string;
  role: PersonaRole;
  title: string;
  companyProfile: string;
  budgetCeiling: number; // Max annual/monthly budget in USD
  budgetPeriod: 'month' | 'year' | 'quarter' | 'one_time' | string;
  riskTolerance: 'low' | 'medium' | 'high';
  primaryConstraint: string;
  existingStack: string[];
  evaluationCriteria: string[];
  isHoldOut?: boolean; // True if reserved for Phase 2 validation
}

export interface GroundedEvidence {
  id: string;
  sourceType: 'competitor_pricing' | 'g2_review' | 'reddit_complaint' | 'market_report';
  title: string;
  snippet: string;
  url: string;
  domain: string;
  relevanceToPitch: string;
}

export type PersonaVote = 'adopt' | 'reject' | 'hesitant';

export interface PersonaEvaluation {
  personaId: string;
  personaName: string;
  role: PersonaRole;
  vote: PersonaVote;
  acceptablePrice: number; // What this persona is willing to pay
  acceptablePeriod: 'month' | 'year' | 'quarter' | 'one_time' | string;
  fatalObjections: {
    objection: string;
    severity: 'blocker' | 'concern';
    groundedEvidenceUrl?: string;
    evidenceSnippet?: string;
  }[];
  dealMakers: string[];
  rationale: string;
}

export interface SimulationVerdict {
  totalPersonas: number;
  adoptCount: number;
  rejectCount: number;
  hesitantCount: number;
  acceptanceRate: number; // Overall adopt / total (e.g., 0.4 for 40%)
  paidAdoptCount: number; // Adopters with acceptablePrice > 0 (commercial conversion)
  freeAdoptCount: number; // Adopters who only accept at $0 (free-tier only)
  paidAcceptanceRate: number; // paidAdoptCount / total
  priceRange: {
    min: number;
    median: number;
    max: number;
    currency: string;
    period: 'month' | 'year' | 'quarter' | 'one_time' | string;
  };
  topObjections: {
    objection: string;
    frequency: number;
    severity: 'blocker' | 'concern';
    citedSources: string[];
  }[];
  suggestedActionItems: string[];
}

export interface SimulationInput {
  productName: string;
  tagline: string;
  description: string;
  proposedPrice: number;
  billingPeriod: 'month' | 'year' | 'quarter' | 'one_time' | string;
  pricingTiers?: string; // Optional multi-tier packaging breakdown (e.g. Preflight $19.99/3mo, Agency $45/mo, Niche Scans $15-$25)
  targetAudience: string;
  category: 'devtools_api' | 'b2b_saas' | 'security_cloud' | 'anonymized_benchmark' | 'custom';
}

export interface OptimizedPitch {
  originalInput: SimulationInput;
  revisedTagline: string;
  revisedDescription: string;
  calibratedPrice: number;
  calibratedPeriod: 'month' | 'year' | 'quarter' | 'one_time' | string;
  packagingFix: string;
  objectionCountermeasures: {
    targetObjection: string;
    countermeasure: string;
    evidenceAddressedUrl?: string;
  }[];
  strategicRationale: string;
}

export interface HoldOutRetestResult {
  holdOutPersonas: SyntheticPersona[];
  holdOutEvaluations: PersonaEvaluation[];
  holdOutVerdict: SimulationVerdict;
  initialAcceptanceRate: number;
  holdOutAcceptanceRate: number;
  initialPaidAcceptanceRate: number;
  holdOutPaidAcceptanceRate: number;
  initialMedianPrice: number;
  holdOutMedianPrice: number;
  acceptanceRateSpread: {
    min: number;
    median: number;
    max: number;
  };
  priceSpread: {
    min: number;
    median: number;
    max: number;
  };
  resolvedObjectionsCount: number;
  totalInitialObjections: number;
  isHoldOutVerified: boolean;
  deltaSummary: string;
}

export interface SimulationRunEvent {
  stage:
    | 'analyzing_input'
    | 'spawning_personas'
    | 'grounding_market'
    | 'running_arena'
    | 'generating_verdict'
    | 'optimizing_pitch'
    | 'spawning_holdout'
    | 'running_holdout'
    | 'retest_completed'
    | 'completed'
    | 'error';
  message: string;
  timestamp: number;
  data?: {
    personas?: SyntheticPersona[];
    evidence?: GroundedEvidence[];
    evaluation?: PersonaEvaluation;
    verdict?: SimulationVerdict;
    optimizedPitch?: OptimizedPitch;
    holdOutResult?: HoldOutRetestResult;
    telemetry?: {
      modelFast: string;
      modelReasoning: string;
      totalTokens: number;
      parallelCalls: number;
      latencyMs: number;
    };
  };
}
