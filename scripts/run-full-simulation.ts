import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { SimulationInput } from '../src/core/synthetic-lab/types';
import { scoutMarketEvidence } from '../src/core/synthetic-lab/market-scout';
import { generateSyntheticPersonas } from '../src/core/synthetic-lab/persona-generator';
import { evaluatePersonaReaction, computeSimulationVerdict } from '../src/core/synthetic-lab/simulation-engine';
import { optimizeProductPitch } from '../src/core/synthetic-lab/optimizer';
import { executeHoldOutRetest } from '../src/core/synthetic-lab/holdout-retest';

async function runLiveSimulation() {
  console.log('\n======================================================================');
  console.log('  SYNTHETICLAB: COMPLETE LIVE END-TO-END VERIFICATION RUN');
  console.log('  Models: Nebius Token Factory (Ultra 550B & Super 120B) | Web: Tavily');
  console.log('======================================================================\n');

  const testInput: SimulationInput = {
    productName: 'VectorStream AI',
    tagline: 'Sub-10ms Serverless Vector Search for Autonomous Agents',
    description:
      'Zero-cold-start, high-throughput vector retrieval engine optimized for agent memory pipelines. Billed strictly per 1,000 queries with guaranteed 99.99% uptime and zero infrastructure management.',
    proposedPrice: 40,
    billingPeriod: 'month',
    targetAudience: 'Backend AI engineers, agent developers, and tech leads managing RAG workloads',
    category: 'devtools_api',
  };

  console.log('1. STAGE 1: Grounding Market Evidence via Tavily Search API...');
  const t0 = Date.now();
  const evidence = await scoutMarketEvidence(testInput);
  console.log(`✓ Retrieved ${evidence.length} verified market sources in ${Date.now() - t0}ms:`);
  evidence.forEach((e, i) => {
    console.log(`   [#${i + 1}] (${e.sourceType}) ${e.title}`);
    console.log(`       URL: ${e.url}`);
    console.log(`       Snippet: "${e.snippet.substring(0, 110)}..."`);
  });

  console.log('\n2. STAGE 2: Spawning Heterogeneous Persona Swarm (Cohort A)...');
  const t1 = Date.now();
  const personas = await generateSyntheticPersonas(testInput, { count: 5 });
  console.log(`✓ Formulated ${personas.length} personas in ${Date.now() - t1}ms:`);
  personas.forEach((p, i) => {
    console.log(`   [Buyer #${i + 1}] ${p.name} | ${p.title} (${p.companyProfile})`);
    console.log(`       Budget: $${p.budgetCeiling}/${p.budgetPeriod} | Risk: ${p.riskTolerance}`);
    console.log(`       Primary Constraint: "${p.primaryConstraint}"`);
  });

  console.log('\n3. STAGE 3: Executing Adversarial Procurement Arena (Cohort A)...');
  const t2 = Date.now();
  const evaluations = await Promise.all(
    personas.map(async (persona) => {
      const evaluation = await evaluatePersonaReaction(testInput, persona, evidence);
      console.log(`   -> [${persona.name} (${persona.role})]: Voted "${evaluation.vote.toUpperCase()}" (WTP: $${evaluation.acceptablePrice})`);
      if (evaluation.fatalObjections.length > 0) {
        console.log(`      Objection: "${evaluation.fatalObjections[0].objection}"`);
      }
      return evaluation;
    })
  );
  console.log(`✓ Arena review completed in ${Date.now() - t2}ms.`);

  console.log('\n4. STAGE 4: Computing Empirical Verdict...');
  const verdict = computeSimulationVerdict(testInput, evaluations);
  console.log(`   Total Personas: ${verdict.totalPersonas}`);
  console.log(`   Adoption Rate:  ${(verdict.acceptanceRate * 100).toFixed(0)}% (${verdict.adoptCount} adopt / ${verdict.rejectCount} reject / ${verdict.hesitantCount} hesitant)`);
  console.log(`   Median WTP:     $${verdict.priceRange.median}/${verdict.priceRange.period} (Range: $${verdict.priceRange.min} - $${verdict.priceRange.max})`);
  console.log('   Top Ranked Fatal Objections:');
  verdict.topObjections.forEach((obj, idx) => {
    console.log(`     #${idx + 1} [${obj.severity.toUpperCase()}] (Freq: ${obj.frequency}): "${obj.objection}"`);
  });

  console.log('\n5. STAGE 5: Autonomous Pitch & Terms Optimization via Nemotron 3 Ultra 550B...');
  const t3 = Date.now();
  const optimizedPitch = await optimizeProductPitch(testInput, verdict, evidence);
  console.log(`✓ Nemotron 3 Ultra completed strategic rewrite in ${Date.now() - t3}ms:`);
  console.log(`   Revised Tagline:     "${optimizedPitch.revisedTagline}"`);
  console.log(`   Calibrated Pricing:  $${optimizedPitch.calibratedPrice}/${optimizedPitch.calibratedPeriod}`);
  console.log(`   Packaging Fix:       "${optimizedPitch.packagingFix}"`);
  console.log(`   Revised Pitch:       "${optimizedPitch.revisedDescription}"`);
  console.log('   Countermeasures:');
  optimizedPitch.objectionCountermeasures.forEach((c) => {
    console.log(`     - Target: "${c.targetObjection}"`);
    console.log(`       Fix:    "${c.countermeasure}"`);
  });

  console.log('\n6. STAGE 6: Hold-Out Panel Retest (Cohort B - Zero Prior Exposure)...');
  const t4 = Date.now();
  const holdOutResult = await executeHoldOutRetest(optimizedPitch, verdict, evidence, personas, (ev) => {
    console.log(`   -> [Holdout Buyer: ${ev.personaName} (${ev.role})]: Voted "${ev.vote.toUpperCase()}" (WTP: $${ev.acceptablePrice})`);
  });
  console.log(`✓ Hold-Out evaluation completed in ${Date.now() - t4}ms.`);

  console.log('\n======================================================================');
  console.log('  FINAL VERIFICATION SCORECARD: BEFORE vs. AFTER');
  console.log('======================================================================');
  console.log(`  Initial Adoption (Cohort A):  ${(holdOutResult.initialAcceptanceRate * 100).toFixed(0)}%`);
  console.log(`  Hold-Out Adoption (Cohort B): ${(holdOutResult.holdOutAcceptanceRate * 100).toFixed(0)}%`);
  console.log(`  Indicative Adoption Spread:   [${(holdOutResult.acceptanceRateSpread.min * 100).toFixed(0)}% – ${(holdOutResult.acceptanceRateSpread.max * 100).toFixed(0)}%]`);
  console.log(`  Initial Median WTP:           $${holdOutResult.initialMedianPrice}`);
  console.log(`  Hold-Out Median WTP:          $${holdOutResult.holdOutMedianPrice}`);
  console.log(`  Indicative Price Spread:      $${holdOutResult.priceSpread.min} – $${holdOutResult.priceSpread.max}`);
  console.log(`  Resolved Objections:          ${holdOutResult.resolvedObjectionsCount} of ${holdOutResult.totalInitialObjections} neutralized`);
  console.log(`  Anti-Circular Verification:   ${holdOutResult.isHoldOutVerified ? '✓ CONFIRMED (Zero Cohort Overlap)' : 'FAILED'}`);
  console.log(`  Summary: ${holdOutResult.deltaSummary}`);
  console.log('======================================================================\n');
}

runLiveSimulation().catch(console.error);
