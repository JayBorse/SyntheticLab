import { SimulationInput } from '../src/core/synthetic-lab/types';
import { generateSyntheticPersonas } from '../src/core/synthetic-lab/persona-generator';
import { scoutMarketEvidence } from '../src/core/synthetic-lab/market-scout';
import { evaluatePersonaReaction, computeSimulationVerdict } from '../src/core/synthetic-lab/simulation-engine';
import { optimizeProductPitch } from '../src/core/synthetic-lab/optimizer';
import { executeHoldOutRetest } from '../src/core/synthetic-lab/holdout-retest';
import { generateMarkdownReport } from '../src/core/synthetic-lab/report-exporter';
import { SIMULATION_PRESETS } from '../src/core/synthetic-lab/presets';

const TEST_PRODUCTS: { label: string; input: SimulationInput }[] = [
  // 1. Indie Developer Tool: AppsVantage
  {
    label: '1. Indie Developer Tool (AppsVantage)',
    input: {
      productName: 'AppsVantage',
      tagline: 'App Store Intelligence & Preflight for iOS Developers',
      category: 'devtools_api',
      targetAudience: 'Indie iOS developers, solo app founders, app studios, and small mobile teams',
      proposedPrice: 19.99,
      billingPeriod: '3 months',
      pricingTiers: `Preflight: $19.99 for 3 months (individual developers / founders)
Niche Scan: $15 for 5 scans
Niche Scan: $25 for 15 scans
Agency Studio: $45/month (agencies and teams)`,
      description:
        'An all-in-one App Store intelligence and preflight platform for iOS developers. Discover promising app niches, analyze competitors and user demand, and audit iOS builds for App Review and release risks before submission. Preflight runs locally with zero code uploads, helping developers catch costly issues before launch.',
    },
  },
  // 2. Consumer App: MindFlow
  {
    label: '2. Consumer App (MindFlow)',
    input: {
      productName: 'MindFlow',
      tagline: 'Personalized Daily Breathwork & Sleep Stories',
      category: 'custom',
      targetAudience: 'Everyday consumers, stressed knowledge workers, and sleep seekers',
      proposedPrice: 9.99,
      billingPeriod: 'month',
      pricingTiers: `Monthly: $9.99/month
Annual: $59.99/year ($5/mo equivalent)
Lifetime: $149 one-time`,
      description:
        'A distraction-free consumer wellness app offering 5-minute circadian breathwork sessions, heart rate coherence biometric tracking via phone camera, and immersive ambient sleep soundscapes. No dark patterns, easy one-tap cancellation, and zero advertising trackers.',
    },
  },
  // 3. Local Service Business: TableCraft
  {
    label: '3. Local Service Business (TableCraft)',
    input: {
      productName: 'TableCraft',
      tagline: 'Flat-Fee Online Table Reservations & Guest CRM',
      category: 'b2b_saas',
      targetAudience: 'Independent restaurant owners, bistro operators, and cafe managers',
      proposedPrice: 79,
      billingPeriod: 'month',
      pricingTiers: `Standard: $79/month flat (unlimited covers)
Multi-Location: $149/month (up to 3 venues)
SMS Reminder Add-On: $20 for 1,000 automated guest SMS`,
      description:
        'A modern table booking system for neighborhood dining spots that eliminates per-cover commissions (saving $800-$2,500/mo vs OpenTable). Features two-way Toast and Square POS sync, customizable automated SMS reminders to reduce no-shows by 40%, and simple iPad table layout management.',
    },
  },
  // 4. Infrastructure Preset: VectorStream AI
  {
    label: '4. Infrastructure Preset (VectorStream AI)',
    input: SIMULATION_PRESETS.find((p) => p.id === 'devtools_api')!.input,
  },
];

async function runTeardown(item: { label: string; input: SimulationInput }) {
  console.log(`\n======================================================================`);
  console.log(`RUNNING FULL PIPELINE FOR: ${item.label}`);
  console.log(`======================================================================\n`);

  const startTime = Date.now();
  const input = item.input;

  // 1. Spawning 10 Personas (extracts ICP, 8 in-market + 2 out-of-market stress tests)
  console.log(`[Stage 1] Generating 10 ICP-aligned personas...`);
  const personas = await generateSyntheticPersonas(input, { count: 10 });
  console.log(`Generated ${personas.length} personas:`);
  personas.forEach((p, idx) => {
    console.log(`  #${idx + 1}: ${p.name} (${p.role}) - ${p.title} [${p.isOutOfMarket ? 'OUT_OF_MARKET' : 'IN_MARKET'}]`);
  });

  // 2. Grounding Market Evidence
  console.log(`\n[Stage 2] Scouting market evidence...`);
  const evidence = await scoutMarketEvidence(input);
  console.log(`Gathered ${evidence.length} evidence citations:`);
  evidence.forEach((e) => {
    console.log(`  - [${e.sourceType}] ${e.domain}: "${e.title}" (${e.url})`);
  });

  // 3. Adversarial Arena
  console.log(`\n[Stage 3] Evaluating personas...`);
  const evaluations = await Promise.all(
    personas.map((p) => evaluatePersonaReaction(input, p, evidence))
  );

  // 4. Empirical Verdict
  console.log(`\n[Stage 4] Computing empirical verdict...`);
  const verdict = computeSimulationVerdict(input, evaluations);
  console.log(`Verdict: Paid Commercial Adoption = ${(verdict.paidAcceptanceRate * 100).toFixed(0)}%`);
  console.log(`In-Market Paid Adoption = ${(verdict.inMarketPaidAcceptanceRate * 100).toFixed(0)}% (${verdict.inMarketPaidAdoptCount}/${verdict.inMarketTotal})`);
  console.log(`Out-of-Market Rejections = ${verdict.outOfMarketRejectCount} of ${verdict.outOfMarketTotal}`);
  console.log(`Normalized Price = ${verdict.normalizedPriceDisplay}`);
  console.log(`Empirical Median WTP = $${verdict.priceRange.median}/${verdict.priceRange.period}`);
  console.log(`Top Fatal Objections:`);
  verdict.topObjections.forEach((o, i) => {
    console.log(`  #${i + 1} (${o.frequency} personas): "${o.objection}" [Sources: ${o.citedSources.join(', ') || 'None'}]`);
  });

  // 5. Optimizer
  console.log(`\n[Stage 5] Synthesizing optimized pitch...`);
  const optimizedPitch = await optimizeProductPitch(input, verdict, evidence);
  console.log(`Revised Tagline: "${optimizedPitch.revisedTagline}"`);
  console.log(`Calibrated Price: $${optimizedPitch.calibratedPrice}/${optimizedPitch.calibratedPeriod}`);
  console.log(`Packaging Fix: ${optimizedPitch.packagingFix}`);
  if (optimizedPitch.audienceAlignmentNotice) {
    console.log(`Audience Notice: ${optimizedPitch.audienceAlignmentNotice}`);
  }
  console.log(`Countermeasures:`);
  optimizedPitch.objectionCountermeasures.forEach((cm) => {
    console.log(`  - [${(cm.effort || 'low').toUpperCase()}] "${cm.targetObjection}" -> ${cm.countermeasure}`);
  });

  // 6. Hold-Out Retest
  console.log(`\n[Stage 6] Executing blinded Hold-Out Retest (Cohort B)...`);
  const holdOutResult = await executeHoldOutRetest(optimizedPitch, verdict, evidence, personas);
  console.log(`Hold-Out Result: Commercial Adoption = ${(holdOutResult.holdOutPaidAcceptanceRate * 100).toFixed(0)}%`);
  console.log(`Delta Summary: ${holdOutResult.deltaSummary}`);
  if (holdOutResult.objectionDeltas) {
    console.log(`Objection Trajectory:`);
    holdOutResult.objectionDeltas.forEach((d) => {
      console.log(`  - "${d.objectionTopic}": before=${d.beforeCount}, after=${d.afterCount} (${d.status.toUpperCase()})`);
    });
  }

  // 7. Full Markdown Report Export
  console.log(`\n[Stage 7] Generating Markdown Report...`);
  const mdReport = generateMarkdownReport({
    input,
    verdict,
    personas,
    evidence,
    evaluations,
    optimizedPitch,
    holdOutResult,
    telemetry: {
      modelFast: 'nemotron-3-nano-30b',
      modelReasoning: 'Nemotron-3-Ultra-550b',
      parallelCalls: personas.length,
      latencyMs: Date.now() - startTime,
    },
  });

  console.log(`\n----------------- FULL RAW EXPORT REPORT -----------------\n`);
  console.log(mdReport);
  console.log(`\n----------------- END OF REPORT -----------------\n`);

  return { label: item.label, verdict, holdOutResult, mdReport };
}

async function main() {
  for (const item of TEST_PRODUCTS) {
    try {
      await runTeardown(item);
    } catch (err) {
      console.error(`Failed to run teardown for ${item.label}:`, err);
    }
  }
}

main().catch(console.error);
