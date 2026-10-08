'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

export interface BannerProps {
  variant?: 'amber' | 'accent' | 'rose' | 'neutral';
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const Banner: React.FC<BannerProps> = ({
  variant = 'amber',
  title,
  children,
  action,
  className = '',
}) => {
  const styles = {
    amber: {
      container: 'bg-[var(--amber-muted)] border-[var(--amber-border)] text-[var(--amber)]',
      icon: <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--amber)] mt-0.5" />,
      text: 'text-[var(--text-primary)]',
    },
    accent: {
      container: 'bg-[var(--accent-muted)] border-[var(--accent-border)] text-[var(--accent)]',
      icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--accent)] mt-0.5" />,
      text: 'text-[var(--text-primary)]',
    },
    rose: {
      container: 'bg-[var(--rose-muted)] border-[var(--rose-border)] text-[var(--rose)]',
      icon: <XCircle className="h-4 w-4 shrink-0 text-[var(--rose)] mt-0.5" />,
      text: 'text-[var(--text-primary)]',
    },
    neutral: {
      container: 'bg-[var(--surface-2)] border-[var(--border-subtle)] text-[var(--text-secondary)]',
      icon: <Info className="h-4 w-4 shrink-0 text-[var(--text-muted)] mt-0.5" />,
      text: 'text-[var(--text-secondary)]',
    },
  };

  const current = styles[variant];

  return (
    <div
      role="alert"
      className={`p-4 sm:p-5 rounded-xl border backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm ${current.container} ${className}`}
    >
      <div className="flex items-start gap-3">
        {current.icon}
        <div className="space-y-0.5">
          {title && <div className="font-semibold text-sm">{title}</div>}
          <div className={`${current.text} leading-relaxed`}>{children}</div>
        </div>
      </div>
      {action && <div className="shrink-0 self-end sm:self-auto">{action}</div>}
    </div>
  );
};
