'use client';

import React, { useState } from 'react';

export interface PersonaAvatarProps {
  name: string;
  role?: string;
  size?: 'sm' | 'md' | 'lg';
  vote?: 'adopt' | 'reject' | 'hesitant';
  className?: string;
}

// Diverse, high-resolution professional portrait photos
const CURATED_PORTRAITS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80', // Female DTC founder / tech lead
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80', // Male startup founder / iOS dev
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80', // Female operations & fulfillment lead
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80', // Male finance & bookkeeper
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=160&auto=format&fit=crop&q=80', // Female growth & retention director
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=160&auto=format&fit=crop&q=80', // Male store owner & maker
  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=160&auto=format&fit=crop&q=80', // Female COO & operations
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=160&auto=format&fit=crop&q=80', // Male subscription founder
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80', // Female e-commerce manager
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=160&auto=format&fit=crop&q=80', // Male enterprise procurement director
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=160&auto=format&fit=crop&q=80', // Female corporate controller
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&auto=format&fit=crop&q=80', // Female studio lead
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=160&auto=format&fit=crop&q=80', // Male tech lead
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=160&auto=format&fit=crop&q=80', // Male creator & developer
  'https://images.unsplash.com/photo-1548142813-c348350df52b?w=160&auto=format&fit=crop&q=80', // Female product specialist
];

const GRADIENT_PALETTES = [
  'from-indigo-600 to-violet-600',
  'from-emerald-600 to-teal-600',
  'from-amber-600 to-orange-600',
  'from-sky-600 to-blue-600',
  'from-rose-600 to-pink-600',
  'from-purple-600 to-indigo-600',
];

export const PersonaAvatar: React.FC<PersonaAvatarProps> = ({
  name,
  size = 'md',
  vote,
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  // Deterministic photo picker based on name hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const photoIndex = Math.abs(hash) % CURATED_PORTRAITS.length;
  const gradientIndex = Math.abs(hash) % GRADIENT_PALETTES.length;
  const photoUrl = CURATED_PORTRAITS[photoIndex];
  const gradient = GRADIENT_PALETTES[gradientIndex];

  // Initials
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');

  // Dimension classes
  const sizeClasses = {
    sm: 'h-8 w-8 text-[11px]',
    md: 'h-11 w-11 text-xs',
    lg: 'h-14 w-14 text-sm',
  }[size];

  // Status ring based on decision vote
  const ringClasses = vote === 'adopt'
    ? 'ring-2 ring-emerald-500/80 ring-offset-2 ring-offset-[var(--surface-1)] shadow-sm shadow-emerald-500/20'
    : vote === 'reject'
    ? 'ring-2 ring-rose-500/80 ring-offset-2 ring-offset-[var(--surface-1)]'
    : vote === 'hesitant'
    ? 'ring-2 ring-amber-500/80 ring-offset-2 ring-offset-[var(--surface-1)]'
    : 'ring-1 ring-[var(--border-subtle)]';

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className={`rounded-full overflow-hidden flex items-center justify-center font-bold text-white transition-transform ${sizeClasses} ${ringClasses}`}
      >
        {!hasError ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photoUrl}
            alt={name}
            onError={() => setHasError(true)}
            className="h-full w-full object-cover object-center select-none"
            loading="lazy"
          />
        ) : (
          <div className={`h-full w-full flex items-center justify-center bg-gradient-to-br ${gradient} select-none`}>
            {initials || 'BD'}
          </div>
        )}
      </div>

      {/* Floating decision badge icon */}
      {vote && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm border border-[var(--surface-1)] ${
            vote === 'adopt'
              ? 'bg-emerald-500'
              : vote === 'reject'
              ? 'bg-rose-500'
              : 'bg-amber-500'
          }`}
          title={vote.toUpperCase()}
        >
          {vote === 'adopt' ? '✓' : vote === 'reject' ? '✕' : '!'}
        </span>
      )}
    </div>
  );
};
