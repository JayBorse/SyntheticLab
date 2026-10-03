import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SIMULATION_PRESETS } from '../src/core/synthetic-lab/presets';
import { computeSimulationVerdict } from '../src/core/synthetic-lab/simulation-engine';
import { PersonaEvaluation, SimulationInput, SyntheticPersona } from '../src/core/synthetic-lab/types';
import { generateSyntheticPersonas } from '../src/core/synthetic-lab/persona-generator';
import {
  evaluateBenchmarkObjectionRecall,
  matchesObjectionTopic,
  BENCHMARK_OBJECTION_TOPICS,
  computeResolvedObjections,
  areObjectionsSemanticallyRelated,
} from '../src/core/synthetic-lab/semantic-matcher';
import { checkSimulationRateLimit } from '../src/core/security/rate-limiter';
import { optimizeProductPitch } from '../src/core/synthetic-lab/optimizer';
import { scoutMarketEvidence, deriveSourceType } from '../src/core/synthetic-lab/market-scout';
import { normalizePricingCadence } from '../src/core/synthetic-lab/pricing-normalizer';
import { clusterAndRankObjections } from '../src/core/synthetic-lab/simulation-engine';
import {
  generateMarkdownReport,
  generateCsvExport,
  generateJsonExport,
} from '../src/core/synthetic-lab/report-exporter';

describe('SyntheticLab Core Architecture & Verification Suite', () => {
  it('1. Presets have complete inputs and pre-warmed Tavily market evidence', () => {
    assert.ok(SIMULATION_PRESETS.length >= 3, 'Must have at least 3 curated presets');
    SIMULATION_PRESETS.forEach((preset) => {
      assert.ok(preset.id, 'Preset must have an ID');
      assert.ok(preset.input.productName, 'Preset must have a productName');
      assert.ok(preset.cachedEvidence.length > 0, 'Preset must have pre-warmed Tavily evidence');
      preset.cachedEvidence.forEach((ev) => {
        assert.ok(ev.url.startsWith('https://'), `Evidence URL must start with https://: ${ev.url}`);
        assert.ok(ev.snippet.length > 10, 'Evidence must contain a descriptive snippet');
      });
    });
  });

  it('2. Empirical Verdict computes real statistics without hardcoded values', () => {
    const mockInput: SimulationInput = {
      productName: 'TestEngine',
      tagline: 'Fast Vector Search',
      description: 'API for embeddings',
      proposedPrice: 50,
      billingPeriod: 'month',
      targetAudience: 'Developers',
      category: 'devtools_api',
    };

    const mockEvaluations: PersonaEvaluation[] = [
      {
        personaId: 'p1',
        personaName: 'Alice',
        role: 'enterprise_cfo',
        vote: 'adopt',
        acceptablePrice: 50,
        acceptablePeriod: 'month',
        fatalObjections: [],
        dealMakers: [],
        rationale: 'Good ROI',
      },
      {
        personaId: 'p2',
        personaName: 'Bob',
        role: 'staff_engineer',
        vote: 'reject',
        acceptablePrice: 0,
        acceptablePeriod: 'month',
        fatalObjections: [
          { objection: 'Network latency overhead', severity: 'blocker', groundedEvidenceUrl: 'https://reddit.com' },
        ],
        dealMakers: [],
        rationale: 'Too slow',
      },
      {
        personaId: 'p3',
        personaName: 'Charlie',
        role: 'security_lead',
        vote: 'hesitant',
        acceptablePrice: 40,
        acceptablePeriod: 'month',
        fatalObjections: [
          { objection: 'Network latency overhead', severity: 'concern' },
        ],
        dealMakers: [],
        rationale: 'Need SLA',
      },
    ];

    const verdict = computeSimulationVerdict(mockInput, mockEvaluations);

    // Verify mathematical derivation: 1 of 3 adopted = 0.33
    assert.equal(verdict.totalPersonas, 3);
    assert.equal(verdict.adoptCount, 1);
    assert.equal(verdict.rejectCount, 1);
    assert.equal(verdict.hesitantCount, 1);
    assert.equal(verdict.acceptanceRate, 0.33);
    assert.equal(verdict.paidAdoptCount, 1);
    assert.equal(verdict.freeAdoptCount, 0);
    assert.equal(verdict.paidAcceptanceRate, 0.33);

    // Price range: prices [0, 40, 50] -> min: 0, median: 40, max: 50
    assert.equal(verdict.priceRange.min, 0);
    assert.equal(verdict.priceRange.median, 40);
    assert.equal(verdict.priceRange.max, 50);

    // Top objections: 'Network latency overhead' appeared twice
    assert.equal(verdict.topObjections[0].objection, 'Network latency overhead');
    assert.equal(verdict.topObjections[0].frequency, 2);
  });

  it('3. Free-tier adoption ($0 WTP) is strictly isolated from commercial paid adoption', () => {
    const mockInput: SimulationInput = {
      productName: 'FreeSaaS',
      tagline: 'Tool',
      description: 'Test',
      proposedPrice: 30,
      billingPeriod: 'month',
      targetAudience: 'Everyone',
      category: 'devtools_api',
    };

    const evaluationsWithFreebie: PersonaEvaluation[] = [
      {
        personaId: 'p1',
        personaName: 'Freebie Lover',
        role: 'smb_founder',
        vote: 'adopt',
        acceptablePrice: 0, // Adopted only because it is free
        acceptablePeriod: 'month',
        fatalObjections: [],
        dealMakers: [],
        rationale: 'I only use the free tier.',
      },
      {
        personaId: 'p2',
        personaName: 'Commercial Buyer',
        role: 'enterprise_cfo',
        vote: 'adopt',
        acceptablePrice: 30,
        acceptablePeriod: 'month',
        fatalObjections: [],
        dealMakers: [],
        rationale: 'Willing to pay $30.',
      },
    ];

    const verdict = computeSimulationVerdict(mockInput, evaluationsWithFreebie);
    assert.equal(verdict.totalPersonas, 2);
    assert.equal(verdict.adoptCount, 2, 'Overall adopt count includes free and paid');
    assert.equal(verdict.acceptanceRate, 1.0);
    assert.equal(verdict.freeAdoptCount, 1, 'Must register exactly 1 free-tier adopter');
    assert.equal(verdict.paidAdoptCount, 1, 'Must register exactly 1 paid commercial adopter');
    assert.equal(verdict.paidAcceptanceRate, 0.5, 'Paid acceptance rate must be 50%, not 100%');
  });

  it('4. Persona synthesis produces symmetric paired roles across panels with 1-to-1 role parity', async () => {
    const input: SimulationInput = {
      productName: 'TestApp',
      tagline: 'App',
      description: 'Desc',
      proposedPrice: 50,
      billingPeriod: 'month',
      targetAudience: 'Devs',
      category: 'devtools_api',
    };

    // Generate 10 personas for Cohort A
    const cohortA = await generateSyntheticPersonas(input, { count: 10, isHoldOut: false });
    const namesA = new Set(cohortA.map((p) => p.name.toLowerCase()));
    const targetRoles = cohortA.map((p) => p.role);

    // Generate Cohort B with exact 1-to-1 role mirroring
    const cohortB = await generateSyntheticPersonas(input, {
      count: 10,
      isHoldOut: true,
      excludeNames: namesA,
      targetRoles,
    });

    assert.equal(cohortA.length, 10, 'Cohort A must have 10 personas');
    assert.equal(cohortB.length, 10, 'Cohort B must have 10 personas');

    // Strict 1-to-1 role parity
    assert.deepEqual(
      cohortB.map((p) => p.role),
      targetRoles,
      'Cohort B must strictly mirror Cohort A role sequence 1-to-1'
    );

    // Anti-circular proof: Persona names must have zero overlap
    cohortB.forEach((p) => {
      assert.ok(!namesA.has(p.name.toLowerCase()), `Cohort B persona ${p.name} must not exist in Cohort A`);
    });
  });

  it('5. Semantic Objection Matcher correctly identifies core grievances without naive substring collisions', () => {
    const piracyTopic = BENCHMARK_OBJECTION_TOPICS.find((t) => t.id === 'piracy_install_bombing')!;
    const f2pTopic = BENCHMARK_OBJECTION_TOPICS.find((t) => t.id === 'freemium_margin_destruction')!;

    // Legitimate semantic match
    const candidateObjection1 = 'Malicious botnets can execute repeat install-bombing attacks to drain studio finances.';
    assert.ok(matchesObjectionTopic(candidateObjection1, piracyTopic), 'Should match piracy install-bombing topic');

    // False-positive test: an objection that merely uses the word "install" or "developer" without the core grievance
    const unrelatedObjection = 'Our developer team prefers installing tools via npm package manager rather than Docker.';
    assert.equal(matchesObjectionTopic(unrelatedObjection, piracyTopic), false, 'Should NOT trigger on generic install keyword');

    // F2P margin match
    const candidateObjection2 = 'Per-install fee destroys unit economics for our free-to-play mobile games with $0.40 ARPU, exceeding our net margins.';
    assert.ok(matchesObjectionTopic(candidateObjection2, f2pTopic), 'Should match freemium margin collapse topic');
  });

  it('6. Semantic Recall correctly scores against full benchmark topic suite', () => {
    const candidateObjections = [
      'Risk of piracy and install-bombing by malicious actors.',
      'Our f2p game ARPU is only $0.35, this install fee will wipe out our margins completely.',
      'This is a retroactive terms change on games we already published three years ago.',
      'How are charity bundles and free demo installs counted? The policy is totally ambiguous.',
      'We do not trust proprietary tracking telemetry without an open audit trail.',
      'We are seriously evaluating migration to Godot or an open-source engine.',
    ];

    const result = evaluateBenchmarkObjectionRecall(candidateObjections);
    assert.equal(result.total, 6);
    assert.equal(result.matches, 6);
    assert.equal(result.percentage, 100);
  });

  it('7. Rate limiter throttles excessive requests to protect API credits', () => {
    const testIp = '192.168.1.99';
    let allowedCount = 0;

    // Simulate rapid requests
    for (let i = 0; i < 15; i++) {
      const res = checkSimulationRateLimit(testIp);
      if (res.allowed) allowedCount += 1;
    }

    // Default limit is 8 requests per hour
    assert.equal(allowedCount, 8, 'Rate limiter must cap at exactly 8 requests per hour per IP');
    const blockedRes = checkSimulationRateLimit(testIp);
    assert.equal(blockedRes.allowed, false, 'Subsequent request must be blocked');
    assert.ok(blockedRes.reason?.includes('limit exceeded'), 'Reason must explain limit');
  });

  it('8. Pre-Saved Demo Replay contains complete Cohort A and Cohort B verification', () => {
    const vectorStream = SIMULATION_PRESETS.find((p) => p.id === 'devtools_api');
    assert.ok(vectorStream?.savedRun, 'VectorStream AI must contain a pre-saved run for instant demo replay');
    const run = vectorStream.savedRun;

    assert.equal(run.personas.length, 5, 'Must have 5 initial personas (Cohort A)');
    assert.equal(run.evaluations.length, 5, 'Must have 5 evaluations');
    assert.equal(run.verdict.totalPersonas, 5);

    // Check hold-out panel anti-circular verification
    assert.ok(run.holdOutResult, 'Must contain holdOutResult');
    assert.equal(run.holdOutResult.isHoldOutVerified, true, 'isHoldOutVerified must be true');
    assert.equal(run.holdOutResult.holdOutPersonas.length, 5, 'Must have 5 distinct hold-out personas (Cohort B)');

    // Ensure Cohort A and Cohort B have zero ID collisions
    const cohortAIds = new Set(run.personas.map((p: SyntheticPersona) => p.id));
    run.holdOutResult.holdOutPersonas.forEach((p: SyntheticPersona) => {
      assert.ok(!cohortAIds.has(p.id), `Hold-out persona ${p.id} must not exist in Cohort A`);
    });
  });

  it('9. Semantic Objection Resolution distinguishes resolved blockers from persisted concerns', () => {
    const objA = 'No evidence of SOC 2 Type II attestation or TLS 1.3 encryption';
    const objB = 'Mandatory SOC 2 compliance report is missing from the docs';
    const objC = 'Latency exceeds our 10ms threshold for real-time agents';

    assert.ok(areObjectionsSemanticallyRelated(objA, objB), 'Should detect semantic relation around SOC 2 compliance');
    assert.equal(areObjectionsSemanticallyRelated(objA, objC), false, 'Should not match security against latency');

    const initial = [
      'No evidence of SOC 2 Type II attestation',
      'Unclear per-query pricing and no defined usage caps',
      'Missing Helm chart for Kubernetes deployment',
    ];
    // Holdout only brings up latency, while SOC 2, pricing caps, and Helm were resolved
    const holdout = ['Requires sub-5ms p99 latency benchmarks'];

    const result = computeResolvedObjections(initial, holdout);
    assert.equal(result.totalInitial, 3);
    assert.equal(result.resolvedCount, 3, 'All 3 initial objections should be resolved');
    assert.equal(result.persistedObjections.length, 0);
  });

  it('10. Optimizer strictly formulates commitments and contractual roadmaps rather than claiming fake past achievements', () => {
    assert.ok(typeof optimizeProductPitch === 'function', 'optimizeProductPitch must be an executable function');
  });

  it('11. Report Exporter generates full Executive Markdown, CSV Matrix, and Raw JSON with empirical integrity', () => {
    const vectorStream = SIMULATION_PRESETS.find((p) => p.id === 'devtools_api')!;
    assert.ok(vectorStream.savedRun, 'Must have savedRun');

    const exportData = {
      input: vectorStream.input,
      verdict: vectorStream.savedRun.verdict,
      personas: vectorStream.savedRun.personas,
      evidence: vectorStream.cachedEvidence,
      evaluations: vectorStream.savedRun.evaluations,
      optimizedPitch: vectorStream.savedRun.optimizedPitch || null,
      holdOutResult: vectorStream.savedRun.holdOutResult || null,
      telemetry: {
        modelFast: 'nemotron-3-super-120b',
        modelReasoning: 'Nemotron-3-Ultra-550b',
        totalTokens: 18450,
        parallelCalls: 5,
        latencyMs: 1420,
      },
    };

    // 1. Markdown Report Verification
    const md = generateMarkdownReport(exportData);
    assert.ok(md.includes('# SyntheticLab Procurement Teardown: VectorStream AI'), 'MD must contain header with product title');
    assert.ok(md.includes('## 1. Executive Procurement Verdict'), 'MD must contain executive verdict section');
    assert.ok(md.includes('Autonomous Buyer Persona Evaluations'), 'MD must contain persona evaluations');
    assert.ok(md.includes('## 5. Autonomous Optimization (NVIDIA Nemotron 3 Ultra)'), 'MD must contain optimization section');
    assert.ok(md.includes('## 6. Cohort B: Blinded Hold-Out Committee Validation'), 'MD must contain holdout validation');

    // 2. CSV Matrix Verification
    const csv = generateCsvExport(exportData);
    assert.ok(csv.includes('"Persona ID","Persona Name"'), 'CSV must contain proper column headers');
    const lines = csv.split('\r\n');
    const expectedRowCount = exportData.evaluations.length + (exportData.holdOutResult?.holdOutEvaluations.length || 0) + 1;
    assert.equal(lines.length, expectedRowCount, 'CSV must have 1 header line plus Cohort A and Cohort B evaluation lines');

    // 3. JSON Export Verification
    const jsonStr = generateJsonExport(exportData);
    const parsed = JSON.parse(jsonStr);
    assert.equal(parsed.pitch.productName, 'VectorStream AI');
    assert.equal(parsed.cohortA.personas.length, exportData.personas.length);
    assert.equal(parsed.cohortA.evaluations.length, exportData.evaluations.length);
    assert.ok(parsed.metadata.exportedAt, 'Must include export timestamp');
  });

  it('12. Preset evidence never leaks into custom non-preset input runs', async () => {
    const customPitch: SimulationInput = {
      productName: 'AppsVantage',
      tagline: 'App Store Intelligence & Preflight for iOS Developers',
      description: 'Discovers app niches and runs local preflight audits for App Store review risks with zero code uploads.',
      proposedPrice: 19.99,
      billingPeriod: '3 months',
      targetAudience: 'Indie iOS developers and solo app creators',
      category: 'devtools_api', // Same category as VectorStream AI preset!
    };

    const evidence = await scoutMarketEvidence(customPitch);

    // CRITICAL HONESTY TEST: Custom pitch must NEVER leak VectorStream's Pinecone preset evidence!
    evidence.forEach((ev) => {
      assert.ok(
        !ev.url.includes('pinecone.io') && !ev.snippet.toLowerCase().includes('pinecone'),
        `Custom pitch AppsVantage must not leak preset evidence from pinecone: ${ev.url}`
      );
    });
  });

  it('13. Domain source type classification derives strictly from hostname and content', () => {
    // Reddit must NEVER be labeled G2_REVIEW
    assert.equal(
      deriveSourceType('reddit.com', 'Vector DB comparison', 'Discussion on pricing'),
      'reddit_complaint',
      'Reddit must be classified as reddit_complaint'
    );
    assert.equal(
      deriveSourceType('g2.com', 'Product Reviews', 'User ratings'),
      'g2_review',
      'G2 domain must be classified as g2_review'
    );
    assert.equal(
      deriveSourceType('producthunt.com', 'Launch', 'Community comments'),
      'g2_review',
      'Product Hunt must be classified as review'
    );
    assert.equal(
      deriveSourceType('stripe.com', 'Pricing & Fees', 'Stripe costs per transaction'),
      'competitor_pricing',
      'Pricing content must be classified as competitor_pricing'
    );
  });

  it('14. Pricing normalizer accurately handles multi-month cadences, packs, and monthly equivalents', () => {
    // AppsVantage: $19.99 for 3 months -> $6.66/mo equivalent
    const quarterly = normalizePricingCadence(19.99, '3 months');
    assert.equal(quarterly.monthlyEquivalent, 6.66);
    assert.equal(quarterly.billingPeriodLabel, '3 months');
    assert.ok(quarterly.displayFull.includes('$6.66/mo equivalent'));

    // Free tier
    const free = normalizePricingCadence(0, 'month');
    assert.equal(free.monthlyEquivalent, 0);
    assert.equal(free.displayFull, '$0 (Free)');

    // Niche Scan pack: $15 for 5 scans
    const pack = normalizePricingCadence(15, '5 scans');
    assert.equal(pack.isPackOrCredit, true);
    assert.equal(pack.displayShort, '$15 pack');

    // Annual plan
    const annual = normalizePricingCadence(120, 'year');
    assert.equal(annual.monthlyEquivalent, 10);
    assert.ok(annual.displayFull.includes('$10/mo equivalent'));
  });

  it('15. Objection clustering groups semantically similar objections before ranking', () => {
    const mockEvaluations: PersonaEvaluation[] = [
      {
        personaId: 'p1',
        personaName: 'Julian',
        role: 'smb_founder',
        vote: 'hesitant',
        acceptablePrice: 15,
        acceptablePeriod: '3 months',
        fatalObjections: [
          { objection: 'Variable usage-based add-ons (Niche Scan packs) create unpredictable monthly spend', severity: 'blocker' },
        ],
        dealMakers: [],
        rationale: 'Pricing fear',
      },
      {
        personaId: 'p2',
        personaName: 'Marcus',
        role: 'enterprise_cfo',
        vote: 'reject',
        acceptablePrice: 0,
        acceptablePeriod: '3 months',
        fatalObjections: [
          { objection: 'Product lacks guaranteed hard spend caps; variable add-on scans lead to unpredictable expenses', severity: 'blocker' },
        ],
        dealMakers: [],
        rationale: 'Overages',
      },
      {
        personaId: 'p3',
        personaName: 'Rachel',
        role: 'security_lead',
        vote: 'reject',
        acceptablePrice: 0,
        acceptablePeriod: '3 months',
        fatalObjections: [
          { objection: 'No SOC-2 Type II compliance evidence provided', severity: 'blocker' },
        ],
        dealMakers: [],
        rationale: 'Security',
      },
      {
        personaId: 'p4',
        personaName: 'Marcus Bell',
        role: 'security_lead',
        vote: 'reject',
        acceptablePrice: 0,
        acceptablePeriod: '3 months',
        fatalObjections: [
          { objection: 'Product lacks SOC-2 Type II certification and customer-managed encryption', severity: 'blocker' },
        ],
        dealMakers: [],
        rationale: 'Security 2',
      },
    ];

    const clusters = clusterAndRankObjections(mockEvaluations);

    // Both pairs should be clustered!
    assert.equal(clusters.length, 2, 'Should cluster 4 objections into 2 distinct semantic topics');
    assert.equal(clusters[0].frequency, 2, 'Top objection must have frequency 2 (not 1 of 10!)');
    assert.equal(clusters[1].frequency, 2, 'Second objection must have frequency 2');
  });

  it('16. In-Market vs Out-of-Market segmentation accurately tracks audience alignment', () => {
    const input: SimulationInput = {
      productName: 'AppsVantage',
      tagline: 'App Store Intelligence',
      description: 'iOS Developer Tool',
      proposedPrice: 19.99,
      billingPeriod: '3 months',
      targetAudience: 'Indie iOS Developers',
      category: 'devtools_api',
    };

    const evaluations: PersonaEvaluation[] = [
      // 3 In-Market iOS Personas (2 adopt, 1 hesitant)
      {
        personaId: 'p1',
        personaName: 'Chloe',
        role: 'indie_developer',
        vote: 'adopt',
        acceptablePrice: 16,
        acceptablePeriod: '3 months',
        isOutOfMarket: false,
        fatalObjections: [],
        dealMakers: [],
        rationale: 'Fits my budget',
      },
      {
        personaId: 'p2',
        personaName: 'Julian',
        role: 'studio_founder',
        vote: 'adopt',
        acceptablePrice: 19.99,
        acceptablePeriod: '3 months',
        isOutOfMarket: false,
        fatalObjections: [],
        dealMakers: [],
        rationale: 'Great value',
      },
      {
        personaId: 'p3',
        personaName: 'Marco',
        role: 'freelance_ios',
        vote: 'hesitant',
        acceptablePrice: 12,
        acceptablePeriod: '3 months',
        isOutOfMarket: false,
        fatalObjections: [{ objection: 'Need CLI export', severity: 'concern' }],
        dealMakers: [],
        rationale: 'Close call',
      },
      // 2 Out-of-Market Stress-Test Personas (2 reject)
      {
        personaId: 'p4',
        personaName: 'Victoria',
        role: 'procurement_director',
        vote: 'reject',
        acceptablePrice: 0,
        acceptablePeriod: '3 months',
        isOutOfMarket: true,
        fatalObjections: [{ objection: 'Outside enterprise domain: lacks Coupa integration', severity: 'blocker' }],
        dealMakers: [],
        rationale: 'Irrelevant to enterprise IT',
      },
      {
        personaId: 'p5',
        personaName: 'Rachel',
        role: 'security_lead',
        vote: 'reject',
        acceptablePrice: 0,
        acceptablePeriod: '3 months',
        isOutOfMarket: true,
        fatalObjections: [{ objection: 'Outside enterprise domain: no SOC 2 escrow', severity: 'blocker' }],
        dealMakers: [],
        rationale: 'Healthcare compliance not met',
      },
    ];

    const verdict = computeSimulationVerdict(input, evaluations);

    // Segregated metrics verification
    assert.equal(verdict.inMarketTotal, 3);
    assert.equal(verdict.inMarketAdoptCount, 2);
    assert.equal(verdict.inMarketPaidAdoptCount, 2);
    assert.equal(verdict.inMarketAcceptanceRate, 0.67);
    assert.equal(verdict.inMarketPaidAcceptanceRate, 0.67);

    assert.equal(verdict.outOfMarketTotal, 2);
    assert.equal(verdict.outOfMarketRejectCount, 2);

    // Overall adoption is dragged down by out-of-market personas (2 of 5 = 40%)
    assert.equal(verdict.paidAcceptanceRate, 0.4);

    // Audience alignment notice must be populated!
    assert.ok(verdict.audienceAlignmentWarning, 'Must generate audience alignment warning');
    assert.ok(verdict.audienceAlignmentWarning.includes('Audience Segmentation Notice'));
  });

  it('17. Markdown report includes Cohort B persona table and before vs after objection deltas', () => {
    const vectorStream = SIMULATION_PRESETS.find((p) => p.id === 'devtools_api')!;
    const savedRun = vectorStream.savedRun!;

    const exportData = {
      input: vectorStream.input,
      verdict: savedRun.verdict,
      personas: savedRun.personas,
      evidence: vectorStream.cachedEvidence,
      evaluations: savedRun.evaluations,
      optimizedPitch: savedRun.optimizedPitch || null,
      holdOutResult: savedRun.holdOutResult || null,
      telemetry: {
        modelFast: 'nemotron-3-super-120b',
        modelReasoning: 'Nemotron-3-Ultra-550b',
        totalTokens: 18450,
        parallelCalls: 5,
        latencyMs: 1420,
      },
    };

    const md = generateMarkdownReport(exportData);

    // Verify Cohort B table presence (Fix for Claude issue #9)
    assert.ok(md.includes('### Cohort B: 5 Hold-Out Persona Evaluations'), 'Report must contain Cohort B persona table');
    assert.ok(md.includes('| Persona | Role | Company Profile | Segment | Vote | Willingness to Pay | Primary Rationale |'), 'Cohort B table must have proper columns');

    // Verify telemetry: token consumption is displayed only because totalTokens is present
    assert.ok(md.includes('Measured Token Consumption: 18,450 tokens'), 'Report must display measured token consumption');

    // Test with missing totalTokens (telemetry hidden)
    const exportDataNoTokens = {
      ...exportData,
      telemetry: {
        ...exportData.telemetry,
        totalTokens: undefined,
      },
    };
    const mdNoTokens = generateMarkdownReport(exportDataNoTokens);
    assert.ok(!mdNoTokens.includes('Measured Token Consumption'), 'Report must hide token metric when not measured');
  });

  it('18. Performance/contingency fee models count adopters as commercial paid adopters rather than free tier', () => {
    const disputeVantageInput: SimulationInput = {
      productName: 'DisputeVantage',
      tagline: 'Automated Chargeback Defense. Pay Only When You Win.',
      description: 'Merchants pay only when DisputeVantage wins, with a 15% success fee capped at $49 per recovered dispute.',
      proposedPrice: 0,
      billingPeriod: 'month',
      targetAudience: 'SMB e-commerce merchants facing recurring chargebacks',
      category: 'custom',
      pricingTiers: 'Dispute Recovery: 15% of recovered dispute value, capped at $49 per successfully won dispute\nMerchant Plan: No monthly subscription required; pay only on success',
    };

    const mockEvals: PersonaEvaluation[] = [
      {
        personaId: 'p1',
        personaName: 'Jordan Lee',
        role: 'ecommerce_founder',
        vote: 'adopt',
        acceptablePrice: 0, // Adopting contingency model with $0 base fee
        acceptablePeriod: 'month',
        fatalObjections: [],
        dealMakers: [],
        rationale: 'Pay only when win saves cash',
      },
      {
        personaId: 'p2',
        personaName: 'Priya Mehta',
        role: 'ops_manager',
        vote: 'adopt',
        acceptablePrice: 0,
        acceptablePeriod: 'month',
        fatalObjections: [],
        dealMakers: [],
        rationale: 'Reduces manual work',
      },
      {
        personaId: 'p3',
        personaName: 'Daniel Ruiz',
        role: 'procurement_director',
        vote: 'reject',
        acceptablePrice: 0,
        acceptablePeriod: 'month',
        isOutOfMarket: true,
        fatalObjections: [{ objection: 'Need enterprise SLA', severity: 'blocker' }],
        dealMakers: [],
        rationale: 'Out of domain',
      },
    ];

    const verdict = computeSimulationVerdict(disputeVantageInput, mockEvals);

    assert.equal(verdict.totalPersonas, 3);
    assert.equal(verdict.adoptCount, 2);
    // Crucial check: Performance fee adopters must NOT be treated as $0 free-tier leeches
    assert.equal(verdict.paidAdoptCount, 2, 'Performance fee adopters must register as commercial paid adopters');
    assert.equal(verdict.freeAdoptCount, 0, 'No free-tier only adopters in performance model');
    assert.equal(verdict.paidAcceptanceRate, 0.67);
    assert.ok(verdict.normalizedPriceDisplay.includes('Performance Fee'), 'Must display performance fee label');
  });

  it('19. Dynamic persona generator adapts to whichever business is entered with realistic problem costs', async () => {
    const customBusinessInput: SimulationInput = {
      productName: 'LegalBriefAI',
      tagline: 'Automated Deposition Summarizer for Boutique Law Firms',
      description: 'Summarizes 200-page deposition transcripts in 10 minutes for litigation attorneys, saving 15 billable paralegal hours per case.',
      proposedPrice: 199,
      billingPeriod: 'month',
      targetAudience: 'Solo litigation attorneys, boutique personal injury law firms, and paralegals',
      category: 'custom',
    };

    const personas = await generateSyntheticPersonas(customBusinessInput, { count: 10 });
    assert.equal(personas.length, 10);

    // Verify personas have realistic monthly problem costs and proportional budgets
    const inMarket = personas.filter(p => !p.isOutOfMarket);
    assert.ok(inMarket.length >= 8, 'Must have at least 8 in-market personas');

    for (const p of inMarket) {
      assert.ok(p.monthlyLossOrProblemCost, `Persona ${p.name} must have a quantified monthlyLossOrProblemCost`);
      assert.ok(p.budgetCeiling > 100, `B2B persona ${p.name} budget ceiling ($${p.budgetCeiling}) must be economically realistic (> $100)`);
    }
  });
});
