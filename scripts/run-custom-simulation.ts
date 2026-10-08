import * as fs from 'fs';
import * as path from 'path';
import { SimulationInput, GroundedEvidence } from '../src/core/synthetic-lab/types';
import { generateSyntheticPersonas } from '../src/core/synthetic-lab/persona-generator';
import { scoutMarketEvidence } from '../src/core/synthetic-lab/market-scout';
import { generateCompetitiveBattlecard } from '../src/core/synthetic-lab/battlecard-generator';
import { evaluatePersonaReaction, computeSimulationVerdict } from '../src/core/synthetic-lab/simulation-engine';
import { optimizeProductPitch } from '../src/core/synthetic-lab/optimizer';
import { executeHoldOutRetest } from '../src/core/synthetic-lab/holdout-retest';
import { generateJsonExport } from '../src/core/synthetic-lab/report-exporter';
import { NebiusNemotronProvider } from '../src/core/ai/nebius';

async function runCustomSimulation() {
  const startTime = Date.now();
  console.log('======================================================================');
  console.log('🚀 RUNNING FULL SYNTHETICLAB SIMULATION ON CUSTOM INPUT');
  console.log('======================================================================\n');

  // Custom Input: Real production-grade B2B infrastructure software
  const input: SimulationInput = {
    productName: 'ApexRelay',
    tagline: 'High-Concurrency Outbound Webhook Delivery Engine with Guaranteed Zero-Loss Delivery',
    description: 'Serverless outbound webhook dispatcher that delivers up to 100,000 webhooks/sec with automatic HMAC-SHA256 signing, exponential backoff retries, dead-letter storage, and self-hosted SOC-2 compliance for SaaS and Fintech platforms.',
    proposedPrice: 89,
    billingPeriod: 'month',
    targetAudience: 'Fintech and SaaS CTOs, Platform Architects, and Lead Backend Engineers',
    category: 'devtools_api',
  };

  console.log(`📦 Product: ${input.productName}`);
  console.log(`   Tagline: ${input.tagline}`);
  console.log(`   Proposed Price: $${input.proposedPrice}/${input.billingPeriod}`);
  console.log(`   Target Market: ${input.targetAudience}\n`);

  // 1. Spawning Personas (Cohort A)
  console.log('1. Spawning 5 distinct practitioner personas across matched decision-maker roles...');
  const personas = await generateSyntheticPersonas(input, { count: 5 });
  personas.forEach((p, i) => {
    console.log(`   [Persona #${i + 1}] ${p.name} - ${p.title} (${p.companyProfile})`);
    console.log(`     Problem Cost: ${p.monthlyLossOrProblemCost}`);
    console.log(`     Constraint: ${p.primaryConstraint}`);
  });

  // 2. Scouting Market Evidence (Tavily Search API)
  console.log('\n2. Scouting live competitor pricing and market friction via Tavily Search API...');
  const evidence: GroundedEvidence[] = await scoutMarketEvidence(input);
  console.log(`   Retrieved ${evidence.length} verified market evidence citations.`);

  // 3. Synthesizing Competitive Battlecard Matrix
  console.log('\n3. Synthesizing competitive battlecard matrix across market incumbents...');
  const battlecard = await generateCompetitiveBattlecard(input, evidence);
  if (battlecard && battlecard.competitors) {
    battlecard.competitors.forEach((c) => {
      console.log(`   • ${c.name} (${c.pricingModel}): Friction: "${c.hiddenTrapOrFriction}"`);
    });
  }

  // 4. Adversarial Procurement Committee Review
  console.log('\n4. Executing adversarial procurement committee review across Cohort A...');
  const evaluations = await Promise.all(
    personas.map(async (p) => {
      const ev = await evaluatePersonaReaction(input, p, evidence, {
        battlecard: battlecard || undefined,
      });
      console.log(`   • ${p.name} (${p.title}): Voted "${ev.vote.toUpperCase()}" (WTP: $${ev.acceptablePrice}/mo)`);
      if (ev.fatalObjections.length > 0) {
        console.log(`     Objection: "${ev.fatalObjections[0].objection}"`);
      }
      return ev;
    })
  );

  // 5. Empirical Verdict
  console.log('\n5. Computing empirical verdict and price sensitivity spread...');
  const verdict = computeSimulationVerdict(input, evaluations);
  console.log(`   Acceptance Rate: ${Math.round(verdict.acceptanceRate * 100)}% (${verdict.adoptCount} adopt, ${verdict.hesitantCount} hesitant, ${verdict.rejectCount} reject)`);
  console.log(`   Paid Acceptance Rate: ${Math.round(verdict.paidAcceptanceRate * 100)}%`);
  console.log(`   Median Willingness to Pay: $${verdict.priceRange.median}/mo (Range: $${verdict.priceRange.min} - $${verdict.priceRange.max})`);

  // 6. Pitch & Packaging Optimization (Nemotron Ultra)
  console.log('\n6. Optimizing pitch and packaging countermeasures via Nemotron Ultra...');
  const optimizedPitch = await optimizeProductPitch(input, verdict, evidence);
  console.log(`   Revised Tagline: "${optimizedPitch.revisedTagline}"`);
  console.log(`   Calibrated Price: $${optimizedPitch.calibratedPrice}/${optimizedPitch.calibratedPeriod}`);
  console.log(`   Packaging Fix: "${optimizedPitch.packagingFix}"`);

  // 7. Anti-Circular Hold-Out Retest (Cohort B)
  console.log('\n7. Executing Hold-Out Retest on fresh mirrored Cohort B panel...');
  const holdOutResult = await executeHoldOutRetest(optimizedPitch, verdict, evidence, personas);
  console.log(`   Initial Paid Adoption: ${Math.round(holdOutResult.initialPaidAcceptanceRate * 100)}% → Hold-Out Paid Adoption: ${Math.round(holdOutResult.holdOutPaidAcceptanceRate * 100)}%`);
  console.log(`   Verification Summary: "${holdOutResult.deltaSummary}"`);

  // 8. Generate Full Export JSON
  const latencyMs = Date.now() - startTime;
  const exportData = {
    input,
    verdict,
    personas,
    evidence,
    evaluations,
    optimizedPitch,
    holdOutResult,
    battlecard,
    telemetry: {
      modelFast: process.env.NEBIUS_FAST_MODEL_ID || 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B',
      modelReasoning: process.env.NVIDIA_MODEL_ID || 'nvidia/nemotron-3-super-120b-a12b',
      parallelCalls: personas.length * 2,
      latencyMs,
    },
    exportedAt: new Date().toISOString(),
  };

  const jsonString = generateJsonExport(exportData);
  const outputPath = path.resolve(process.cwd(), 'custom-input-run-exported.json');
  fs.writeFileSync(outputPath, jsonString, 'utf-8');

  console.log('\n======================================================================');
  console.log(`✅ SIMULATION COMPLETE: Full Exported JSON saved to:`);
  console.log(`   ${outputPath}`);
  console.log('======================================================================');
}

runCustomSimulation().catch((err) => {
  console.error('Custom simulation failed:', err);
  process.exit(1);
});
