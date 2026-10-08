'use client';

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-full cursor-pointer select-none active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none tracking-tight';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5 min-h-[32px]',
    md: 'text-xs px-4 py-2 gap-2 min-h-[38px]',
    lg: 'text-sm px-6 py-2.5 gap-2.5 font-semibold min-h-[44px]',
  };

  const variantStyles = {
    primary:
      'bg-white text-black hover:bg-zinc-200 shadow-md shadow-white/10 dark:bg-white dark:text-black dark:hover:bg-zinc-200 font-semibold',
    secondary:
      'bg-[var(--surface-2)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] backdrop-blur-md',
    ghost:
      'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] border border-transparent',
    danger:
      'bg-[var(--rose-muted)] text-[var(--rose)] hover:bg-[var(--rose)]/20 border border-[var(--rose-border)]',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
