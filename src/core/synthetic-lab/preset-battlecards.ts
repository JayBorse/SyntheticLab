import { CompetitiveBattlecard } from './types';

/**
 * Curated preset battlecards derived from verified Tavily competitor evidence.
 * Safe to import in both Client and Server Components (zero Node.js dependencies).
 */
export const PRESET_BATTLECARDS: Record<string, CompetitiveBattlecard> = {
  devtools_api: {
    targetProduct: 'VectorStream AI',
    marketCategory: 'Cloud Vector Search & Agentic Retrieval',
    competitors: [
      {
        id: 'comp_pinecone',
        name: 'Pinecone Serverless',
        domain: 'pinecone.io',
        pricingModel: '$0.33 / million read units + storage overages',
        hiddenTrapOrFriction:
          'Autonomous agent loops query memory 40-80x per turn, causing unpredictable monthly cost spikes ($250-$800/mo) with zero hard spend ceilings.',
        developerGrievance:
          'Reddit r/vectordatabase: "Their serverless pricing is brutal. Tiny hobby projects spike into enterprise-level bills during recursive loop bugs."',
        sourceUrl: 'https://pinecone.io/pricing',
        switchingCost: 'medium',
        advantageOverCompetitor:
          'Guaranteed hard monthly spend caps with auto-pause webhooks, zero cold-start latency, and flat predictable pricing.',
        marketShareInSwarm: 28,
      },
      {
        id: 'comp_qdrant',
        name: 'Self-Hosted Qdrant / Chroma on K8s',
        domain: 'qdrant.tech',
        pricingModel: 'Free open-source software, but $3,500+/mo in Kubernetes engineering maintenance',
        hiddenTrapOrFriction:
          'Index rebalancing, snapshot replication, memory leak debugging, and cluster upgrades require dedicated DevOps on-call hours.',
        developerGrievance:
          'G2 & Reddit reviews: "Hosting our own vector cluster seemed cheap until we lost a weekend to HNSW index memory fragmentation during traffic surges."',
        sourceUrl: 'https://www.reddit.com/r/vectordatabase/comments/1sfv5x1/benchmark_pgvector_vs_pinecone_vs_qdrant_vs',
        switchingCost: 'high',
        advantageOverCompetitor:
          '100% managed zero-infrastructure serverless API with official Terraform modules and 99.99% uptime SLA.',
        marketShareInSwarm: 18,
      },
      {
        id: 'comp_weaviate',
        name: 'Weaviate Cloud (WCD)',
        domain: 'weaviate.io',
        pricingModel: '$0.025 / 10k dimensional query units + dedicated cluster floor ($65/mo minimum)',
        hiddenTrapOrFriction:
          'Steep learning curve around hybrid search GraphQL schema definitions and fixed monthly instance charges even during zero idle traffic.',
        developerGrievance:
          'Hacker News: "Weaviate is powerful, but their custom query syntax and $65/mo minimum cluster floor make it clunky for lean agent prototypes."',
        sourceUrl: 'https://weaviate.io/pricing',
        switchingCost: 'medium',
        advantageOverCompetitor:
          'Pure serverless consumption without base instance minimums, standard REST/Python SDKs, and sub-10ms agent memory retrieval.',
        marketShareInSwarm: 14,
      },
      {
        id: 'comp_milvus',
        name: 'Milvus / Zilliz Cloud',
        domain: 'zilliz.com',
        pricingModel: '$99/mo standard compute CU + data storage overages',
        hiddenTrapOrFriction:
          'Over-engineered for sub-10M vector workloads; requires understanding complex partition keys, segments, and proxy routing.',
        developerGrievance:
          'Reddit r/MachineLearning: "Milvus is a distributed monster. For less than 50M vectors, the operational complexity is completely unjustifiable."',
        sourceUrl: 'https://zilliz.com/pricing',
        switchingCost: 'high',
        advantageOverCompetitor:
          'Zero cluster configuration, instant sub-second collection creation, and streamlined developer experience designed specifically for LLM tool loops.',
        marketShareInSwarm: 10,
      },
      {
        id: 'comp_pgvector',
        name: 'AWS RDS Postgres pgvector / Supabase',
        domain: 'supabase.com',
        pricingModel: 'Bundled with Postgres instance ($25–$250/mo)',
        hiddenTrapOrFriction:
          'IVFFlat & HNSW index rebuilds lock DB CPU and cause query latency degradation at scale; IOPS throttling on large vector batch updates.',
        developerGrievance:
          'Hacker News: "pgvector is great to start, but once we passed 2M embeddings our production transactional DB queries started timing out during vector index maintenance."',
        sourceUrl: 'https://supabase.com/pricing',
        switchingCost: 'medium',
        advantageOverCompetitor:
          'Dedicated vector-isolated compute that never contends with production transactional SQL databases.',
        marketShareInSwarm: 12,
      },
      {
        id: 'comp_chroma',
        name: 'Chroma Cloud / Local SQLite',
        domain: 'trychroma.com',
        pricingModel: 'Free open source; hosted cloud beta tiered',
        hiddenTrapOrFriction:
          'SQLite concurrency locks on multi-threaded parallel agent writes; client-server mode memory consumption under heavy batch ingestion.',
        developerGrievance:
          'GitHub Issues: "Chroma works well in a notebook, but when 40 autonomous workers write embeddings in parallel, SQLite concurrency exceptions crash the container."',
        sourceUrl: 'https://trychroma.com',
        switchingCost: 'low',
        advantageOverCompetitor:
          'High-concurrency multi-tenant architecture with automatic write serialization and enterprise-grade distributed indexing.',
        marketShareInSwarm: 8,
      },
      {
        id: 'comp_vespa',
        name: 'Vespa.ai Enterprise Engine',
        domain: 'vespa.ai',
        pricingModel: '$0.40 / compute hour per node ($400+/mo baseline)',
        hiddenTrapOrFriction:
          'Extreme configuration XML verbosity and steep operational barrier requiring specialized search engineers to tune ranking schemas.',
        developerGrievance:
          'Engineering review: "Vespa is battle-tested at Yahoo scale, but taking 3 weeks to configure rank profiles for an AI startup is a non-starter."',
        sourceUrl: 'https://vespa.ai/pricing',
        switchingCost: 'high',
        advantageOverCompetitor:
          'Turnkey API deployment with zero rank profile XML config, operational in 5 minutes.',
        marketShareInSwarm: 4,
      },
      {
        id: 'comp_marqo',
        name: 'Marqo Multimodal Search',
        domain: 'marqo.ai',
        pricingModel: '$0.12 / GPU inference hour + search units',
        hiddenTrapOrFriction:
          'Forces inference into their proprietary embedding pipeline, increasing latency and cost if custom models are required.',
        developerGrievance:
          'Reddit r/LocalLLaMA: "Coupling embedding generation with the database layer adds 120ms round-trip latency to our agent toolchain."',
        sourceUrl: 'https://marqo.ai/pricing',
        switchingCost: 'medium',
        advantageOverCompetitor:
          'BYO-embeddings with sub-10ms raw vector retrieval, decoupling vector storage from model inference.',
        marketShareInSwarm: 2,
      },
      {
        id: 'comp_elasticsearch',
        name: 'Elasticsearch / OpenSearch Dense Vector',
        domain: 'elastic.co',
        pricingModel: '$95/mo base standard cluster + JVM memory overhead',
        hiddenTrapOrFriction:
          'JVM heap memory exhaustion and complex garbage collection tuning required to prevent cluster yellow status under vector load.',
        developerGrievance:
          'DevOps testimonials: "Elasticsearch JVM GC pauses during HNSW search spiked our p99 agent response times to 800ms."',
        sourceUrl: 'https://elastic.co/pricing',
        switchingCost: 'high',
        advantageOverCompetitor:
          'Native Rust/C++ serverless execution engine with zero JVM garbage collection pauses.',
        marketShareInSwarm: 3,
      },
      {
        id: 'comp_faiss',
        name: 'Faiss C++ In-Memory Library',
        domain: 'github.com/facebookresearch/faiss',
        pricingModel: 'Open source library ($0, but requires building custom server & persistence layer)',
        hiddenTrapOrFriction:
          'No out-of-the-box network API, replication, real-time filtering, or disk persistence—everything must be custom engineered.',
        developerGrievance:
          'Stack Overflow: "Building your own distributed FastAPI wrapper around raw Faiss GPU indices takes 4 months of senior engineering."',
        sourceUrl: 'https://github.com/facebookresearch/faiss',
        switchingCost: 'high',
        advantageOverCompetitor:
          'Production-ready distributed serverless vector API with metadata filtering and instant horizontal autoscaling.',
        marketShareInSwarm: 1,
      },
    ],
    positioningAdvantage:
      'Eliminates the "Pinecone Billing Shock" with hard spend limits while eliminating the "Self-Hosted DevOps Tax" with turnkey serverless deployment.',
    opportunitySummary:
      'AI developers and agent startups desperately want cloud vector speed without variable financial exposure. A capped-spend utility tier captures the massive underserved indie-to-growth developer segment.',
    generatedAt: Date.now(),
  },
  b2b_saas: {
    targetProduct: 'TrustShield Autonomous SOC-2',
    marketCategory: 'Continuous Compliance & Security Automation',
    competitors: [
      {
        id: 'comp_vanta',
        name: 'Vanta / Drata Incumbents',
        domain: 'vanta.com',
        pricingModel: '$7,500 – $18,000/year base platform fee + $3,000 auditor fees',
        hiddenTrapOrFriction:
          'Annual lock-in contracts with mandatory upfront billing; rigid auditor partner networks that reject boutique or independent audit firms.',
        developerGrievance:
          'Reddit r/startups: "Vanta quoted us $12k upfront before we even had $5k in MRR. The seat licensing model punishes small engineering teams."',
        sourceUrl: 'https://www.vanta.com/pricing',
        switchingCost: 'high',
        advantageOverCompetitor:
          'Pay-as-you-grow monthly cadence ($199/mo) with open auditor export, continuous GitHub posture scanning, and zero annual contract handcuffs.',
        marketShareInSwarm: 32,
      },
      {
        id: 'comp_manual_spreadsheets',
        name: 'Manual Spreadsheets & Notion Compliance Trackers',
        domain: 'notion.so',
        pricingModel: '$0 direct software cost, but 120+ hours of wasted engineering leadership labor',
        hiddenTrapOrFriction:
          'Manual screenshot collection becomes outdated within 14 days, risking failed enterprise customer security reviews and lost deals.',
        developerGrievance:
          'CTO testimonials: "Spending 3 weeks taking AWS IAM console screenshots every quarter drains our senior architects from shipping product."',
        sourceUrl: 'https://www.reddit.com/r/sysadmin/comments/soc2_audit_nightmares',
        switchingCost: 'low',
        advantageOverCompetitor:
          'Autonomous evidence collector hooks directly into AWS/GCP APIs and automatically populates auditor-ready control evidence in minutes.',
        marketShareInSwarm: 24,
      },
      {
        id: 'comp_secureframe',
        name: 'Secureframe Compliance Cloud',
        domain: 'secureframe.com',
        pricingModel: '$8,000 – $15,000/yr annual commitment',
        hiddenTrapOrFriction:
          'Lengthy onboarding sales cycles and mandatory multi-year renewal upsells with opaque pricing.',
        developerGrievance:
          'G2 review: "Sales process was aggressive. You cannot test the platform without sitting through 3 discovery calls and signing an annual contract."',
        sourceUrl: 'https://secureframe.com',
        switchingCost: 'high',
        advantageOverCompetitor:
          'Self-serve 1-click GitHub/AWS onboarding with instant security gap audit in under 10 minutes.',
        marketShareInSwarm: 14,
      },
      {
        id: 'comp_sprinto',
        name: 'Sprinto Security & Compliance',
        domain: 'sprinto.com',
        pricingModel: '$4,000 – $9,000/yr annual subscription',
        hiddenTrapOrFriction:
          'Support-dependent control mapping requiring frequent human consultant interventions to approve custom tech stacks.',
        developerGrievance:
          'Capterra review: "Whenever we deploy a non-standard serverless stack, Sprinto automated checks fail and we have to wait 5 days for support."',
        sourceUrl: 'https://sprinto.com',
        switchingCost: 'medium',
        advantageOverCompetitor:
          'AI-native control mapper that automatically parses custom Terraform, Docker, and Kubernetes environments without manual support tickets.',
        marketShareInSwarm: 8,
      },
      {
        id: 'comp_onetrust',
        name: 'OneTrust (Tugboat Logic)',
        domain: 'onetrust.com',
        pricingModel: '$12,000+/yr enterprise enterprise licensing',
        hiddenTrapOrFriction:
          'Bloated legacy enterprise UI originally designed for Fortune 500 legal teams, overwhelming early-stage engineering startups.',
        developerGrievance:
          'Reddit r/ciso: "OneTrust is enterprise bloatware. It takes 20 clicks just to see which employees haven’t signed the acceptable use policy."',
        sourceUrl: 'https://onetrust.com',
        switchingCost: 'high',
        advantageOverCompetitor:
          'Ultra-lean developer-centric dashboard designed specifically for CTOs and technical founders.',
        marketShareInSwarm: 6,
      },
      {
        id: 'comp_thoropass',
        name: 'Thoropass (formerly Laika)',
        domain: 'thoropass.com',
        pricingModel: '$10,000 – $22,000 bundled platform + audit package',
        hiddenTrapOrFriction:
          'Bundles the audit firm with the software; if you dislike their in-house auditors, you cannot easily switch without restarting the audit.',
        developerGrievance:
          'TrustRadius: "Being locked into their bundled auditors delayed our SOC-2 report by 3 months because their auditing team was overbooked."',
        sourceUrl: 'https://thoropass.com',
        switchingCost: 'high',
        advantageOverCompetitor:
          'Agnostic auditor export mode: export clean AICPA-formatted evidence packages to any independent CPA firm in 1 click.',
        marketShareInSwarm: 5,
      },
      {
        id: 'comp_scrut',
        name: 'Scrut Automation',
        domain: 'scrut.io',
        pricingModel: '$5,000 – $10,000/yr base tier',
        hiddenTrapOrFriction:
          'Limited integrations for modern edge runtimes (Cloudflare Workers, Deno, Supabase) requiring manual file uploads.',
        developerGrievance:
          'Developer forum: "Scrut works for standard AWS EC2, but completely blind to our serverless edge infrastructure."',
        sourceUrl: 'https://scrut.io',
        switchingCost: 'medium',
        advantageOverCompetitor:
          'Comprehensive native coverage for modern stacks (Vercel, Supabase, Cloudflare, Fly.io, Neon).',
        marketShareInSwarm: 4,
      },
      {
        id: 'comp_hyperproof',
        name: 'Hyperproof Compliance Operations',
        domain: 'hyperproof.io',
        pricingModel: '$15,000+/yr mid-market to enterprise',
        hiddenTrapOrFriction:
          'Requires a full-time dedicated GRC compliance manager to operate; not viable for developer-led startups without security staff.',
        developerGrievance:
          'G2 review: "Hyperproof is a project management tool for compliance teams, not an automated evidence collector for developers."',
        sourceUrl: 'https://hyperproof.io',
        switchingCost: 'high',
        advantageOverCompetitor:
          'Autonomous zero-touch evidence collection designed specifically for teams without a full-time compliance hire.',
        marketShareInSwarm: 3,
      },
      {
        id: 'comp_traditional_cpa',
        name: 'Traditional Big-4 & Regional CPA Audit Consultants',
        domain: 'pwc.com',
        pricingModel: '$25,000 – $60,000 project fee per audit',
        hiddenTrapOrFriction:
          'Manual sample testing, 6-month turnaround times, endless spreadsheet requests, and astronomical billable hourly rates.',
        developerGrievance:
          'Founder quote: "We paid an audit consultancy $30k and spent 100 hours answering repetitive email questions about our AWS security groups."',
        sourceUrl: 'https://pwc.com',
        switchingCost: 'low',
        advantageOverCompetitor:
          'Continuous real-time audit readiness at 90% lower cost with automated API validation.',
        marketShareInSwarm: 2,
      },
      {
        id: 'comp_open_source_compliance',
        name: 'Open Source Security Scanners (Trivy, Prowler, Checkov)',
        domain: 'github.com',
        pricingModel: '$0 software cost, but zero formal SOC-2 audit reports',
        hiddenTrapOrFriction:
          'Detects vulnerabilities but produces zero formal AICPA Trust Services Criteria mappings, policies, or auditor-recognized reports.',
        developerGrievance:
          'Security team review: "Prowler outputs 5,000 CLI errors but enterprise prospects want a signed SOC-2 Type II report, not a JSON dump."',
        sourceUrl: 'https://github.com/prowler-cloud/prowler',
        switchingCost: 'low',
        advantageOverCompetitor:
          'Translates infrastructure scans into certified AICPA SOC-2 Type II control attestations and employee security workflows.',
        marketShareInSwarm: 2,
      },
    ],
    positioningAdvantage:
      'Bridges the gap between enterprise $15k/yr enterprise compliance bloat and error-prone manual spreadsheet tracking.',
    opportunitySummary:
      'Early-stage B2B SaaS startups need enterprise SOC-2 badges to close mid-market contracts without surrendering 2 months of runway to legacy compliance vendors.',
    generatedAt: Date.now(),
  },
  anonymized_benchmark: {
    targetProduct: 'EngineX Runtime Install Fee (2023 Case Study)',
    marketCategory: 'Game Engine Licensing & Runtime Pricing',
    competitors: [
      {
        id: 'comp_godot',
        name: 'Godot Engine (Open Source MIT)',
        domain: 'godotengine.org',
        pricingModel: '100% Free & Open Source (0% revenue share, 0 per-install fees)',
        hiddenTrapOrFriction:
          'Smaller asset store ecosystem and fewer out-of-the-box AAA console publishing toolchains compared to proprietary engines.',
        developerGrievance:
          'Mass community flight: "We switched our entire studio pipeline to Godot in 48 hours after EngineX announced retroactive runtime tracking fees."',
        sourceUrl: 'https://godotengine.org',
        switchingCost: 'medium',
        advantageOverCompetitor:
          'Mature mobile ad mediation, cross-platform shader pipelines, and extensive asset store library—provided trust is restored via binding revenue caps.',
      },
      {
        id: 'comp_competitor_engine',
        name: 'Competitor Engine (5% Royalty over $1M)',
        domain: 'unrealengine.com',
        pricingModel: 'Predictable 5% revenue royalty only after first $1,000,000 in gross revenue',
        hiddenTrapOrFriction:
          'Steeper learning curve and heavy C++ compilation overhead for 2D and casual mobile mobile titles.',
        developerGrievance:
          'Game developer consensus: "A 5% revenue royalty is honest and aligned with success. A per-install runtime charge on free-to-play titles is predatory madness."',
        sourceUrl: 'https://unrealengine.com',
        switchingCost: 'high',
        advantageOverCompetitor:
          'Lightweight 2D/3D mobile performance and rapid C# iteration speed for indie and mid-sized game studios.',
      },
    ],
    positioningAdvantage:
      'Historic proof that variable un-audited telemetry fees trigger immediate flight to open-source, whereas transparent revenue-share caps preserve developer trust.',
    opportunitySummary:
      'Game developers reject arbitrary metrics (installs) that can be gamed by botnets, but enthusiastically support predictable revenue-sharing tied strictly to financial success.',
    generatedAt: Date.now(),
  },
};
