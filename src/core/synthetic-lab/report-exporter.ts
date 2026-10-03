import {
  SimulationInput,
  SimulationVerdict,
  SyntheticPersona,
  GroundedEvidence,
  PersonaEvaluation,
  OptimizedPitch,
  HoldOutRetestResult,
} from './types';

export interface SimulationExportData {
  input: SimulationInput;
  verdict: SimulationVerdict;
  personas: SyntheticPersona[];
  evidence: GroundedEvidence[];
  evaluations: PersonaEvaluation[];
  optimizedPitch: OptimizedPitch | null;
  holdOutResult: HoldOutRetestResult | null;
  telemetry: {
    modelFast: string;
    modelReasoning: string;
    totalTokens: number;
    parallelCalls: number;
    latencyMs: number;
  };
  exportedAt?: string;
}

/**
 * Generate a comprehensive, executive-ready Markdown teardown report
 */
export function generateMarkdownReport(data: SimulationExportData): string {
  const { input, verdict, personas, evidence, evaluations, optimizedPitch, holdOutResult, telemetry } = data;
  const exportedAt = data.exportedAt || new Date().toISOString();
  const dateStr = exportedAt.split('T')[0];

  const lines: string[] = [];

  // Header
  lines.push(`# SyntheticLab Procurement Teardown: ${input.productName}`);
  lines.push(`**Autonomous Buyer & Churn Simulation Arena Report**`);
  lines.push(`*Generated on ${dateStr} • Models: ${telemetry.modelReasoning} / ${telemetry.modelFast}*`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 1. Executive Summary & Verdict
  lines.push('## 1. Executive Procurement Verdict');
  lines.push('');
  lines.push(`| Metric | Empirical Finding | Notes |`);
  lines.push(`| :--- | :--- | :--- |`);
  lines.push(`| **Paid Commercial Adoption** | **${(verdict.paidAcceptanceRate * 100).toFixed(0)}%** | ${verdict.paidAdoptCount} of ${verdict.totalPersonas} personas willing to pay commercial price |`);
  lines.push(`| **Overall Adoption (incl. free)** | **${(verdict.acceptanceRate * 100).toFixed(0)}%** | ${verdict.adoptCount} adopt / ${verdict.rejectCount} reject / ${verdict.hesitantCount} hesitant |`);
  lines.push(`| **Free-Tier Only Adopters** | **${verdict.freeAdoptCount} personas** | Adopters with $0 WTP (strictly filtered from commercial revenue) |`);
  lines.push(`| **Proposed Baseline Price** | **$${input.proposedPrice}/${input.billingPeriod}** | Initial offer evaluated by buyer committee |`);
  lines.push(`| **Median Willingness to Pay** | **$${verdict.priceRange.median}/${verdict.priceRange.period}** | Empirical committee threshold |`);
  lines.push(`| **Price Resistance Spread** | **$${verdict.priceRange.min} – $${verdict.priceRange.max}** | Observed acceptable budget range |`);
  lines.push('');

  // 2. Product Pitch & Pricing Architecture
  lines.push('## 2. Tested Pitch & Pricing Architecture');
  lines.push('');
  lines.push(`- **Product Name:** ${input.productName}`);
  lines.push(`- **Tagline:** ${input.tagline}`);
  lines.push(`- **Category:** ${input.category.replace('_', ' ').toUpperCase()}`);
  lines.push(`- **Target ICP:** ${input.targetAudience}`);
  lines.push(`- **Baseline Price:** $${input.proposedPrice}/${input.billingPeriod}`);
  lines.push(`- **Product Description:** ${input.description}`);
  if (input.pricingTiers) {
    lines.push('');
    lines.push(`### Multi-Tier Packaging Breakdown:`);
    lines.push('```text');
    lines.push(input.pricingTiers.trim());
    lines.push('```');
  }
  lines.push('');

  // 3. Top Fatal Objections & Grounded Competitor Evidence
  lines.push('## 3. Fatal Objections & Grounded Market Evidence');
  lines.push('');
  if (verdict.topObjections && verdict.topObjections.length > 0) {
    verdict.topObjections.forEach((obj, idx) => {
      lines.push(`### Objection #${idx + 1} [${obj.severity.toUpperCase()}]: "${obj.objection}"`);
      lines.push(`- **Frequency:** Cited by **${obj.frequency}** of ${verdict.totalPersonas} personas`);
      if (obj.citedSources && obj.citedSources.length > 0) {
        lines.push(`- **Cited Sources:** ${obj.citedSources.join(', ')}`);
      }
      lines.push('');
    });
  } else {
    lines.push('_No critical blockers recorded._\n');
  }

  // Market Evidence from Web Research
  if (evidence && evidence.length > 0) {
    lines.push('### Grounded Evidence Gathered from Market Intelligence:');
    lines.push('');
    evidence.slice(0, 5).forEach((ev, idx) => {
      lines.push(`- **[#${idx + 1} - ${ev.sourceType.toUpperCase()}]** [${ev.title}](${ev.url}) *(${ev.domain})*`);
      lines.push(`  > "${ev.snippet}"`);
      lines.push(`  *Relevance: ${ev.relevanceToPitch}*`);
      lines.push('');
    });
  }

  // 4. Cohort A: Individual Buyer Evaluations
  lines.push('## 4. Cohort A: 10 Autonomous Buyer Persona Evaluations');
  lines.push('');
  lines.push('| Persona | Role | Company Profile | Budget Ceiling | Vote | Willingness to Pay | Primary Rationale |');
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

  evaluations.forEach((ev) => {
    const persona = personas.find((p) => p.id === ev.personaId);
    const role = ev.role.replace('_', ' ');
    const voteBadge = ev.vote === 'adopt' ? '✓ ADOPT' : ev.vote === 'reject' ? '✕ REJECT' : '⚠ HESITANT';
    const ceiling = persona ? `$${persona.budgetCeiling}/${persona.budgetPeriod}` : 'N/A';
    const company = persona ? persona.companyProfile.replace(/\|/g, '/') : 'N/A';
    const safeRationale = ev.rationale.replace(/\|/g, '-').replace(/\n/g, ' ').slice(0, 80) + '...';

    lines.push(`| **${ev.personaName}** | ${role} | ${company} | ${ceiling} | **${voteBadge}** | **$${ev.acceptablePrice}/${ev.acceptablePeriod}** | ${safeRationale} |`);
  });
  lines.push('');

  // Detailed persona breakdowns
  lines.push('### Detailed Persona Verbatim Quotes:');
  lines.push('');
  evaluations.forEach((ev) => {
    const persona = personas.find((p) => p.id === ev.personaId);
    lines.push(`#### ${ev.personaName} (${ev.role.replace('_', ' ')} - ${persona?.title || 'Decision Maker'})`);
    lines.push(`- **Vote:** \`${ev.vote.toUpperCase()}\` | **WTP:** \`$${ev.acceptablePrice}/${ev.acceptablePeriod}\``);
    if (persona) {
      lines.push(`- **Company:** ${persona.companyProfile}`);
      lines.push(`- **Primary Constraint:** ${persona.primaryConstraint}`);
      lines.push(`- **Existing Stack:** ${persona.existingStack.join(', ')}`);
    }
    lines.push(`- **Blunt Internal Rationale:**`);
    lines.push(`  > "${ev.rationale}"`);
    if (ev.fatalObjections.length > 0) {
      lines.push(`- **Objections Raised:**`);
      ev.fatalObjections.forEach((o) => {
        lines.push(`  - [${o.severity.toUpperCase()}] ${o.objection}`);
      });
    }
    if (ev.dealMakers.length > 0) {
      lines.push(`- **Deal-Makers to Win Purchase:** ${ev.dealMakers.join('; ')}`);
    }
    lines.push('');
  });

  // 5. Autonomous Optimization via NVIDIA Nemotron 3 Ultra
  if (optimizedPitch) {
    lines.push('## 5. Autonomous Optimization (NVIDIA Nemotron 3 Ultra)');
    lines.push('');
    lines.push(`- **Revised Tagline:** ${optimizedPitch.revisedTagline}`);
    lines.push(`- **Revised Description:** ${optimizedPitch.revisedDescription}`);
    lines.push(`- **Calibrated Price:** **$${optimizedPitch.calibratedPrice}/${optimizedPitch.calibratedPeriod}**`);
    lines.push(`- **Packaging Fix:** ${optimizedPitch.packagingFix}`);
    lines.push(`- **Strategic Rationale:** ${optimizedPitch.strategicRationale}`);
    lines.push('');
    if (optimizedPitch.objectionCountermeasures && optimizedPitch.objectionCountermeasures.length > 0) {
      lines.push('### Contractual Countermeasures & SLA Commitments:');
      lines.push('');
      lines.push('| Target Objection | Contractual Guarantee / Countermeasure |');
      lines.push('| :--- | :--- |');
      optimizedPitch.objectionCountermeasures.forEach((cm) => {
        lines.push(`| "${cm.targetObjection}" | ${cm.countermeasure} |`);
      });
      lines.push('');
    }
  }

  // 6. Cohort B: Hold-Out Retest Validation
  if (holdOutResult) {
    lines.push('## 6. Cohort B: Blinded Hold-Out Committee Validation');
    lines.push('');
    lines.push(`Anti-circular proof: The optimized pitch was tested against an independent, role-mirrored committee (Cohort B) that never saw the initial debate.`);
    lines.push('');
    lines.push(`| Metric | Initial Run (Cohort A) | Hold-Out Panel (Cohort B) | Delta |`);
    lines.push(`| :--- | :--- | :--- | :--- |`);
    lines.push(`| **Acceptance Rate** | ${(holdOutResult.initialAcceptanceRate * 100).toFixed(0)}% | **${(holdOutResult.holdOutAcceptanceRate * 100).toFixed(0)}%** (spread: [${Math.round(holdOutResult.acceptanceRateSpread.min * 100)}%–${Math.round(holdOutResult.acceptanceRateSpread.max * 100)}%]) | **+${((holdOutResult.holdOutAcceptanceRate - holdOutResult.initialAcceptanceRate) * 100).toFixed(0)}%** |`);
    lines.push(`| **Paid Commercial Rate** | ${(holdOutResult.initialPaidAcceptanceRate * 100).toFixed(0)}% | **${(holdOutResult.holdOutPaidAcceptanceRate * 100).toFixed(0)}%** | **+${((holdOutResult.holdOutPaidAcceptanceRate - holdOutResult.initialPaidAcceptanceRate) * 100).toFixed(0)}%** |`);
    lines.push(`| **Median Willingness to Pay** | $${holdOutResult.initialMedianPrice} | **$${holdOutResult.holdOutMedianPrice}** (spread: $${holdOutResult.priceSpread.min}–$${holdOutResult.priceSpread.max}) | Calibrated |`);
    lines.push(`| **Resolved Blockers** | 0 | **${holdOutResult.resolvedObjectionsCount} of ${holdOutResult.totalInitialObjections}** | ${((holdOutResult.resolvedObjectionsCount / Math.max(1, holdOutResult.totalInitialObjections)) * 100).toFixed(0)}% resolved |`);
    lines.push('');
    lines.push(`**Delta Summary:** ${holdOutResult.deltaSummary}`);
    lines.push('');
  }

  // 7. Suggested Action Items
  if (verdict.suggestedActionItems && verdict.suggestedActionItems.length > 0) {
    lines.push('## 7. Founder Action Items & Next Steps');
    lines.push('');
    verdict.suggestedActionItems.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item}`);
    });
    lines.push('');
  }

  // Footer & Telemetry
  lines.push('---');
  lines.push(`*Generated by SyntheticLab • Token Consumption: ${telemetry.totalTokens.toLocaleString()} tokens • Latency: ${(telemetry.latencyMs / 1000).toFixed(2)}s • Nebius Token Factory & NVIDIA NIM*`);

  return lines.join('\n');
}

/**
 * Generate CSV export of Persona Evaluations (RFC 4180 compliant)
 */
export function generateCsvExport(data: SimulationExportData): string {
  const escapeCsv = (str: string | number | undefined | null): string => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const headers = [
    'Persona ID',
    'Persona Name',
    'Role',
    'Title',
    'Company Profile',
    'Budget Ceiling ($)',
    'Budget Period',
    'Risk Tolerance',
    'Primary Constraint',
    'Vote',
    'Acceptable Price ($)',
    'Acceptable Period',
    'Fatal Objections',
    'Deal Makers',
    'Internal Rationale',
  ];

  const rows: string[] = [headers.map(escapeCsv).join(',')];

  data.evaluations.forEach((ev) => {
    const persona = data.personas.find((p) => p.id === ev.personaId);
    const objections = ev.fatalObjections.map((o) => `[${o.severity}] ${o.objection}`).join('; ');
    const dealMakers = ev.dealMakers.join('; ');

    const row = [
      escapeCsv(ev.personaId),
      escapeCsv(ev.personaName),
      escapeCsv(ev.role),
      escapeCsv(persona?.title || 'Decision Maker'),
      escapeCsv(persona?.companyProfile || ''),
      escapeCsv(persona?.budgetCeiling || 0),
      escapeCsv(persona?.budgetPeriod || data.input.billingPeriod),
      escapeCsv(persona?.riskTolerance || 'medium'),
      escapeCsv(persona?.primaryConstraint || ''),
      escapeCsv(ev.vote),
      escapeCsv(ev.acceptablePrice),
      escapeCsv(ev.acceptablePeriod),
      escapeCsv(objections),
      escapeCsv(dealMakers),
      escapeCsv(ev.rationale),
    ];

    rows.push(row.join(','));
  });

  return rows.join('\r\n');
}

/**
 * Generate complete structured JSON export
 */
export function generateJsonExport(data: SimulationExportData): string {
  const exportPayload = {
    metadata: {
      generator: 'SyntheticLab — Autonomous Synthetic Buyer & Churn Simulation Arena',
      exportedAt: data.exportedAt || new Date().toISOString(),
      models: {
        reasoning: data.telemetry.modelReasoning,
        fast: data.telemetry.modelFast,
      },
      telemetry: data.telemetry,
    },
    pitch: data.input,
    verdict: data.verdict,
    cohortA: {
      personas: data.personas,
      evaluations: data.evaluations,
    },
    marketEvidence: data.evidence,
    optimization: data.optimizedPitch,
    cohortB: data.holdOutResult,
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Trigger client-side file download
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Helper to download report in specified format
 */
export function downloadSimulationReport(
  data: SimulationExportData,
  format: 'markdown' | 'csv' | 'json'
): void {
  const slug = (data.input.productName || 'simulation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const dateStr = new Date().toISOString().split('T')[0];

  if (format === 'markdown') {
    const md = generateMarkdownReport(data);
    downloadFile(md, `${slug}-syntheticlab-report-${dateStr}.md`, 'text/markdown');
  } else if (format === 'csv') {
    const csv = generateCsvExport(data);
    downloadFile(csv, `${slug}-persona-evaluations-${dateStr}.csv`, 'text/csv');
  } else if (format === 'json') {
    const json = generateJsonExport(data);
    downloadFile(json, `${slug}-syntheticlab-data-${dateStr}.json`, 'application/json');
  }
}
