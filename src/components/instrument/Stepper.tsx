'use client';

import React from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';

export type StepState = 'idle' | 'active' | 'done' | 'error';

export interface StepItem {
  id: string;
  label: string;
  model: string;
  state: StepState;
}

export interface StepperProps {
  steps: StepItem[];
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({ steps, className = '' }) => {
  return (
    <nav
      aria-label="Simulation pipeline progress"
      className={`w-full bg-[var(--surface-1)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-3 sm:p-4 ${className}`}
    >
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-1 relative">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              {/* Step item */}
              <div
                className={`flex items-center md:flex-col md:items-center text-left md:text-center gap-2.5 md:gap-1.5 flex-1 min-w-0 transition-opacity ${
                  step.state === 'idle' ? 'opacity-40' : 'opacity-100'
                }`}
              >
                {/* Status Indicator Icon */}
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-mono font-bold transition-all ${
                    step.state === 'done'
                      ? 'bg-[var(--accent)] text-white shadow-sm shadow-[var(--accent)]/30'
                      : step.state === 'active'
                      ? 'bg-[var(--accent-muted)] border border-[var(--accent)] text-[var(--accent)]'
                      : step.state === 'error'
                      ? 'bg-[var(--rose-muted)] border border-[var(--rose)] text-[var(--rose)]'
                      : 'bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  {step.state === 'done' ? (
                    <Check className="h-3 w-3 stroke-[3]" />
                  ) : step.state === 'active' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
                  ) : step.state === 'error' ? (
                    <AlertCircle className="h-3.5 w-3.5 text-[var(--rose)]" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Text Labels */}
                <div className="min-w-0 flex-1 md:flex-initial">
                  <div
                    className={`text-xs font-medium truncate ${
                      step.state === 'active'
                        ? 'text-[var(--accent)] font-semibold'
                        : step.state === 'done'
                        ? 'text-[var(--text-primary)]'
                        : step.state === 'error'
                        ? 'text-[var(--rose)]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                    {step.model}
                  </div>
                </div>
              </div>

              {/* Connecting line between steps on desktop */}
              {!isLast && (
                <div
                  aria-hidden="true"
                  className="hidden md:block h-[1px] flex-1 mx-1 bg-[var(--border-subtle)] relative self-center"
                >
                  <div
                    className={`h-full transition-all duration-300 ${
                      step.state === 'done' ? 'bg-[var(--accent)]/50' : 'bg-transparent'
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};
