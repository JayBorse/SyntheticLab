'use client';

import React from 'react';

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'accent' | 'amber' | 'rose' | 'outline';
  size?: 'sm' | 'md';
  pulseDot?: boolean;
}

export const Chip: React.FC<ChipProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  pulseDot = false,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  const variantStyles = {
    neutral: 'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border-subtle)]',
    accent: 'bg-[var(--accent-muted)] text-[var(--accent)] border border-[var(--accent-border)] font-medium',
    amber: 'bg-[var(--amber-muted)] text-[var(--amber)] border border-[var(--amber-border)] font-medium',
    rose: 'bg-[var(--rose-muted)] text-[var(--rose)] border border-[var(--rose-border)] font-medium',
    outline: 'bg-transparent text-[var(--text-muted)] border border-[var(--border-subtle)] font-mono',
  };

  const dotColor = {
    neutral: 'bg-[var(--text-muted)]',
    accent: 'bg-[var(--accent)]',
    amber: 'bg-[var(--amber)]',
    rose: 'bg-[var(--rose)]',
    outline: 'bg-[var(--text-muted)]',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-mono transition-colors ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {pulseDot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor[variant]}`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor[variant]}`} />
        </span>
      )}
      <span>{children}</span>
    </span>
  );
};
