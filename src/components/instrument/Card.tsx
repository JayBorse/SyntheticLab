'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 1 | 2 | 3;
  bordered?: boolean;
  padded?: boolean | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  elevation = 1,
  bordered = true,
  padded = 'md',
  className = '',
  ...props
}) => {
  const elevationStyles = {
    1: 'bg-[var(--surface-1)]/80 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)]',
    2: 'bg-[var(--surface-2)]/85 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)]',
    3: 'bg-[var(--surface-3)]/90 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.25)]',
  };

  const paddingStyles = {
    false: '',
    true: 'p-4 sm:p-5',
    sm: 'p-3.5 sm:p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  const padClass = typeof padded === 'boolean' ? paddingStyles[String(padded) as 'true' | 'false'] : paddingStyles[padded];

  return (
    <div
      className={`rounded-2xl ${elevationStyles[elevation]} ${
        bordered ? 'border border-[var(--border-subtle)]' : ''
      } ${padClass} ${className} transition-all duration-300`}
      {...props}
    >
      {children}
    </div>
  );
};
