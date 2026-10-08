'use client';

import React, { useEffect, useRef } from 'react';
import { X, ExternalLink, ShieldAlert, Sparkles, Zap } from 'lucide-react';
import { PersonaEvaluation, SyntheticPersona } from '@/core/synthetic-lab/types';
import { Chip } from './Chip';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  evaluation: PersonaEvaluation | null;
  persona?: SyntheticPersona | null;
  onStartSparring?: (persona: SyntheticPersona, evaluation: PersonaEvaluation) => void;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  evaluation,
  persona,
  onStartSparring,
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
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className="relative w-full max-w-md sm:max-w-xl bg-[var(--surface-1)] sm:rounded-l-2xl border-l border-[var(--border-subtle)] h-full overflow-y-auto z-10 p-6 sm:p-8 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
          <div className="flex items-start gap-4 min-w-0">
            <div className="shrink-0">
              <div className="h-14 w-14 rounded-xl overflow-hidden ring-2 ring-white/10 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://images.unsplash.com/photo-${
                    evaluation.role.includes('cfo') || evaluation.role.includes('finance') || evaluation.role.includes('procurement')
                      ? '1534528741775-53994a69daeb'
                      : evaluation.role.includes('cto') || evaluation.role.includes('vp') || evaluation.role.includes('lead')
                      ? '1507003211169-0a1dd7228f2d'
                      : evaluation.role.includes('security')
                      ? '1500648767791-00dcc994a43e'
                      : '1494790108377-be9c29b29330'
                  }?auto=format&fit=crop&w=240&h=240&q=80`}
                  alt={evaluation.personaName}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="drawer-title" className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                  {evaluation.personaName}
                </h2>
                <span
                  className={`text-xs px-3 py-0.5 rounded-full font-semibold border ${
                    evaluation.vote === 'adopt'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : evaluation.vote === 'reject'
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {evaluation.vote === 'adopt' ? '✓ WOULD BUY' : evaluation.vote === 'reject' ? '✕ PASSED' : '⇄ COUNTER-OFFER'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium">
                {persona?.title || evaluation.role.replace(/_/g, ' ')}
              </p>
              {persona?.companyProfile && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {persona.companyProfile}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close details drawer"
            className="h-9 w-9 rounded-full bg-[var(--surface-2)] border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-6 space-y-6 flex-1 text-xs">
          {/* Commercial Willingness to Pay Bento */}
          <div className="p-5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--border-subtle)] backdrop-blur-sm">
            <span className="text-[11px] font-medium tracking-wide uppercase text-[var(--text-muted)] block">
              Observed Willingness to Pay
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] num-tabular">
                ${evaluation.acceptablePrice}
              </span>
              <span className="text-sm text-[var(--text-muted)]">
                /{evaluation.acceptablePeriod}
              </span>
              {persona?.budgetCeiling && (
                <span className="text-xs text-[var(--text-muted)] ml-auto font-mono">
                  Ceiling: ${persona.budgetCeiling}/{persona.budgetPeriod}
                </span>
              )}
            </div>
          </div>

          {/* Interactive Sparring Action Button */}
          {onStartSparring && (
            <button
              onClick={() => {
                const effectivePersona: SyntheticPersona = persona || {
                  id: evaluation.personaId,
                  name: evaluation.personaName,
                  role: evaluation.role,
                  title: evaluation.role.replace(/_/g, ' '),
                  companyProfile: 'Enterprise Decision Maker',
                  budgetCeiling: Math.round(evaluation.acceptablePrice * 1.5) || 100,
                  budgetPeriod: evaluation.acceptablePeriod,
                  riskTolerance: 'medium',
                  primaryConstraint: evaluation.fatalObjections[0]?.objection || 'Budget and workflow constraints',
                  existingStack: ['Standard Stack'],
                  evaluationCriteria: ['Value', 'Reliability'],
                };
                onStartSparring(effectivePersona, evaluation);
              }}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all cursor-pointer text-xs"
            >
              <Zap className="h-4 w-4 fill-current" />
              <span>
                {evaluation.vote === 'adopt'
                  ? `Negotiate Contract & Expansion with ${evaluation.personaName}`
                  : `Spar / Negotiate Counter-Offer with ${evaluation.personaName}`}
              </span>
            </button>
          )}

          {/* Blunt Internal Rationale Quote */}
          <div className="space-y-2">
            <span className="text-[11px] font-medium tracking-wide uppercase text-[var(--text-muted)]">
              Buyer Internal Reasoning
            </span>
            <div className="p-5 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] text-[var(--text-secondary)] text-sm leading-relaxed italic">
              &ldquo;{evaluation.rationale}&rdquo;
            </div>
          </div>

          {/* Fatal Objections Raised with Evidence Links */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-[var(--text-muted)]">
              <ShieldAlert className="h-4 w-4 text-[var(--rose)]" />
              <span>Deal Breakers & Objections ({evaluation.fatalObjections.length})</span>
            </div>

            {evaluation.fatalObjections.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic p-4 rounded-xl bg-[var(--surface-2)]/40 border border-[var(--border-subtle)]">
                No fatal blockers identified by this decision-maker.
              </p>
            ) : (
              <div className="space-y-3">
                {evaluation.fatalObjections.map((fo, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[var(--surface-2)]/80 border border-[var(--border-subtle)] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-semibold text-xs text-[var(--text-primary)] leading-snug">
                        {fo.objection}
                      </span>
                      <Chip variant={fo.severity === 'blocker' ? 'rose' : 'amber'} size="sm">
                        {fo.severity.toUpperCase()}
                      </Chip>
                    </div>

                    {fo.evidenceSnippet && (
                      <p className="text-xs text-[var(--text-muted)] border-l-2 border-[var(--border-medium)] pl-3 italic leading-relaxed">
                        &ldquo;{fo.evidenceSnippet}&rdquo;
                      </p>
                    )}

                    {fo.groundedEvidenceUrl && (
                      <div className="pt-1">
                        <a
                          href={fo.groundedEvidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline font-medium"
                        >
                          <span>Verified Citation Source</span>
                          <ExternalLink className="h-3 w-3" />
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
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-[var(--text-muted)]">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span>Conversion Triggers & Deal-Makers</span>
              </div>
              <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                {evaluation.dealMakers.map((dm, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--surface-2)]/50 border border-[var(--border-subtle)]">
                    <span className="text-emerald-400 font-bold shrink-0">✓</span>
                    <span>{dm}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Persona Organizational Context (if available) */}
          {persona && (
            <div className="p-5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--border-subtle)] space-y-3">
              <span className="text-[11px] font-medium tracking-wide uppercase text-[var(--text-muted)] block">
                Buyer Profile
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">Risk Profile</span>
                  <span className="text-[var(--text-primary)] font-medium capitalize mt-0.5 block">{persona.riskTolerance}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">Current Stack</span>
                  <span className="text-[var(--text-primary)] font-medium truncate block mt-0.5">{persona.existingStack.join(', ')}</span>
                </div>
              </div>
              {persona.primaryConstraint && (
                <div className="pt-2 border-t border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] block text-[11px]">Primary Constraint:</span>
                  <span className="text-[var(--text-secondary)] italic mt-0.5 block">{persona.primaryConstraint}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
