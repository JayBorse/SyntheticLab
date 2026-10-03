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
      className={`p-4 rounded-[var(--radius-lg)] bg-[var(--surface-1)] border border-[var(--border-subtle)] flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-medium">
            {label}
          </span>
          {sampleSize && (
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              (n = {sampleSize})
            </span>
          )}
        </div>

        <div className="mt-2 flex items-baseline gap-1.5">
          <span className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight num-tabular ${valueColors[variant]}`}>
            {value}
          </span>
          {unit && (
            <span className="text-xs font-mono text-[var(--text-muted)] font-medium">
              {unit}
            </span>
          )}
        </div>
      </div>

      {range && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] mb-1">
            <span>Range: {range.min}{range.unit || unit || ''}</span>
            <span>{range.max}{range.unit || unit || ''}</span>
          </div>
          <div className="h-1 w-full bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                variant === 'accent' ? 'bg-[var(--accent)]' : variant === 'amber' ? 'bg-[var(--amber)]' : 'bg-[var(--text-secondary)]'
              }`}
              style={{ width: `${rangePercent}%` }}
            />
          </div>
        </div>
      )}

      {secondaryText && !range && (
        <p className="mt-2 text-[11px] font-mono text-[var(--text-muted)]">
          {secondaryText}
        </p>
      )}
    </div>
  );
};
