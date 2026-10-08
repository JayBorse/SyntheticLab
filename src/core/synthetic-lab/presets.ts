import {
  SimulationInput,
  GroundedEvidence,
  SyntheticPersona,
  PersonaEvaluation,
  SimulationVerdict,
  OptimizedPitch,
  HoldOutRetestResult,
} from './types';
import devtoolsApiReplay from './devtools-api-replay.json';

export interface SimulationPreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  input: SimulationInput;
  cachedEvidence: GroundedEvidence[];
  groundTruthObjections?: string[]; // Documented real-world public objections for Blind Replays
  savedRun?: {
    personas: SyntheticPersona[];
    evaluations: PersonaEvaluation[];
    verdict: SimulationVerdict;
    optimizedPitch?: OptimizedPitch;
    holdOutResult?: HoldOutRetestResult;
  };
}

export const SIMULATION_PRESETS: SimulationPreset[] = [
  {
    id: 'devtools_api',
    name: 'VectorStream AI (Infra / DevTools)',
    badge: 'NVIDIA / Nebius Infra',
    description: 'High-concurrency serverless vector search & embedding API for AI agents.',
    input: {
      productName: 'VectorStream AI',
      tagline: 'Sub-10ms Serverless Vector Search for Autonomous Agents',
      description:
        'Zero-cold-start, high-throughput vector retrieval engine optimized for agent memory pipelines. Billed strictly per 1,000 queries with guaranteed 99.99% uptime and zero infrastructure management.',
      proposedPrice: 40,
      billingPeriod: 'month',
      targetAudience: 'Backend AI engineers, agent developers, and tech leads managing RAG workloads',
      category: 'devtools_api',
    },
    cachedEvidence: [
      {
        id: 'ev_pinecone_pricing',
        sourceType: 'competitor_pricing',
        title: 'Pinecone Serverless Pricing & Usage Caps',
        snippet:
          'Pinecone charges $0.33/million read units plus index storage. Small teams complain about unexpected cost spikes when autonomous agent loops query memory 50+ times per conversation turn.',
        url: 'https://pinecone.io/pricing',
        domain: 'pinecone.io',
        relevanceToPitch: 'Price comparison benchmark against incumbent vector databases.',
      },
      {
        id: 'ev_qdrant_reddit',
        sourceType: 'reddit_complaint',
        title: 'Reddit r/vectordatabase: Serverless vector database costs and rate reviews',
        snippet:
          'Developers report that cloud vector databases introduce severe pricing surprises: "Pinecone 0/10 - Their serverless pricing is brutal. I was paying $50-100/month just for vector search."',
        url: 'https://www.reddit.com/r/vectordatabase/comments/1l7rods/rate_databases',
        domain: 'reddit.com',
        relevanceToPitch: 'Validates target buyer frustration with variable pricing and unexpected spikes.',
      },
      {
        id: 'ev_chroma_g2',
        sourceType: 'g2_review',
        title: 'Reddit r/vectordatabase: Benchmark pgvector vs Pinecone vs Qdrant',
        snippet:
          'Benchmark discussions highlight that self-hosting Qdrant or Chroma on Kubernetes is cheap initially, but team maintenance overhead, index rebalancing, and cluster upgrades quickly cost $4,000+/mo in engineering time.',
        url: 'https://www.reddit.com/r/vectordatabase/comments/1sfv5x1/benchmark_pgvector_vs_pinecone_vs_qdrant_vs',
        domain: 'reddit.com',
        relevanceToPitch: 'Supports the value proposition of managed serverless infrastructure.',
      },
    ],
    savedRun: devtoolsApiReplay as any,
  },
  {
    id: 'b2b_saas',
    name: 'AuditPulse (B2B Security Agent)',
    badge: 'Enterprise SaaS',
    description: 'Continuous SOC-2 & ISO-27001 autonomous compliance and vendor audit agent.',
    input: {
      productName: 'AuditPulse AI',
      tagline: 'Autonomous Continuous Compliance & Evidence Collection for Series A-C SaaS',
      description:
        'Connects into AWS, GitHub, Google Workspace, and Okta to autonomously compile audit logs, detect security drift, and generate auditor-ready SOC-2 Type II evidence packets every Monday morning.',
      proposedPrice: 499,
      billingPeriod: 'month',
      targetAudience: 'CTOs, VP of Engineering, and IT Security Leads at high-growth SaaS companies',
      category: 'b2b_saas',
    },
    cachedEvidence: [
      {
        id: 'ev_vanta_pricing',
        sourceType: 'competitor_pricing',
        title: 'Reddit r/cybersecurity: Drata vs Vanta Pricing & Annual Commitment',
        snippet:
          'Security leads report: "We paid $7,500 for the first year, then come renewal they wanted $15,000 for SOC-2 and ISO-27001... It was $20,000 upfront." Early-stage startups struggle with multi-year contract lock-ins.',
        url: 'https://www.reddit.com/r/cybersecurity/comments/10iz243/drata_vs_vanta',
        domain: 'reddit.com',
        relevanceToPitch: 'Highlights market gap for monthly flexible billing ($499/mo) vs $15k-$20k upfront lock-ins.',
      },
      {
        id: 'ev_soc2_reddit',
        sourceType: 'reddit_complaint',
        title: 'Reddit r/soc2: SOC 2 Type 1 & 2 Pricing and Consultancy Realities',
        snippet:
          'Founders note that compliance automation tools still require separate third-party auditor fees ($5k-$15k) and generate false-positive scanner alerts before the audit window.',
        url: 'https://www.reddit.com/r/soc2/comments/1j8v8jb/soc_2_type_1_using_drata_need_advice_on_cost',
        domain: 'reddit.com',
        relevanceToPitch: 'Reveals customer skepticism about hidden audit consultancy fees and false positive fatigue.',
      },
    ],
  },
  {
    id: 'anonymized_benchmark',
    name: 'Blind Replay: Anonymized Runtime Install Fee',
    badge: 'Blinded Historic Benchmark',
    description:
      'Sanitized test case based on an anonymized major game engine introducing an install-based fee.',
    input: {
      productName: 'EngineX Game Platform',
      tagline: 'Runtime Install Fee for Commercial Game Releases',
      description:
        'A cross-platform game engine with ~50% mobile market share shifts from a flat seat license to charging developers $0.20 per game install once a title exceeds $200k in 12-month revenue and 200k lifetime installs.',
      proposedPrice: 0.2,
      billingPeriod: 'month',
      targetAudience: 'Independent indie game developers, mobile studios, and commercial game studios',
      category: 'anonymized_benchmark',
    },
    groundTruthObjections: [
      'Piracy installs: Malicious users or botnets can re-install games to bankrupt developers',
      'Freemium margin destruction: Games with low ARPU ($0.30-$0.50) lose up to 60%+ of net margin',
      'Retroactive terms breach: Changing license terms on already published titles breaks publisher trust',
      'Charity bundle & demo install ambiguity: Uncertainty on how installs are tracked across platforms',
      'Proprietary tracking distrust: Lack of transparency on how the engine counts installs',
      'Developer flight to open-source: Migration threat to Godot or Unreal Engine',
    ],
    cachedEvidence: [
      {
        id: 'ev_unity_cancellation',
        sourceType: 'reddit_complaint',
        title: 'Reddit r/gamedev: Engine Pricing Changes & Runtime Fee Cancellation Analysis',
        snippet:
          'Game developers discuss the economic backlash of per-install fees: studios revolted over unverified install counting, freemium margin wipeouts, and retroactive terms breaches.',
        url: 'https://www.reddit.com/r/gamedev/comments/1oto28q/unity_pricing_changes_runtime_fee_cancellation',
        domain: 'reddit.com',
        relevanceToPitch: 'Ground-truth developer reactions documenting unverified install counting and freemium margin collapse.',
      },
      {
        id: 'ev_runtime_backlash',
        sourceType: 'reddit_complaint',
        title: 'Reddit r/technology: Game Engine Dropping Controversial Runtime Install Fee',
        snippet:
          'Coverage of developer rebellion: developers warned that per-install fees destroy free-to-play economics, risk install-bombing from malicious actors, and breach trust on existing games.',
        url: 'https://www.reddit.com/r/technology/comments/1ffv45c/unity_is_dropping_its_unpopular_perinstall',
        domain: 'reddit.com',
        relevanceToPitch: 'Documents the core developer objections: piracy install bombing, freemium margin destruction, and flight to open-source.',
      },
      {
        id: 'ev_xbox_cancellation',
        sourceType: 'reddit_complaint',
        title: 'Reddit r/xbox: Industry Analysis of Runtime Fee Reversal',
        snippet:
          'Game studios and publishers note that retroactive license changes broke publisher trust and triggered mass migration plans to alternative game engines.',
        url: 'https://www.reddit.com/r/xbox/comments/1ff7257/unity_cancels_controversial_fees_to_use_its_game',
        domain: 'reddit.com',
        relevanceToPitch: 'Validates commercial game studio flight risk and developer trust breakdown.',
      },
    ],
  },
];
