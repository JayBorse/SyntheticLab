'use client';

import React from 'react';

export interface StatProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  sampleSize?: number | string; // e.g. 10 -> renders (n = 10)
  range?: {
    min: number;
    max: number;
    current?: number;
    unit?: string;
  };
  secondaryText?: string;
  variant?: 'default' | 'accent' | 'amber' | 'rose';
  className?: string;
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  unit,
  sampleSize,
  range,
  secondaryText,
  variant = 'default',
  className = '',
}) => {
  const valueColors = {
    default: 'text-[var(--text-primary)]',
    accent: 'text-[var(--accent)]',
    amber: 'text-[var(--amber)]',
    rose: 'text-[var(--rose)]',
  };

  // Compute normalized bar position if range is provided
  let rangePercent = 50;
  if (range && range.max > range.min) {
    const cur = range.current ?? (typeof value === 'number' ? value : range.min);
    rangePercent = Math.min(100, Math.max(0, ((cur - range.min) / (range.max - range.min)) * 100));
  }

  return (
    <div
      className={`p-5 sm:p-6 rounded-2xl bg-[var(--surface-1)]/80 backdrop-blur-2xl border border-[var(--border-subtle)] hover:border-[var(--border-medium)] transition-all duration-300 flex flex-col justify-between shadow-sm hover:shadow-md ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium tracking-tight text-[var(--text-secondary)]">
            {label}
          </span>
          {sampleSize && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
              n = {sampleSize}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-baseline gap-1.5">
          <span className={`text-3xl sm:text-4xl font-semibold tracking-tight num-tabular ${valueColors[variant]}`}>
            {value}
          </span>
          {unit && (
            <span className="text-xs text-[var(--text-muted)] font-normal">
              {unit}
            </span>
          )}
        </div>
      </div>

      {range && (
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] mb-1.5">
            <span>Low: {range.min}{range.unit || unit || ''}</span>
            <span>High: {range.max}{range.unit || unit || ''}</span>
          </div>
          <div className="h-1.5 w-full bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                variant === 'accent' ? 'bg-[var(--accent)]' : variant === 'amber' ? 'bg-[var(--amber)]' : 'bg-white'
              }`}
              style={{ width: `${rangePercent}%` }}
            />
          </div>
        </div>
      )}

      {secondaryText && !range && (
        <p className="mt-3 text-xs text-[var(--text-muted)] leading-relaxed">
          {secondaryText}
        </p>
      )}
    </div>
  );
};
