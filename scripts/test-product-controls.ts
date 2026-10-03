import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { SimulationInput } from '../src/core/synthetic-lab/types';
import { scoutMarketEvidence } from '../src/core/synthetic-lab/market-scout';
import { generateSyntheticPersonas } from '../src/core/synthetic-lab/persona-generator';
import { evaluatePersonaReaction, computeSimulationVerdict } from '../src/core/synthetic-lab/simulation-engine';

interface ControlProduct {
  type: 'negative_control' | 'positive_control' | 'historical_benchmark';
  label: string;
  input: SimulationInput;
  expectedBehavior: string;
}

const CONTROL_PRODUCTS: ControlProduct[] = [
  {
    type: 'negative_control',
    label: 'Negative Control: VaporTask AI (Overpriced, Low Utility)',
    input: {
      productName: 'VaporTask AI',
      tagline: 'Daily 3-Bullet AI Task Summarizer for Solopreneurs',
      description:
        'A wrapper script that reads your unread Gmail inbox each morning and produces 3 bullet points of suggested tasks. No integrations, no calendar sync, billed monthly with zero refund policy.',
      proposedPrice: 600,
      billingPeriod: 'month',
      targetAudience: 'Solo founders, freelancers, and indie creators',
      category: 'custom',
    },
    expectedBehavior: 'Expect near-zero adoption (~0%), harsh pricing rejections, and low willingness to pay.',
  },
  {
    type: 'positive_control',
    label: 'Positive Control: AuditPulse (High Value, Fair Pricing, Clear Pain Point)',
    input: {
      productName: 'AuditPulse Continuous Compliance',
      tagline: 'Automated SOC-2 & ISO-27001 Evidence Collection for AWS & GCP',
      description:
        'Connect your AWS, GCP, and GitHub in 5 minutes via read-only IAM roles. Automatically maps IAM policies, encryption at rest, and audit logs into live SOC-2 Type II auditor evidence packages. Includes 14-day free trial, cancel anytime.',
      proposedPrice: 199,
      billingPeriod: 'month',
      targetAudience: 'B2B SaaS CTOs, VP Engineering, and Head of Information Security',
      category: 'security_cloud',
    },
    expectedBehavior: 'Expect high commercial adoption (>50-70%), positive willingness to pay matching price point.',
  },
  {
    type: 'historical_benchmark',
    label: 'Historical Benchmark: EngineX Runtime Fee (Anonymized Unity Backlash)',
    input: {
      productName: 'EngineX Game Platform',
      tagline: 'Retroactive $0.20 Per-Install Fee for All Shipped Titles',
      description:
        'Game developers must pay $0.20 every time their game is installed past initial thresholds. Installs tracked via proprietary black-box runtime telemetry with no exemption for repeat installs or charity bundles.',
      proposedPrice: 200,
      billingPeriod: 'month',
      targetAudience: 'Indie game developers, studio CTOs, and mobile free-to-play publishers',
      category: 'anonymized_benchmark',
    },
    expectedBehavior: 'Expect overwhelming rejection (>80%), citing install-bombing, piracy risk, and contract trust breach.',
  },
];

async function runControls() {
  console.log('\n======================================================================');
  console.log('  SYNTHETICLAB MULTI-PRODUCT CONTROL SUITE');
  console.log('  Testing Discrimination Power: Negative Control vs. Positive Control vs. Benchmark');
  console.log('======================================================================\n');

  for (const control of CONTROL_PRODUCTS) {
    console.log(`\n>>> TESTING: ${control.label}`);
    console.log(`    Expected: ${control.expectedBehavior}`);
    console.log(`    Product: ${control.input.productName} at $${control.input.proposedPrice}/${control.input.billingPeriod}`);

    const t0 = Date.now();
    // 1. Scout evidence (or quick fallback)
    const evidence = await scoutMarketEvidence(control.input);

    // 2. Generate 6 representative personas
    const personas = await generateSyntheticPersonas(control.input, { count: 6 });

    // 3. Evaluate each persona
    const evaluations = await Promise.all(
      personas.map((persona) => evaluatePersonaReaction(control.input, persona, evidence))
    );

    // 4. Compute empirical verdict
    const verdict = computeSimulationVerdict(control.input, evaluations);
    const duration = Date.now() - t0;

    console.log(`    Results (${duration}ms):`);
    console.log(`    - Overall Adoption:      ${(verdict.acceptanceRate * 100).toFixed(0)}% (${verdict.adoptCount}/${verdict.totalPersonas})`);
    console.log(`    - Paid Commercial Rate:  ${(verdict.paidAcceptanceRate * 100).toFixed(0)}% (${verdict.paidAdoptCount}/${verdict.totalPersonas})`);
    console.log(`    - Rejections:            ${verdict.rejectCount}/${verdict.totalPersonas}`);
    console.log(`    - Hesitations:           ${verdict.hesitantCount}/${verdict.totalPersonas}`);
    console.log(`    - Median WTP:            $${verdict.priceRange.median}/${verdict.priceRange.period} (Proposed: $${control.input.proposedPrice})`);
    console.log(`    - Top Objections:`);
    verdict.topObjections.slice(0, 2).forEach((o, i) => {
      console.log(`       #${i + 1} [${o.severity.toUpperCase()}]: "${o.objection}"`);
    });

    // Verification check
    if (control.type === 'negative_control') {
      const isDiscriminated = verdict.acceptanceRate <= 0.20 && verdict.priceRange.median < control.input.proposedPrice * 0.2;
      console.log(`    ✓ NEGATIVE CONTROL VALIDATION: ${isDiscriminated ? 'PASSED (Rejected bad product as expected)' : 'UNEXPECTED HIGH SCORE'}`);
    } else if (control.type === 'positive_control') {
      const isAdopted = verdict.acceptanceRate >= 0.33;
      console.log(`    ✓ POSITIVE CONTROL VALIDATION: ${isAdopted ? 'PASSED (Recognized strong value & fair price)' : 'UNEXPECTED LOW SCORE'}`);
    } else if (control.type === 'historical_benchmark') {
      const isRejected = verdict.rejectCount >= 3;
      console.log(`    ✓ BENCHMARK VALIDATION:        ${isRejected ? 'PASSED (Reflected real-world developer backlash)' : 'UNEXPECTED COMPLACENCY'}`);
    }
  }

  console.log('\n======================================================================');
  console.log('  MULTI-PRODUCT CONTROL SUITE COMPLETE');
  console.log('======================================================================\n');
}

runControls().catch(console.error);
