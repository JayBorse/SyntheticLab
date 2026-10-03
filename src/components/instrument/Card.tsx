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
    1: 'bg-[var(--surface-1)]',
    2: 'bg-[var(--surface-2)]',
    3: 'bg-[var(--surface-3)]',
  };

  const paddingStyles = {
    false: '',
    true: 'p-4',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6 md:p-8',
  };

  const padClass = typeof padded === 'boolean' ? paddingStyles[String(padded) as 'true' | 'false'] : paddingStyles[padded];

  return (
    <div
      className={`rounded-[var(--radius-lg)] ${elevationStyles[elevation]} ${
        bordered ? 'border border-[var(--border-subtle)]' : ''
      } ${padClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
