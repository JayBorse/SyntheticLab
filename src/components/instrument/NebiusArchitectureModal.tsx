'use client';

import React from 'react';
import {
  X,
  Cpu,
  Layers,
  Zap,
  Activity,
  Server,
  ShieldCheck,
  ArrowRight,
  Database,
  GitBranch,
} from 'lucide-react';

export interface NebiusArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: {
    latencyMs: number;
    parallelCalls: number;
    modelFast: string;
    modelReasoning: string;
    totalTokens?: number;
  };
}

export const NebiusArchitectureModal: React.FC<NebiusArchitectureModalProps> = ({
  isOpen,
  onClose,
  telemetry,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--surface-1)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--surface-2)]/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                  Nebius Token Factory & NVIDIA Architecture
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Cluster Live
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Multi-model tiering system allocating tasks between Nemotron 3 Ultra (550B) and Nemotron Super (120B).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Cluster Specs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
          <div className="p-3 rounded-xl bg-[var(--surface-2)]/40 border border-[var(--border-subtle)]">
            <div className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider">Inference Endpoint</div>
            <div className="text-xs font-mono font-medium text-[var(--text-primary)] mt-1 truncate">api.tokenfactory.nebius.com</div>
            <div className="text-[11px] text-emerald-400">Connected • H100 Cluster</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-2)]/40 border border-[var(--border-subtle)]">
            <div className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider">Concurrent Streams</div>
            <div className="text-xl font-semibold text-cyan-400 mt-0.5">{telemetry.parallelCalls || 10} Parallel</div>
            <div className="text-[11px] text-[var(--text-secondary)]">Swarm worker pool</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-2)]/40 border border-[var(--border-subtle)]">
            <div className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider">Stream Latency</div>
            <div className="text-xl font-semibold text-blue-400 mt-0.5">
              {telemetry.latencyMs > 0 ? `${(telemetry.latencyMs / 1000).toFixed(1)}s` : 'Realtime'}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">End-to-end swarm loop</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-2)]/40 border border-[var(--border-subtle)]">
            <div className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider">Token Throughput</div>
            <div className="text-xl font-semibold text-purple-400 mt-0.5">~145 tok/s</div>
            <div className="text-[11px] text-[var(--text-secondary)]">Speculative decode enabled</div>
          </div>
        </div>

        {/* Multi-Model Tiering Architecture */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
              Two-Tier Model Allocation Strategy
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Rather than sending all operations to a single model, SyntheticLab divides work by computational necessity: high-throughput swarm concurrency vs. deep multi-constraint strategic reasoning.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              {/* Tier 1: Nemotron Ultra 550B */}
              <div className="p-4 rounded-xl bg-[var(--surface-2)]/40 border border-purple-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-400" />
                    <span className="text-xs font-mono font-semibold text-purple-400">Tier 1: Strategic Synthesis Engine</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    550B Parameters
                  </span>
                </div>
                <div className="font-mono text-xs text-[var(--text-primary)] font-semibold">
                  nvidia/Nemotron-3-Ultra-550b-a55b
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Used for high-stakes optimization tasks: resolving contradictory objections across CFO and security leads, reformulating pricing packaging, writing binding contractual riders, and arbitrating hold-out deltas.
                </p>
                <div className="pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-tertiary)] flex items-center justify-between">
                  <span>Temperature: 0.3 (Strict Contract Mode)</span>
                  <span className="text-purple-400">Frontier Reasoning</span>
                </div>
              </div>

              {/* Tier 2: Nemotron Super 120B */}
              <div className="p-4 rounded-xl bg-[var(--surface-2)]/40 border border-cyan-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    <span className="text-xs font-mono font-semibold text-cyan-400">Tier 2: Concurrent Swarm Engine</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    120B Parameters
                  </span>
                </div>
                <div className="font-mono text-xs text-[var(--text-primary)] font-semibold">
                  nvidia/nemotron-3-super-120b-a12b
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Used for high-throughput parallel execution: generates symmetric persona committees, streams parallel multi-turn buyer reactions simultaneously via SSE, and audits counter-offers against the blocker checklist.
                </p>
                <div className="pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-tertiary)] flex items-center justify-between">
                  <span>Concurrency: 10 Parallel Worker Slots</span>
                  <span className="text-cyan-400">Low Latency Swarm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Infrastructure Flow Diagram */}
          <div className="p-4 rounded-xl bg-[var(--surface-2)]/40 border border-[var(--border-subtle)] space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
              Unified Platform Lineage: Inference + Cloud Sandboxes
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
              <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] font-mono text-cyan-400">Step 1: Ingestion</div>
                <div className="text-xs text-[var(--text-primary)] font-medium">Pitch & WTP Pricing</div>
                <div className="text-[11px] text-[var(--text-tertiary)]">Parsed into commercial constraints</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] font-mono text-blue-400">Step 2: Grounding</div>
                <div className="text-xs text-[var(--text-primary)] font-medium">Tavily Search API</div>
                <div className="text-[11px] text-[var(--text-tertiary)]">Reddit & G2 pricing traps extracted</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] font-mono text-purple-400">Step 3: Swarm Audit</div>
                <div className="text-xs text-[var(--text-primary)] font-medium">Token Factory 120B</div>
                <div className="text-[11px] text-[var(--text-tertiary)]">10 parallel persona evaluations</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] font-mono text-yellow-400">Step 4: Due Diligence</div>
                <div className="text-xs text-[var(--text-primary)] font-medium">Nebius MicroVM Sandbox</div>
                <div className="text-[11px] text-[var(--text-tertiary)]">ConTree cgroup-v2 container benchmarks</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] font-mono text-emerald-400">Step 5: Hold-Out</div>
                <div className="text-xs text-[var(--text-primary)] font-medium">Nemotron 550B + Code</div>
                <div className="text-[11px] text-[var(--text-tertiary)]">Blinded Cohort B generalization</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--surface-2)]/60 text-xs">
          <div className="text-[var(--text-tertiary)] font-mono">
            Nebius AI Cloud • Token Factory Cluster
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--surface-3)] hover:bg-[var(--surface-4)] text-[var(--text-primary)] font-medium transition-colors"
          >
            Close Telemetry
          </button>
        </div>
      </div>
    </div>
  );
};
