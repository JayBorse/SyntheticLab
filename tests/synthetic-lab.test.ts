import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SIMULATION_PRESETS } from '../src/core/synthetic-lab/presets';
import { computeSimulationVerdict } from '../src/core/synthetic-lab/simulation-engine';
import { PersonaEvaluation, SimulationInput, SyntheticPersona } from '../src/core/synthetic-lab/types';

describe('SyntheticLab Core Architecture & Verification Suite', () => {
  it('1. Presets have complete inputs and pre-warmed Tavily market evidence', () => {
    assert.ok(SIMULATION_PRESETS.length >= 3, 'Must have at least 3 curated presets');
    SIMULATION_PRESETS.forEach((preset) => {
      assert.ok(preset.id, 'Preset must have an ID');
      assert.ok(preset.input.productName, 'Preset must have a productName');
      assert.ok(preset.cachedEvidence.length > 0, 'Preset must have pre-warmed Tavily evidence');
      preset.cachedEvidence.forEach((ev) => {
        assert.ok(ev.url.startsWith('http'), 'Evidence must have a valid URL');
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
        acceptablePrice: 30,
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

    // Price range: prices [30, 40, 50] -> min: 30, median: 40, max: 50
    assert.equal(verdict.priceRange.min, 30);
    assert.equal(verdict.priceRange.median, 40);
    assert.equal(verdict.priceRange.max, 50);

    // Top objections: 'Network latency overhead' appeared twice
    assert.equal(verdict.topObjections[0].objection, 'Network latency overhead');
    assert.equal(verdict.topObjections[0].frequency, 2);
  });

  it('3. Pre-Saved Demo Replay contains complete Cohort A and Cohort B verification', () => {
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
