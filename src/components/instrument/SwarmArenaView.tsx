'use client';

import React, { useState, useMemo } from 'react';
import {
  Compass,
  Users,
  Flame,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Zap,
  Filter,
  DollarSign,
  TrendingUp,
  SlidersHorizontal,
  ExternalLink,
  Eye,
  Radio,
} from 'lucide-react';
import {
  PersonaEvaluation,
  SyntheticPersona,
  PersonaVote,
} from '@/core/synthetic-lab/types';
import { PersonaAvatar } from './PersonaAvatar';

export interface SwarmArenaViewProps {
  evaluations: PersonaEvaluation[];
  personas: SyntheticPersona[];
  proposedPrice: number;
  billingPeriod: string;
  onSelectEvaluation: (ev: PersonaEvaluation) => void;
  onOpenSparring?: (persona: SyntheticPersona, ev: PersonaEvaluation) => void;
  activeCohortView: 'cohortA' | 'cohortB';
  isHoldOutVerified?: boolean;
}

export const SwarmArenaView: React.FC<SwarmArenaViewProps> = ({
  evaluations,
  personas,
  proposedPrice,
  billingPeriod,
  onSelectEvaluation,
  onOpenSparring,
  activeCohortView,
  isHoldOutVerified,
}) => {
  // Primary View Switcher: 'radar' (Constellation) | 'boardroom' (Deliberation Floor)
  const [viewMode, setViewMode] = useState<'radar' | 'boardroom'>('radar');

  // Filter: 'all' | 'adopt' | 'hesitant' | 'reject' | 'in_market'
  const [filterMode, setFilterMode] = useState<'all' | 'adopt' | 'hesitant' | 'reject' | 'in_market'>('all');

  // Hovered and selected persona in constellation
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [hoveredPersonaId, setHoveredPersonaId] = useState<string | null>(null);

  // Helper mapping from evaluation to full persona profile
  const personaMap = useMemo(() => {
    const map = new Map<string, SyntheticPersona>();
    personas.forEach((p) => {
      map.set(p.id, p);
      map.set(p.name.toLowerCase(), p);
    });
    return map;
  }, [personas]);

  // Filtered evaluations
  const filteredEvaluations = useMemo(() => {
    return evaluations.filter((ev) => {
      const p = personaMap.get(ev.personaId) || personaMap.get(ev.personaName.toLowerCase());
      if (filterMode === 'adopt') return ev.vote === 'adopt';
      if (filterMode === 'hesitant') return ev.vote === 'hesitant';
      if (filterMode === 'reject') return ev.vote === 'reject';
      if (filterMode === 'in_market') return !ev.isOutOfMarket && !p?.isOutOfMarket;
      return true;
    });
  }, [evaluations, filterMode, personaMap]);

  // Aggregate stats
  const adoptCount = evaluations.filter((e) => e.vote === 'adopt').length;
  const hesitantCount = evaluations.filter((e) => e.vote === 'hesitant').length;
  const rejectCount = evaluations.filter((e) => e.vote === 'reject').length;
  const inMarketCount = evaluations.filter((e) => !e.isOutOfMarket).length;
  const totalCount = evaluations.length || 1;

  const adoptPercent = Math.round((adoptCount / totalCount) * 100);
  const hesitantPercent = Math.round((hesitantCount / totalCount) * 100);
  const rejectPercent = Math.round((rejectCount / totalCount) * 100);

  // The Tension Clash: Identify fiercest rejector vs highest champion
  const tensionClash = useMemo(() => {
    const adopters = evaluations.filter((e) => e.vote === 'adopt');
    const rejectors = evaluations.filter((e) => e.vote === 'reject' && !e.isOutOfMarket);

    const topChampion = adopters.reduce<PersonaEvaluation | null>((prev, curr) => {
      if (!prev) return curr;
      return curr.acceptablePrice > prev.acceptablePrice ? curr : prev;
    }, null) || adopters[0] || null;

    const fiercestDissenter = rejectors.reduce<PersonaEvaluation | null>((prev, curr) => {
      if (!prev) return curr;
      const prevBlockers = prev.fatalObjections.length;
      const currBlockers = curr.fatalObjections.length;
      return currBlockers > prevBlockers ? curr : prev;
    }, null) || rejectors[0] || evaluations.find((e) => e.vote === 'reject') || null;

    return { topChampion, fiercestDissenter };
  }, [evaluations]);

  // Safe fallback to get or create a synthetic persona profile
  const getPersona = (ev: PersonaEvaluation): SyntheticPersona => {
    return (
      personaMap.get(ev.personaId) ||
      personaMap.get(ev.personaName.toLowerCase()) || {
        id: ev.personaId,
        name: ev.personaName,
        role: ev.role,
        title: ev.role.replace(/_/g, ' '),
        companyProfile: 'Target Decision Maker',
        budgetCeiling: Math.round(ev.acceptablePrice * 1.5) || proposedPrice || 350,
        budgetPeriod: ev.acceptablePeriod || billingPeriod,
        riskTolerance: 'medium',
        primaryConstraint: ev.fatalObjections[0]?.objection || 'Budget and workflow constraints',
        existingStack: ['Production Stack'],
        evaluationCriteria: ['Value', 'Reliability'],
        isOutOfMarket: ev.isOutOfMarket,
        audienceMatch: ev.isOutOfMarket ? 'out_of_market' : 'in_market',
      }
    );
  };


  // Background ambient starry dust coordinates (deterministic)
  const cosmicDust = useMemo(() => {
    return Array.from({ length: 28 }).map((_, i) => ({
      x: ((i * 37) % 94) + 3,
      y: ((i * 47) % 92) + 4,
      size: (i % 3 === 0 ? 2 : 1),
      opacity: 0.15 + (i % 5) * 0.12,
    }));
  }, []);

  // Compute Non-Colliding Celestial Coordinates & Constellation Lines
  const { starCoordinates, constellationVectors } = useMemo(() => {
    const coords = new Map<string, { x: number; y: number; sector: 'adopt' | 'hesitant' | 'reject' }>();
    const lines: Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      sector: 'adopt' | 'hesitant' | 'reject';
      fromId: string;
      toId: string;
    }> = [];

    // 1. GALACTIC CONSTELLATION: 3 Harmonic Celestial Star Clusters
    // Sector Centers:
    // Adoption Nexus: Upper-East (Green Nebula)
    // Equilibrium Belt: Center-South (Amber Nebula)
    // Friction Horizon: Upper-West (Rose Nebula)
    const sectorAnchors = {
      adopt: { cx: 76, cy: 36, spread: filteredEvaluations.length > 25 ? 4.6 : 5.8 },
      hesitant: { cx: 50, cy: 72, spread: filteredEvaluations.length > 25 ? 4.6 : 5.8 },
      reject: { cx: 22, cy: 36, spread: filteredEvaluations.length > 25 ? 4.6 : 5.8 },
    };

    // Group by vote
    const groups: Record<'adopt' | 'hesitant' | 'reject', PersonaEvaluation[]> = {
      adopt: [],
      hesitant: [],
      reject: [],
    };

    filteredEvaluations.forEach((ev) => {
      if (ev.vote === 'adopt') groups.adopt.push(ev);
      else if (ev.vote === 'hesitant') groups.hesitant.push(ev);
      else groups.reject.push(ev);
    });

    // Place stars using golden ratio polar phyllotaxis (Fibonacci spiral dispersion)
    (['adopt', 'hesitant', 'reject'] as const).forEach((sector) => {
      const group = groups[sector];
      const { cx, cy, spread } = sectorAnchors[sector];
      const placedPoints: Array<{ id: string; x: number; y: number }> = [];

      group.forEach((ev, idx) => {
        // Golden angle = 137.508° (2.39996 rad)
        const angle = idx * 2.39996;
        // Radius expands gracefully with sqrt(idx + 1)
        const radius = Math.sqrt(idx + 0.6) * spread;

        let x = cx + radius * Math.cos(angle);
        let y = cy + radius * Math.sin(angle);

        // Sector-safe bounds
        if (sector === 'adopt') {
          x = Math.max(54, Math.min(94, x));
          y = Math.max(14, Math.min(64, y));
        } else if (sector === 'hesitant') {
          x = Math.max(26, Math.min(74, x));
          y = Math.max(48, Math.min(88, y));
        } else {
          x = Math.max(6, Math.min(46, x));
          y = Math.max(14, Math.min(64, y));
        }

        coords.set(ev.personaId, { x, y, sector });
        placedPoints.push({ id: ev.personaId, x, y });
      });

      // Generate constellation connection lines between adjacent stars in cluster
      for (let i = 0; i < placedPoints.length; i++) {
        const p1 = placedPoints[i];
        // Connect to sequential star or nearest partner to create astronomy constellation shapes
        if (i + 1 < placedPoints.length) {
          const p2 = placedPoints[i + 1];
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          if (dist < 26) {
            lines.push({
              id: `${p1.id}-${p2.id}`,
              x1: p1.x,
              y1: p1.y,
              x2: p2.x,
              y2: p2.y,
              color:
                sector === 'adopt'
                  ? 'rgba(52, 211, 153, 0.35)'
                  : sector === 'hesitant'
                  ? 'rgba(251, 191, 36, 0.35)'
                  : 'rgba(244, 63, 94, 0.35)',
              sector,
              fromId: p1.id,
              toId: p2.id,
            });
          }
        }
        // Extra cross-filament for richer celestial web
        if (i + 2 < placedPoints.length && i % 3 === 0) {
          const p3 = placedPoints[i + 2];
          const dist = Math.hypot(p3.x - p1.x, p3.y - p1.y);
          if (dist < 32) {
            lines.push({
              id: `${p1.id}-${p3.id}`,
              x1: p1.x,
              y1: p1.y,
              x2: p3.x,
              y2: p3.y,
              color:
                sector === 'adopt'
                  ? 'rgba(52, 211, 153, 0.2)'
                  : sector === 'hesitant'
                  ? 'rgba(251, 191, 36, 0.2)'
                  : 'rgba(244, 63, 94, 0.2)',
              sector,
              fromId: p1.id,
              toId: p3.id,
            });
          }
        }
      }
    });

    return { starCoordinates: coords, constellationVectors: lines };
  }, [filteredEvaluations]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. APPLE TRANSLUCENT SEGMENTED CONTROL BAR */}
      <div className="p-2.5 sm:p-3 rounded-2xl bg-[var(--surface-1)]/70 backdrop-blur-3xl border border-white/[0.08] shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: Apple Segmented Pill Switcher */}
        <div className="inline-flex p-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-xl shrink-0 self-start sm:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => setViewMode('radar')}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              viewMode === 'radar'
                ? 'bg-white text-black shadow-md font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Swarm Constellation</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${viewMode === 'radar' ? 'bg-black/10 text-black' : 'bg-white/10 text-zinc-400'}`}>
              Map
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('boardroom')}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              viewMode === 'boardroom'
                ? 'bg-white text-black shadow-md font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Executive Boardroom</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${viewMode === 'boardroom' ? 'bg-black/10 text-black' : 'bg-white/10 text-zinc-400'}`}>
              Deliberation
            </span>
          </button>
        </div>

        {/* Right: Apple Minimalist Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1 shrink-0 mr-1 pl-1">
            <Filter className="h-3 w-3" />
            Filter:
          </span>

          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
              filterMode === 'all'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.06]'
            }`}
          >
            All ({evaluations.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('adopt')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              filterMode === 'adopt'
                ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Adopters ({adoptCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('hesitant')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              filterMode === 'hesitant'
                ? 'bg-amber-500 text-black font-semibold shadow-sm'
                : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Hesitant ({hesitantCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('reject')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              filterMode === 'reject'
                ? 'bg-rose-500 text-white font-semibold shadow-sm'
                : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Rejections ({rejectCount})
          </button>
        </div>
      </div>

      {/* 2. VIEW 1: APPLE CELESTIAL SWARM CONSTELLATION MAP */}
      {viewMode === 'radar' && (
        <div className="space-y-4">
          <div className="relative p-6 sm:p-8 rounded-3xl bg-[#08090d] border border-white/[0.1] shadow-[0_20px_70px_rgba(0,0,0,0.85)] overflow-hidden">
            {/* Specular Ambient Glow & Cosmic Dust */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Cosmic dust stars */}
              {cosmicDust.map((star, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-white transition-opacity duration-1000"
                  style={{
                    left: `${star.x}%`,
                    top: `${star.y}%`,
                    width: `${star.size}px`,
                    height: `${star.size}px`,
                    opacity: star.opacity,
                  }}
                />
              ))}

              {/* 3 Sector Nebula Glows */}
              <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-emerald-500/[0.08] blur-[90px]" />
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[480px] h-[320px] rounded-full bg-amber-500/[0.07] blur-[100px]" />
              <div className="absolute top-10 left-10 w-80 h-80 rounded-full bg-rose-500/[0.07] blur-[90px]" />

              {/* Polar Astronomical Radar Rings */}
              <div className="absolute inset-x-0 inset-y-0 flex items-center justify-center">
                <div className="w-[85%] h-[85%] rounded-full border border-white/[0.03]" />
                <div className="absolute w-[60%] h-[60%] rounded-full border border-white/[0.04]" />
                <div className="absolute w-[35%] h-[35%] rounded-full border border-white/[0.05]" />
                <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                <div className="absolute h-full w-[1px] bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />
              </div>
            </div>

            {/* Constellation Header */}
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5 mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                    Celestial Swarm Constellation • Gravitational Decision Field
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight flex items-center gap-2.5 mt-1">
                  <span>{filteredEvaluations.length} Decision Maker Stars In Orbit</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-300 font-mono font-normal border border-white/10">
                    Target ICP & Stress Tests
                  </span>
                </h3>
              </div>
            </div>

            {/* 3 Translucent Apple Glass Sector Banners */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/25 backdrop-blur-xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                  <span className="font-semibold text-emerald-300 text-xs tracking-tight">Adoption Nexus</span>
                </div>
                <span className="font-mono text-emerald-400 font-bold">
                  {adoptCount} stars ({adoptPercent}%)
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/25 backdrop-blur-xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#fbbf24]" />
                  <span className="font-semibold text-amber-300 text-xs tracking-tight">Equilibrium Belt</span>
                </div>
                <span className="font-mono text-amber-400 font-bold">
                  {hesitantCount} stars ({hesitantPercent}%)
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/25 backdrop-blur-xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400 shadow-[0_0_10px_#f43f5e]" />
                  <span className="font-semibold text-rose-300 text-xs tracking-tight">Friction Horizon</span>
                </div>
                <span className="font-mono text-rose-400 font-bold">
                  {rejectCount} stars ({rejectPercent}%)
                </span>
              </div>
            </div>

            {/* Apple VisionOS Interactive Constellation Space Canvas */}
            <div className="relative z-10 w-full h-[540px] sm:h-[620px] rounded-2xl bg-black/40 border border-white/10 overflow-hidden select-none">
              {/* SVG Constellation Vectors (Celestial Connector Lines) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                {constellationVectors.map((line) => {
                  const isHighlighted =
                    activePersonaId === line.fromId ||
                    activePersonaId === line.toId ||
                    hoveredPersonaId === line.fromId ||
                    hoveredPersonaId === line.toId;

                  return (
                    <line
                      key={line.id}
                      x1={`${line.x1}%`}
                      y1={`${line.y1}%`}
                      x2={`${line.x2}%`}
                      y2={`${line.y2}%`}
                      stroke={isHighlighted ? '#60a5fa' : line.color}
                      strokeWidth={isHighlighted ? 2 : 1}
                      strokeDasharray={isHighlighted ? 'none' : '3 4'}
                      className="transition-all duration-300"
                    />
                  );
                })}
              </svg>

              {/* Luminous Apple Star Nodes (Avatars in Celestial Orbit) */}
              {filteredEvaluations.map((ev) => {
                const coord = starCoordinates.get(ev.personaId) || { x: 50, y: 50, sector: 'hesitant' };
                const p = getPersona(ev);
                const isSelected = activePersonaId === ev.personaId;
                const isHovered = hoveredPersonaId === ev.personaId;
                const isAdopt = ev.vote === 'adopt';
                const isReject = ev.vote === 'reject';

                return (
                  <div
                    key={ev.personaId}
                    style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
                    onMouseEnter={() => setHoveredPersonaId(ev.personaId)}
                    onMouseLeave={() => setHoveredPersonaId(null)}
                    onClick={() => {
                      setActivePersonaId(ev.personaId);
                      onSelectEvaluation(ev);
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer transition-transform duration-200 group ${
                      isSelected ? 'scale-125 z-40' : isHovered ? 'scale-115 z-30' : 'hover:scale-110'
                    }`}
                  >
                    {/* Apple Floating Persona Orb */}
                    <div className="relative">
                      {/* Luminous Aura Glow */}
                      <div
                        className={`absolute -inset-2.5 rounded-full blur-[10px] transition-all duration-300 pointer-events-none ${
                          isAdopt
                            ? 'bg-emerald-500/50'
                            : isReject
                            ? 'bg-rose-500/50'
                            : 'bg-amber-500/50'
                        } ${isSelected || isHovered ? 'opacity-100 scale-150' : 'opacity-40 group-hover:opacity-90'}`}
                      />

                      {/* Frosted Glass Avatar Shell */}
                      <div className="relative p-0.5 rounded-full bg-white/20 backdrop-blur-md shadow-xl transition-transform">
                        <PersonaAvatar
                          name={ev.personaName}
                          role={ev.role}
                          vote={ev.vote}
                          size="sm"
                          className="h-8 w-8 sm:h-9 sm:w-9"
                        />
                        {/* Vote Micro-Badge Pill */}
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-black flex items-center justify-center text-[8px] font-bold text-black shadow-md ${
                            isAdopt
                              ? 'bg-emerald-400'
                              : isReject
                              ? 'bg-rose-400'
                              : 'bg-amber-400'
                          }`}
                        >
                          {isAdopt ? '✓' : isReject ? '✕' : '?'}
                        </div>
                      </div>

                      {/* VisionOS Active Focus Reticle */}
                      {isSelected && (
                        <div className="absolute -inset-2.5 rounded-full border-2 border-blue-400/80 animate-pulse pointer-events-none ring-4 ring-blue-500/20" />
                      )}
                    </div>

                    {/* Floating Apple Glass Telemetry Card on Hover */}
                    {isHovered && !isSelected && (
                      <div className="absolute bottom-11 left-1/2 -translate-x-1/2 w-64 p-3.5 rounded-2xl bg-zinc-950/90 border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-3xl text-left pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs text-white truncate">{ev.personaName}</span>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                              isAdopt
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : isReject
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {ev.vote}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate">
                          {p.title} • {p.companyProfile}
                        </div>
                        <p className="text-[11px] text-zinc-300 italic line-clamp-2 leading-relaxed">
                          &ldquo;{ev.rationale}&rdquo;
                        </p>
                        <div className="flex items-center justify-between text-[10px] font-mono pt-1.5 border-t border-white/10">
                          <span className="text-zinc-400">
                            WTP: <strong className="text-white font-semibold">${ev.acceptablePrice}/{billingPeriod}</strong>
                          </span>
                          <span className="text-rose-400 font-semibold">{p.monthlyLossOrProblemCost}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>


          </div>
        </div>
      )}

      {/* 3. VIEW 2: EXECUTIVE BOARDROOM DELIBERATION FLOOR */}
      {viewMode === 'boardroom' && (
        <div className="space-y-6">
          {/* Tension Clash Pinboard: The Fiercest Skeptic vs The Top Champion */}
          {tensionClash.topChampion && tensionClash.fiercestDissenter && (
            <div className="relative p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-rose-950/20 via-zinc-950/60 to-emerald-950/20 backdrop-blur-3xl border border-white/[0.1] shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-mono uppercase tracking-wider text-amber-300 font-bold">
                    The Boardroom Duel • Dissenter vs Champion
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
                  Divergent willingness-to-pay on the same pitch
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dissenter Card */}
                <div className="p-5 rounded-2xl bg-rose-500/[0.06] border border-rose-500/20 backdrop-blur-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <PersonaAvatar
                        name={tensionClash.fiercestDissenter.personaName}
                        role={tensionClash.fiercestDissenter.role}
                        vote="reject"
                        size="sm"
                      />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{tensionClash.fiercestDissenter.personaName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-semibold">
                            REJECT ($0/{billingPeriod})
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {getPersona(tensionClash.fiercestDissenter).companyProfile}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-rose-200/90 italic leading-relaxed">
                    &ldquo;{tensionClash.fiercestDissenter.rationale}&rdquo;
                  </p>
                  {tensionClash.fiercestDissenter.fatalObjections[0] && (
                    <div className="text-[11px] text-rose-300 bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/20 font-medium">
                      Core Blocker: {tensionClash.fiercestDissenter.fatalObjections[0].objection}
                    </div>
                  )}
                </div>

                {/* Champion Card */}
                <div className="p-5 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 backdrop-blur-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <PersonaAvatar
                        name={tensionClash.topChampion.personaName}
                        role={tensionClash.topChampion.role}
                        vote="adopt"
                        size="sm"
                      />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{tensionClash.topChampion.personaName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold">
                            ADOPT (${tensionClash.topChampion.acceptablePrice}/{billingPeriod})
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {getPersona(tensionClash.topChampion).companyProfile}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-200/90 italic leading-relaxed">
                    &ldquo;{tensionClash.topChampion.rationale}&rdquo;
                  </p>
                  {tensionClash.topChampion.dealMakers[0] && (
                    <div className="text-[11px] text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 font-medium">
                      Why bought: {tensionClash.topChampion.dealMakers[0]}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3 Apple Translucent Deliberation Swimlanes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Column 1: Adopters */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/20 backdrop-blur-xl">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Commercial Adopters ({adoptCount})
                </span>
                <span className="text-[10px] font-mono text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/15">
                  Net-Positive ROI
                </span>
              </div>

              <div className="space-y-3">
                {evaluations
                  .filter((e) => e.vote === 'adopt')
                  .slice(0, 15)
                  .map((ev) => {
                    const p = getPersona(ev);
                    return (
                      <div
                        key={ev.personaId}
                        onClick={() => onSelectEvaluation(ev)}
                        className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-emerald-500/40 transition-all duration-200 cursor-pointer space-y-2.5 group shadow-sm hover:shadow-xl hover:-translate-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <PersonaAvatar name={ev.personaName} role={ev.role} vote={ev.vote} size="sm" />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
                                {ev.personaName}
                              </div>
                              <div className="text-[10px] text-zinc-400 truncate">{p.title}</div>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                            ${ev.acceptablePrice}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-300 italic line-clamp-2 leading-relaxed">
                          &ldquo;{ev.rationale}&rdquo;
                        </p>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Column 2: Hesitant / Fence-Sitters */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/[0.08] border border-amber-500/20 backdrop-blur-xl">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Hesitant Fence-Sitters ({hesitantCount})
                </span>
                <span className="text-[10px] font-mono text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/15">
                  Convertible
                </span>
              </div>

              <div className="space-y-3">
                {evaluations
                  .filter((e) => e.vote === 'hesitant')
                  .slice(0, 15)
                  .map((ev) => {
                    const p = getPersona(ev);
                    return (
                      <div
                        key={ev.personaId}
                        onClick={() => onSelectEvaluation(ev)}
                        className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-amber-500/40 transition-all duration-200 cursor-pointer space-y-2.5 group shadow-sm hover:shadow-xl hover:-translate-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <PersonaAvatar name={ev.personaName} role={ev.role} vote={ev.vote} size="sm" />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white group-hover:text-amber-400 transition-colors truncate">
                                {ev.personaName}
                              </div>
                              <div className="text-[10px] text-zinc-400 truncate">{p.title}</div>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30 shrink-0">
                            ${ev.acceptablePrice}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-300 italic line-clamp-2 leading-relaxed">
                          &ldquo;{ev.rationale}&rdquo;
                        </p>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Column 3: Disqualified Rejections */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-500/[0.08] border border-rose-500/20 backdrop-blur-xl">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Disqualified / Passed ({rejectCount})
                </span>
                <span className="text-[10px] font-mono text-rose-300 px-2 py-0.5 rounded-full bg-rose-500/15">
                  Fatal Blockers
                </span>
              </div>

              <div className="space-y-3">
                {evaluations
                  .filter((e) => e.vote === 'reject')
                  .slice(0, 15)
                  .map((ev) => {
                    const p = getPersona(ev);
                    return (
                      <div
                        key={ev.personaId}
                        onClick={() => onSelectEvaluation(ev)}
                        className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-rose-500/40 transition-all duration-200 cursor-pointer space-y-2.5 group shadow-sm hover:shadow-xl hover:-translate-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <PersonaAvatar name={ev.personaName} role={ev.role} vote={ev.vote} size="sm" />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white group-hover:text-rose-400 transition-colors truncate">
                                {ev.personaName}
                              </div>
                              <div className="text-[10px] text-zinc-400 truncate">
                                {ev.isOutOfMarket ? 'Out of Market' : p.title}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/15 px-2.5 py-0.5 rounded-full border border-rose-500/30 shrink-0">
                            $0
                          </span>
                        </div>
                        {ev.fatalObjections[0] && (
                          <div className="text-[10px] text-rose-300/90 font-medium line-clamp-2 bg-rose-500/10 p-2 rounded-xl border border-rose-500/15">
                            Blocker: {ev.fatalObjections[0].objection}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
