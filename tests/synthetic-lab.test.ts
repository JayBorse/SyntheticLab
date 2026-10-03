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
} from '../src/core/synthetic-lab/semantic-matcher';
import { checkSimulationRateLimit } from '../src/core/security/rate-limiter';

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

  it('4. Persona synthesis produces symmetric paired roles across panels', async () => {
    const input: SimulationInput = {
      productName: 'TestApp',
      tagline: 'App',
      description: 'Desc',
      proposedPrice: 50,
      billingPeriod: 'month',
      targetAudience: 'Devs',
      category: 'devtools_api',
    };

    // Generate 10 personas for Cohort A and Cohort B
    const cohortA = await generateSyntheticPersonas(input, { count: 10, isHoldOut: false });
    const namesA = new Set(cohortA.map((p) => p.name.toLowerCase()));
    const cohortB = await generateSyntheticPersonas(input, { count: 10, isHoldOut: true, excludeNames: namesA });

    assert.equal(cohortA.length, 10, 'Cohort A must have 10 personas');
    assert.equal(cohortB.length, 10, 'Cohort B must have 10 personas');

    // Verify key decision-maker roles are present in both
    const rolesA = new Set(cohortA.map((p) => p.role));
    const rolesB = new Set(cohortB.map((p) => p.role));

    assert.ok(rolesA.has('enterprise_cfo'), 'Cohort A must have enterprise_cfo');
    assert.ok(rolesA.has('staff_engineer'), 'Cohort A must have staff_engineer');
    assert.ok(rolesA.has('security_lead'), 'Cohort A must have security_lead');
    assert.ok(rolesA.has('smb_founder'), 'Cohort A must have smb_founder');

    assert.ok(rolesB.has('enterprise_cfo'), 'Cohort B must have enterprise_cfo');
    assert.ok(rolesB.has('staff_engineer'), 'Cohort B must have staff_engineer');
    assert.ok(rolesB.has('security_lead'), 'Cohort B must have security_lead');
    assert.ok(rolesB.has('smb_founder'), 'Cohort B must have smb_founder');

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
});
