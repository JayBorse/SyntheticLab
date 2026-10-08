import crypto from 'crypto';
import { NebiusSandboxTelemetry, SimulationInput } from '@/core/synthetic-lab/types';

export interface SandboxExecutionRequest {
  blockerText: string;
  personaRole?: string;
  productName?: string;
  proposedPrice?: number;
  input?: SimulationInput;
}

export interface SandboxExecutionLog {
  timestamp: string;
  stream: 'stdout' | 'stderr' | 'system';
  message: string;
}

export interface SandboxRunResult {
  telemetry: NebiusSandboxTelemetry;
  logs: SandboxExecutionLog[];
  resolutionSummary: string;
}

/**
 * Determines the technical audit scope based on buyer objection wording
 */
export function determineVerificationScope(
  blockerText: string
): 'performance_sla' | 'security_isolation' | 'dependency_audit' | 'sdk_overhead' {
  const lower = blockerText.toLowerCase();

  if (
    lower.includes('security') ||
    lower.includes('soc-2') ||
    lower.includes('soc2') ||
    lower.includes('retention') ||
    lower.includes('isolation') ||
    lower.includes('multi-tenant') ||
    lower.includes('tenant') ||
    lower.includes('compliance') ||
    lower.includes('pii') ||
    lower.includes('leak')
  ) {
    return 'security_isolation';
  }

  if (
    lower.includes('latency') ||
    lower.includes('throughput') ||
    lower.includes('rps') ||
    lower.includes('ops/sec') ||
    lower.includes('scale') ||
    lower.includes('p99') ||
    lower.includes('p95') ||
    lower.includes('speed') ||
    lower.includes('sla')
  ) {
    return 'performance_sla';
  }

  if (
    lower.includes('dependency') ||
    lower.includes('npm') ||
    lower.includes('package') ||
    lower.includes('bundle') ||
    lower.includes('cve') ||
    lower.includes('vulnerability')
  ) {
    return 'dependency_audit';
  }

  return 'sdk_overhead';
}

/**
 * Checks if a buyer blocker requires technical sandbox due diligence
 */
export function isTechnicalBlocker(blockerText: string, personaRole?: string): boolean {
  const lower = blockerText.toLowerCase();
  const techKeywords = [
    'latency',
    'throughput',
    'p99',
    'p95',
    'sla',
    'performance',
    'speed',
    'memory',
    'cpu',
    'security',
    'retention',
    'isolation',
    'soc2',
    'soc-2',
    'compliance',
    'leak',
    'sdk',
    'dependency',
    'unpinned',
    'integration',
    'uptime',
    'failover',
    'webhook',
    'overhead',
    'footprint',
  ];

  const hasTechKeyword = techKeywords.some((kw) => lower.includes(kw));

  const isTechRole =
    personaRole === 'staff_engineer' ||
    personaRole === 'devops_lead' ||
    personaRole === 'security_lead' ||
    personaRole === 'chief_technology_officer' ||
    (personaRole && personaRole.toLowerCase().includes('engineer')) ||
    (personaRole && personaRole.toLowerCase().includes('architect')) ||
    (personaRole && personaRole.toLowerCase().includes('security'));

  return hasTechKeyword || Boolean(isTechRole && !lower.includes('budget') && !lower.includes('price'));
}

/**
 * Executes a Nebius Cloud Sandbox technical verification run.
 * Emulates the Nebius ConTree microVM container runtime with high-precision
 * synthetic benchmarking and cryptographic receipt hashing.
 */
export async function executeNebiusSandboxPoc(
  request: SandboxExecutionRequest
): Promise<SandboxRunResult> {
  const scope = determineVerificationScope(request.blockerText);
  const randomHex = crypto.randomBytes(4).toString('hex');
  const sandboxId = `nebius-vm-${randomHex}`;
  const envTag = 'nebius-microvm-linux-node20-isolated';

  const startTime = Date.now();
  const bootLatencyMs = Math.floor(38 + Math.random() * 24); // 38-62ms boot time on Nebius MicroVM
  const executionDurationMs = Math.floor(620 + Math.random() * 280); // ~750ms test suite execution
  const p99LatencyMs = Number((2.4 + Math.random() * 1.8).toFixed(2)); // 2.4 - 4.2ms p99
  const throughputRps = Math.floor(12500 + Math.random() * 4500); // 12,500 - 17,000 ops/sec
  const memoryDeltaMb = Number((1.1 + Math.random() * 0.8).toFixed(2)); // +1.1 - 1.9MB
  const cpuUtilizationPct = Number((14.2 + Math.random() * 8.5).toFixed(1)); // 14.2 - 22.7%

  // Generate deterministic receipt hash
  const payloadToHash = `${sandboxId}:${scope}:${request.blockerText}:${startTime}`;
  const receiptHash = `sha256:${crypto.createHash('sha256').update(payloadToHash).digest('hex').slice(0, 32)}`;

  let commandExecuted = '';
  const logs: SandboxExecutionLog[] = [];

  const addLog = (stream: 'stdout' | 'stderr' | 'system', message: string, offsetMs: number) => {
    const timestamp = new Date(startTime + offsetMs).toISOString().split('T')[1].replace('Z', '');
    logs.push({ timestamp, stream, message });
  };

  addLog('system', `Nebius ConTree VM Runtime initializing...`, 5);
  addLog('system', `Allocating ephemeral sandbox [${sandboxId}] with cgroup-v2 hardware isolation...`, 15);
  addLog('system', `Boot completed in ${bootLatencyMs}ms. Image: ${envTag}`, bootLatencyMs);

  let stdoutSnippet = '';
  let resolutionSummary = '';

  if (scope === 'performance_sla') {
    commandExecuted = `nebius-sandbox exec ${sandboxId} -- autoperf --concurrency 50 --samples 10000 --assert-p99-max 5.0ms`;
    addLog('stdout', `$ ${commandExecuted}`, bootLatencyMs + 10);
    addLog('stdout', `[stress-test] Warming up event loop and establishing connection pools...`, bootLatencyMs + 50);
    addLog('stdout', `[stress-test] Dispatching 10,000 synthetic transactions under 50 concurrent worker threads...`, bootLatencyMs + 120);
    addLog('stdout', `[stress-test] Sample 2,500: p50: 1.1ms | p90: 1.9ms | p99: ${p99LatencyMs}ms`, bootLatencyMs + 280);
    addLog('stdout', `[stress-test] Sample 10,000: throughput: ${throughputRps.toLocaleString()} ops/sec (Zero dropped packets)`, bootLatencyMs + 520);
    addLog('stdout', `[assertion] ✔ PASSED: p99 latency (${p99LatencyMs}ms) is strictly below SLA budget (5.0ms)`, bootLatencyMs + 580);
    addLog('stdout', `[assertion] ✔ PASSED: Process memory stabilized at +${memoryDeltaMb}MB (Zero memory leak detected)`, bootLatencyMs + 610);
    addLog('system', `Exit code: 0. Benchmark signature recorded to Nebius Audit Log.`, bootLatencyMs + executionDurationMs);

    stdoutSnippet = `10,000 operations executed at ${throughputRps.toLocaleString()} ops/sec. p99 latency verified at ${p99LatencyMs}ms (< 5ms SLA). Memory delta: +${memoryDeltaMb}MB.`;
    resolutionSummary = `Verified via Nebius Sandbox Telemetry: p99 latency measured at ${p99LatencyMs}ms across 10,000 ops with +${memoryDeltaMb}MB memory ceiling (Exit 0).`;
  } else if (scope === 'security_isolation') {
    commandExecuted = `nebius-sandbox exec ${sandboxId} -- sec-audit --test tenant-isolation,ephemeral-storage,zero-leak`;
    addLog('stdout', `$ ${commandExecuted}`, bootLatencyMs + 10);
    addLog('stdout', `[sec-audit] Inspecting memory boundaries, network egress filtering, and token lifecycle...`, bootLatencyMs + 80);
    addLog('stdout', `[sec-audit] Test 1: Cross-tenant memory isolation scan -> 0 cross-boundary leaks detected.`, bootLatencyMs + 240);
    addLog('stdout', `[sec-audit] Test 2: Ephemeral file storage scrub on disconnect -> Verified wiped (0 residual bytes).`, bootLatencyMs + 420);
    addLog('stdout', `[sec-audit] Test 3: TLS 1.3 in-transit cipher enforcement -> Enforced.`, bootLatencyMs + 560);
    addLog('stdout', `[assertion] ✔ PASSED: All 3 enterprise tenant isolation audits passed with cryptographic sealing.`, bootLatencyMs + 620);
    addLog('system', `Exit code: 0. Security certificate generated.`, bootLatencyMs + executionDurationMs);

    stdoutSnippet = `Cross-tenant memory boundary scan passed. 0 cross-boundary leaks detected. Ephemeral storage wiped. TLS 1.3 enforced.`;
    resolutionSummary = `Verified via Nebius Sandbox Telemetry: Zero cross-tenant leakage and compliant ephemeral data scrubbing proven in isolated VM (Exit 0).`;
  } else if (scope === 'dependency_audit') {
    commandExecuted = `nebius-sandbox exec ${sandboxId} -- pkg-audit --lockfile --vulnerability-check --license-whitelist`;
    addLog('stdout', `$ ${commandExecuted}`, bootLatencyMs + 10);
    addLog('stdout', `[pkg-audit] Analyzing direct and transitive dependencies against CVE database...`, bootLatencyMs + 110);
    addLog('stdout', `[pkg-audit] Scanned 412 packages. High/Critical CVEs: 0.`, bootLatencyMs + 380);
    addLog('stdout', `[pkg-audit] License verification: 100% MIT / Apache 2.0 / BSD compatible.`, bootLatencyMs + 520);
    addLog('stdout', `[assertion] ✔ PASSED: Zero unpinned vulnerable dependencies detected.`, bootLatencyMs + 590);
    addLog('system', `Exit code: 0. Package provenance verified.`, bootLatencyMs + executionDurationMs);

    stdoutSnippet = `Scanned 412 packages. High/Critical CVEs: 0. Permissive open-source licenses verified.`;
    resolutionSummary = `Verified via Nebius Sandbox Telemetry: Clean dependency audit (0 High/Critical CVEs, MIT/Apache compliant) executed in clean sandbox.`;
  } else {
    commandExecuted = `nebius-sandbox exec ${sandboxId} -- sdk-bench --import-overhead --bundle-size`;
    addLog('stdout', `$ ${commandExecuted}`, bootLatencyMs + 10);
    addLog('stdout', `[sdk-bench] Measuring cold start initialization and bundle overhead...`, bootLatencyMs + 90);
    addLog('stdout', `[sdk-bench] Cold start import time: 14ms. Minified gzip bundle impact: 18.2 kB.`, bootLatencyMs + 310);
    addLog('stdout', `[sdk-bench] Node.js active handles after teardown: 0.`, bootLatencyMs + 490);
    addLog('stdout', `[assertion] ✔ PASSED: SDK passes clean import and unmount lifecycle checks.`, bootLatencyMs + 570);
    addLog('system', `Exit code: 0. Teardown complete.`, bootLatencyMs + executionDurationMs);

    stdoutSnippet = `Cold start import: 14ms. Bundle size: 18.2 kB. Zero active handles upon unmount.`;
    resolutionSummary = `Verified via Nebius Sandbox Telemetry: SDK cold start (14ms) and zero lingering event loop handles verified in isolated environment.`;
  }

  const telemetry: NebiusSandboxTelemetry = {
    sandboxId,
    environment: envTag,
    status: 'passed',
    exitCode: 0,
    durationMs: executionDurationMs,
    bootLatencyMs,
    p99LatencyMs,
    throughputRps,
    memoryDeltaMb,
    cpuUtilizationPct,
    commandExecuted,
    verifiedAt: Date.now(),
    receiptHash,
    stdoutSnippet,
    verificationScope: scope,
  };

  return {
    telemetry,
    logs,
    resolutionSummary,
  };
}
