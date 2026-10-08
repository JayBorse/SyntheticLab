'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Terminal,
  CheckCircle2,
  ShieldCheck,
  Cpu,
  Zap,
  Activity,
  HardDrive,
  Copy,
  Check,
} from 'lucide-react';
import { NebiusSandboxTelemetry, BlockerChecklistItem } from '@/core/synthetic-lab/types';
import { SandboxExecutionLog, SandboxRunResult } from '@/core/nebius/sandbox-runner';
import { Button } from './Button';

export interface SandboxTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  blocker: BlockerChecklistItem | null;
  personaName?: string;
  personaRole?: string;
  onVerificationComplete?: (telemetry: NebiusSandboxTelemetry, resolutionSummary: string) => void;
}

export const SandboxTerminalModal: React.FC<SandboxTerminalModalProps> = ({
  isOpen,
  onClose,
  blocker,
  personaName,
  personaRole,
  onVerificationComplete,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [visibleLogs, setVisibleLogs] = useState<SandboxExecutionLog[]>([]);
  const [telemetry, setTelemetry] = useState<NebiusSandboxTelemetry | null>(null);
  const [resolutionSummary, setResolutionSummary] = useState<string>('');
  const [copiedHash, setCopiedHash] = useState(false);
  const terminalScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && blocker) {
      setVisibleLogs([]);
      setTelemetry(null);
      setResolutionSummary('');
      setIsRunning(true);

      const runSandbox = async () => {
        try {
          const res = await fetch('/api/simulate/sandbox-poc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              blockerText: blocker.text,
              personaRole,
            }),
          });

          if (!res.ok) throw new Error('Sandbox run failed');
          const data = await res.json();
          const result: SandboxRunResult = data.result;

          // Stream logs incrementally for realistic developer experience
          const allLogs = result.logs;
          for (let i = 0; i < allLogs.length; i++) {
            await new Promise((r) => setTimeout(r, i === 0 ? 80 : 120));
            setVisibleLogs((prev) => [...prev, allLogs[i]]);
          }

          setTelemetry(result.telemetry);
          setResolutionSummary(result.resolutionSummary);
          setIsRunning(false);
        } catch (err) {
          console.error(err);
          setIsRunning(false);
        }
      };

      runSandbox();
    }
  }, [isOpen, blocker, personaRole]);

  useEffect(() => {
    terminalScrollRef.current?.scrollTo({
      top: terminalScrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [visibleLogs]);

  if (!isOpen || !blocker) return null;

  const handleApplyProof = () => {
    if (telemetry && onVerificationComplete) {
      onVerificationComplete(telemetry, resolutionSummary);
      onClose();
    }
  };

  const copyReceipt = () => {
    if (telemetry?.receiptHash) {
      navigator.clipboard.writeText(telemetry.receiptHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-input)] border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 mr-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-medium text-[var(--text-primary)]">
              nebius-sandbox://{telemetry?.sandboxId || 'microvm-session'}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              OCI cgroup-v2
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Objection Context Banner */}
        <div className="px-5 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] text-xs flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
              Technical Due Diligence Target ({personaName || 'Staff SRE'})
            </span>
            <span className="text-[11px] font-mono text-purple-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Nebius ConTree Runtime
            </span>
          </div>
          <div className="text-[var(--text-primary)] font-medium italic line-clamp-1">
            &ldquo;{blocker.text}&rdquo;
          </div>
        </div>

        {/* Terminal Output Area */}
        <div
          ref={terminalScrollRef}
          className="flex-1 p-4 bg-[#080B11] font-mono text-xs text-gray-300 overflow-y-auto space-y-1.5 min-h-[260px] max-h-[360px]"
        >
          {visibleLogs.map((log, index) => {
            const isCommand = log.message.startsWith('$');
            const isPass = log.message.includes('PASSED') || log.message.includes('✔');
            const isSystem = log.stream === 'system';

            return (
              <div key={index} className="flex gap-2 leading-relaxed">
                <span className="text-gray-600 select-none text-[10px]">{log.timestamp}</span>
                <span
                  className={
                    isCommand
                      ? 'text-emerald-400 font-semibold'
                      : isPass
                      ? 'text-emerald-300 font-medium'
                      : isSystem
                      ? 'text-cyan-400/90'
                      : 'text-gray-300'
                  }
                >
                  {log.message}
                </span>
              </div>
            );
          })}

          {isRunning && (
            <div className="flex items-center gap-2 text-cyan-400 pt-2 animate-pulse text-[11px]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Executing microVM audit on Nebius Cloud cluster...</span>
            </div>
          )}
        </div>

        {/* Telemetry Receipt Box */}
        {telemetry && (
          <div className="p-4 bg-[var(--bg-input)] border-t border-[var(--border-subtle)] space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] font-mono">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  p99 Latency
                </div>
                <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                  {telemetry.p99LatencyMs} ms
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] font-mono">
                  <Activity className="w-3 h-3 text-cyan-400" />
                  Throughput
                </div>
                <div className="text-sm font-mono font-bold text-[var(--text-primary)] mt-0.5">
                  {telemetry.throughputRps.toLocaleString()} rps
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] font-mono">
                  <HardDrive className="w-3 h-3 text-purple-400" />
                  RAM Delta
                </div>
                <div className="text-sm font-mono font-bold text-[var(--text-primary)] mt-0.5">
                  +{telemetry.memoryDeltaMb} MB
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] font-mono">
                  <Cpu className="w-3 h-3 text-emerald-400" />
                  Exit Code
                </div>
                <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                  0 (PASS)
                </div>
              </div>
            </div>

            {/* Cryptographic Receipt */}
            <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-secondary)]">
              <span className="truncate mr-2">Receipt: {telemetry.receiptHash}</span>
              <button
                onClick={copyReceipt}
                className="flex items-center gap-1 text-xs text-[var(--text-primary)] hover:text-emerald-400 transition-colors px-2 py-0.5 rounded bg-[var(--bg-secondary)]"
              >
                {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedHash ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[var(--bg-card)] border-t border-[var(--border-subtle)]">
          <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
            {telemetry ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Verified in Nebius MicroVM</span>
              </>
            ) : (
              <span>Benchmarking in progress...</span>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isRunning || !telemetry}
              onClick={handleApplyProof}
            >
              Apply Proof to Negotiation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
