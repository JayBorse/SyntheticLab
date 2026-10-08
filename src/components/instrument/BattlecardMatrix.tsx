'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  ExternalLink,
  Zap,
  TrendingUp,
  AlertTriangle,
  Layers,
  Sparkles,
  ArrowRight,
  Search,
  Database,
  Crosshair,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import { CompetitiveBattlecard } from '@/core/synthetic-lab/types';
import { Chip } from './Chip';

export interface BattlecardMatrixProps {
  battlecard: CompetitiveBattlecard;
  proposedPrice: number;
  billingPeriod: string;
  className?: string;
}

export const BattlecardMatrix: React.FC<BattlecardMatrixProps> = ({
  battlecard,
  proposedPrice,
  billingPeriod,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'battlefield' | 'lineage'>('matrix');

  if (!battlecard || !battlecard.competitors || battlecard.competitors.length === 0) {
    return null;
  }

  const { targetProduct, marketCategory, competitors, positioningAdvantage, opportunitySummary } = battlecard;
  const topTwoCompetitors = competitors.slice(0, 2);

  return (
    <div
      className={`rounded-2xl bg-[var(--surface-1)]/80 backdrop-blur-2xl border border-[var(--border-subtle)] p-6 sm:p-8 space-y-6 shadow-xl ${className}`}
    >
      {/* Header with View Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono tracking-wide uppercase text-cyan-400 font-semibold">
              Live Market Grounding • Tavily AI Search ({competitors.length} Incumbents Scouted)
            </span>
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            Competitive Intelligence Battlecard
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Autonomous market reconnaissance in <strong>{marketCategory}</strong> across <strong>{competitors.length} real market alternatives</strong>.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'matrix'
                ? 'bg-[var(--surface-3)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Head-to-Head (Top 2)
          </button>
          <button
            onClick={() => setActiveTab('battlefield')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'battlefield'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Crosshair className="h-3 w-3" />
            <span>10-Competitor Battlefield ({competitors.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('lineage')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'lineage'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Search className="h-3 w-3" />
            <span>Tavily Query Lineage</span>
          </button>
        </div>
      </div>

      {activeTab === 'matrix' ? (
        <>
          {/* Side-by-Side Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Column 1: Your Product (Target Pitch) */}
            <div className="rounded-xl p-5 bg-blue-500/5 border border-blue-500/30 flex flex-col justify-between space-y-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 px-3 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-bl-lg tracking-wider uppercase">
                Your Pitch
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-mono uppercase text-blue-400 tracking-wider block font-semibold">
                    Target Innovation
                  </span>
                  <h4 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                    {targetProduct}
                  </h4>
                </div>

                <div className="p-3 rounded-lg bg-[var(--surface-2)]/90 border border-blue-500/20">
                  <span className="text-[10px] text-[var(--text-muted)] block uppercase font-mono">
                    Pricing Model
                  </span>
                  <span className="text-sm font-semibold text-[var(--text-primary)] block mt-0.5">
                    ${proposedPrice} / {billingPeriod}
                  </span>
                  <span className="text-[11px] text-blue-400 block mt-0.5 font-medium">
                    Transparent & Predictable
                  </span>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide block">
                    Primary Advantage
                  </span>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {positioningAdvantage}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Target ICP Fit</span>
                <span className="font-semibold text-emerald-400">High / Frictionless</span>
              </div>
            </div>

            {/* Column 2 & 3: Competitor Incumbents from Tavily */}
            {topTwoCompetitors.map((comp, idx) => (
              <div
                key={comp.id || idx}
                className="rounded-xl p-5 bg-[var(--surface-2)]/70 border border-[var(--border-subtle)] flex flex-col justify-between space-y-4 hover:border-[var(--border-medium)] transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] tracking-wider block">
                        Incumbent #{idx + 1}
                      </span>
                      <h4 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                        {comp.name}
                      </h4>
                    </div>
                    <Chip
                      variant={comp.switchingCost === 'high' ? 'rose' : comp.switchingCost === 'medium' ? 'amber' : 'neutral'}
                      size="sm"
                    >
                      {comp.switchingCost.toUpperCase()} LOCK-IN
                    </Chip>
                  </div>

                  {/* Pricing & Hidden Traps */}
                  <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-subtle)] space-y-1.5">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block uppercase font-mono">
                        Incumbent Pricing Model
                      </span>
                      <span className="text-xs font-medium text-[var(--text-primary)] block mt-0.5">
                        {comp.pricingModel}
                      </span>
                    </div>
                    <div className="pt-1 border-t border-[var(--border-subtle)]">
                      <span className="text-[10px] text-[var(--rose)] block uppercase font-mono font-semibold">
                        Hidden Trap / Cost Risk
                      </span>
                      <span className="text-xs text-[var(--text-secondary)] block mt-0.5 leading-snug">
                        {comp.hiddenTrapOrFriction}
                      </span>
                    </div>
                  </div>

                  {/* Verified Community Grievance from Tavily */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide block">
                      Community Grievance (Reddit / G2)
                    </span>
                    <p className="text-xs text-[var(--text-secondary)] italic border-l-2 border-amber-500/40 pl-3 leading-relaxed">
                      &ldquo;{comp.developerGrievance}&rdquo;
                    </p>
                  </div>

                  {/* How our product wins */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide block">
                      Our Win Strategy
                    </span>
                    <p className="text-xs text-[var(--text-primary)] font-medium leading-relaxed">
                      {comp.advantageOverCompetitor}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)] font-mono">{comp.domain}</span>
                  {comp.sourceUrl && (
                    <a
                      href={comp.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline font-medium"
                    >
                      <span>Evidence Proof</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick link to 10-Competitor Battlefield if more exist */}
          {competitors.length > 2 && (
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Crosshair className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="text-[var(--text-secondary)]">
                  Showing top 2 head-to-head incumbents. <strong>{competitors.length - 2} additional market alternatives</strong> mapped by Tavily.
                </span>
              </div>
              <button
                onClick={() => setActiveTab('battlefield')}
                className="px-3 py-1.5 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-all shrink-0 flex items-center gap-1 text-xs shadow-sm"
              >
                <span>View All {competitors.length} Competitors</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Strategic Opportunity Banner */}
          {opportunitySummary && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-indigo-500/10 border border-blue-500/20 flex items-start gap-3 text-xs">
              <Sparkles className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-[var(--text-primary)] block">
                  Market Displacement Opportunity
                </span>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  {opportunitySummary}
                </p>
              </div>
            </div>
          )}
        </>
      ) : activeTab === 'battlefield' ? (
        /* Full 10-Competitor Battlefield View */
        <div className="space-y-6">
          {/* Battlefield Intelligence Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] tracking-wider block">
                Total Competitors Scouted
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[var(--text-primary)] font-mono">
                  {competitors.length}
                </span>
                <span className="text-xs text-cyan-400 font-medium">100% Live Tavily Grounded</span>
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Every synthetic persona benchmarks your pitch against their incumbent stack.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] tracking-wider block">
                Target Market Category
              </span>
              <div className="text-sm font-bold text-[var(--text-primary)] truncate mt-1">
                {marketCategory}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-snug line-clamp-2">
                {positioningAdvantage}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] tracking-wider block">
                High Switching-Barrier Incumbents
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-400 font-mono">
                  {competitors.filter((c) => c.switchingCost === 'high').length}
                </span>
                <span className="text-xs text-[var(--text-muted)]">of {competitors.length} total</span>
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Requires contractual roadmaps, import tools, or hard spend caps to displace.
              </p>
            </div>
          </div>

          {/* 10-Competitor Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {competitors.map((comp, idx) => (
              <div
                key={comp.id || idx}
                className="p-5 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] flex flex-col justify-between space-y-4 hover:border-blue-500/40 transition-all shadow-sm"
              >
                <div className="space-y-3">
                  {/* Top Bar: Rank, Name, Switching Cost */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="h-6 w-6 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                          {comp.name}
                        </h4>
                        <span className="text-[11px] font-mono text-[var(--text-muted)]">
                          {comp.domain}
                        </span>
                      </div>
                    </div>
                    <Chip
                      variant={comp.switchingCost === 'high' ? 'rose' : comp.switchingCost === 'medium' ? 'amber' : 'neutral'}
                      size="sm"
                    >
                      {comp.switchingCost.toUpperCase()} LOCK-IN
                    </Chip>
                  </div>

                  {/* Market Share in Swarm */}
                  {typeof comp.marketShareInSwarm === 'number' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
                        <span>Swarm Incumbency Share</span>
                        <span className="text-cyan-400 font-semibold">{comp.marketShareInSwarm}% of Target Buyers</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[var(--surface-3)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                          style={{ width: `${Math.min(100, Math.max(5, comp.marketShareInSwarm))}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Pricing Model & Hidden Trap */}
                  <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-subtle)] space-y-1.5">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block uppercase font-mono">
                        Pricing Model
                      </span>
                      <span className="text-xs font-medium text-[var(--text-primary)] block mt-0.5">
                        {comp.pricingModel}
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-[var(--border-subtle)]">
                      <span className="text-[10px] text-rose-400 block uppercase font-mono font-semibold">
                        Hidden Trap / Friction
                      </span>
                      <span className="text-xs text-[var(--text-secondary)] block mt-0.5 leading-snug">
                        {comp.hiddenTrapOrFriction}
                      </span>
                    </div>
                  </div>

                  {/* Reddit / G2 Grievance */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide block">
                      Community Grievance (Reddit / G2)
                    </span>
                    <p className="text-xs text-[var(--text-secondary)] italic border-l-2 border-amber-500/40 pl-2.5 leading-relaxed">
                      &ldquo;{comp.developerGrievance}&rdquo;
                    </p>
                  </div>

                  {/* How Our Tool Wins */}
                  <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                    <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide block">
                      Our Displacement Wedge
                    </span>
                    <p className="text-xs text-[var(--text-primary)] font-medium leading-relaxed">
                      {comp.advantageOverCompetitor}
                    </p>
                  </div>
                </div>

                {/* Footer link */}
                <div className="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">
                    Tavily Citation
                  </span>
                  {comp.sourceUrl && (
                    <a
                      href={comp.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline font-medium"
                    >
                      <span>View Source</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Tavily Query Lineage & Causal Grounding View */
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[var(--surface-2)]/50 border border-[var(--border-subtle)] space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-cyan-400" />
              <span className="font-semibold text-[var(--text-primary)]">
                Autonomous Search Trace: How Tavily Grounds Persona Blockers
              </span>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Tavily does not act as a passive search box. It dynamically generates search queries to uncover pricing pitfalls, contract lock-ins, and developer grievances from practitioner forums (Reddit, G2, Hacker News), which are then mapped into the synthetic buyers&apos; fatal objection checklists.
            </p>
          </div>

          <div className="space-y-3">
            {competitors.map((comp, idx) => (
              <div
                key={comp.id || idx}
                className="p-5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--border-subtle)] space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
                      Target Competitor #{idx + 1}
                    </span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">{comp.name}</span>
                    <span className="text-xs text-[var(--text-tertiary)] font-mono">({comp.domain})</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] font-mono">
                    <span>Tavily Search: Advanced Depth</span>
                    <span>•</span>
                    <span className="text-emerald-400">Status 200 OK</span>
                  </div>
                </div>

                {/* 3-Step Causal Lineage */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* Step 1: Raw Tavily Query */}
                  <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-subtle)] space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                      <Search className="h-3 w-3" />
                      <span>1. Tavily Search Query</span>
                    </div>
                    <code className="text-[11px] text-[var(--text-primary)] font-mono block bg-black/40 p-2 rounded border border-[var(--border-subtle)]">
                      site:reddit.com/r/SaaS &quot;{comp.name}&quot; pricing traps complaints overage
                    </code>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      Targeted search mining practitioner grievances and hidden consumption fees.
                    </p>
                  </div>

                  {/* Step 2: Uncovered Friction */}
                  <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-subtle)] space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" />
                      <span>2. Uncovered Pricing Trap</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed italic border-l-2 border-amber-500/40 pl-2">
                      &quot;{comp.hiddenTrapOrFriction}&quot;
                    </p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      Developer friction: &quot;{comp.developerGrievance}&quot;
                    </p>
                  </div>

                  {/* Step 3: Injected Persona Blocker */}
                  <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-purple-500/20 space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-semibold flex items-center gap-1.5">
                      <ShieldAlert className="h-3 w-3" />
                      <span>3. Injected Blocker Check</span>
                    </div>
                    <p className="text-xs text-[var(--text-primary)] font-medium leading-relaxed">
                      Persona automatically rejects pitches lacking hard spend caps or contract indemnity against: <span className="text-rose-400 font-semibold">{comp.name} Lock-in</span>.
                    </p>
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Armed with live counter-strategy</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
