'use client';

import React, { useEffect, useRef } from 'react';
import { X, ExternalLink, ShieldAlert, Sparkles } from 'lucide-react';
import { PersonaEvaluation, SyntheticPersona } from '@/core/synthetic-lab/types';
import { Chip } from './Chip';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  evaluation: PersonaEvaluation | null;
  persona?: SyntheticPersona | null;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  evaluation,
  persona,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !evaluation) return null;

  const voteVariant =
    evaluation.vote === 'adopt'
      ? 'accent'
      : evaluation.vote === 'reject'
      ? 'rose'
      : 'amber';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className="relative w-full max-w-md sm:max-w-lg bg-[var(--surface-1)] border-l border-[var(--border-subtle)] h-full overflow-y-auto z-10 p-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-250"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="drawer-title" className="text-lg font-bold text-[var(--text-primary)]">
                {evaluation.personaName}
              </h2>
              <Chip variant={voteVariant} size="sm">
                {evaluation.vote.toUpperCase()}
              </Chip>
            </div>
            <p className="text-xs font-mono text-[var(--text-muted)] mt-1">
              {evaluation.role} • {persona?.title || 'Decision Maker'}
            </p>
            {persona?.companyProfile && (
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {persona.companyProfile}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Close details drawer"
            className="h-8 w-8 rounded-[var(--radius-md)] bg-[var(--surface-2)] border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-6 space-y-6 flex-1 text-xs">
          {/* Commercial Willingness to Pay */}
          <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--surface-2)] border border-[var(--border-subtle)]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
              Observed Willingness to Pay
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-[var(--text-primary)] num-tabular">
                ${evaluation.acceptablePrice}
              </span>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                /{evaluation.acceptablePeriod}
              </span>
              {persona?.budgetCeiling && (
                <span className="text-[11px] font-mono text-[var(--text-muted)] ml-auto">
                  Budget ceiling: ${persona.budgetCeiling}/{persona.budgetPeriod}
                </span>
              )}
            </div>
          </div>

          {/* Blunt Internal Rationale */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-medium">
              Blunt Internal Reasoning
            </span>
            <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--text-secondary)] leading-relaxed italic">
              &ldquo;{evaluation.rationale}&rdquo;
            </div>
          </div>

          {/* Fatal Objections Raised with Evidence Links */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-medium">
              <ShieldAlert className="h-3.5 w-3.5 text-[var(--rose)]" />
              <span>Fatal Objections ({evaluation.fatalObjections.length})</span>
            </div>

            {evaluation.fatalObjections.length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)] italic">
                No fatal blockers identified by this decision-maker.
              </p>
            ) : (
              <div className="space-y-2.5">
                {evaluation.fatalObjections.map((fo, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-[var(--text-primary)] leading-snug">
                        {fo.objection}
                      </span>
                      <Chip variant={fo.severity === 'blocker' ? 'rose' : 'amber'} size="sm">
                        {fo.severity.toUpperCase()}
                      </Chip>
                    </div>

                    {fo.evidenceSnippet && (
                      <p className="text-[11px] text-[var(--text-muted)] border-l-2 border-[var(--border-medium)] pl-2 italic">
                        &ldquo;{fo.evidenceSnippet}&rdquo;
                      </p>
                    )}

                    {fo.groundedEvidenceUrl && (
                      <div className="pt-1">
                        <a
                          href={fo.groundedEvidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--accent)] hover:underline"
                        >
                          <span>Verified Citation Source</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deal Makers */}
          {evaluation.dealMakers && evaluation.dealMakers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-medium">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>Conversion Triggers & Deal-Makers</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-[var(--text-secondary)]">
                {evaluation.dealMakers.map((dm, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[var(--accent)] font-mono font-bold">•</span>
                    <span>{dm}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Persona Organizational Context (if available) */}
          {persona && (
            <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-2 font-mono text-[11px]">
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">
                Decision Profile
              </span>
              <div className="grid grid-cols-2 gap-2 text-[var(--text-secondary)]">
                <div>
                  <span className="text-[var(--text-muted)] block">Risk Tolerance</span>
                  <span className="text-[var(--text-primary)] capitalize">{persona.riskTolerance}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Existing Stack</span>
                  <span className="text-[var(--text-primary)] truncate block">{persona.existingStack.join(', ')}</span>
                </div>
              </div>
              {persona.primaryConstraint && (
                <div className="pt-1 border-t border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] block">Primary Constraint:</span>
                  <span className="text-[var(--text-secondary)] italic">{persona.primaryConstraint}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
