'use client';

import React from 'react';
import { PersonaEvaluation } from '@/core/synthetic-lab/types';

export interface PriceAcceptanceChartProps {
  evaluations: PersonaEvaluation[];
  proposedPrice: number;
  medianWtp: number;
  billingPeriod: string;
  className?: string;
}

export const PriceAcceptanceChart: React.FC<PriceAcceptanceChartProps> = ({
  evaluations,
  proposedPrice,
  medianWtp,
  billingPeriod,
  className = '',
}) => {
  if (evaluations.length === 0) return null;

  // Extract prices and compute acceptance curve
  const validPrices = evaluations.map((e) => e.acceptablePrice);
  const maxPrice = Math.max(proposedPrice * 1.5, ...validPrices, 100);

  // Generate 8 evaluation intervals from 0 to maxPrice
  const intervals = 8;
  const step = maxPrice / intervals;
  const points: { price: number; acceptancePct: number }[] = [];

  for (let i = 0; i <= intervals; i++) {
    const p = Math.round(i * step);
    // Count how many personas have acceptablePrice >= p AND vote != 'reject'
    const accepting = evaluations.filter((e) => e.acceptablePrice >= p && e.vote !== 'reject').length;
    const pct = Math.round((accepting / evaluations.length) * 100);
    points.push({ price: p, acceptancePct: pct });
  }

  // SVG dimensions
  const width = 500;
  const height = 160;
  const padding = { top: 20, right: 30, bottom: 25, left: 35 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Scale functions
  const getX = (price: number) => padding.left + (price / maxPrice) * graphWidth;
  const getY = (pct: number) => padding.top + graphHeight - (pct / 100) * graphHeight;

  // Construct SVG Path
  const pathD = points.reduce((acc, pt, idx) => {
    const x = getX(pt.price);
    const y = getY(pt.acceptancePct);
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '');

  // Fill area under curve
  const fillD = `${pathD} L ${getX(points[points.length - 1].price).toFixed(1)} ${(padding.top + graphHeight).toFixed(1)} L ${getX(0).toFixed(1)} ${(padding.top + graphHeight).toFixed(1)} Z`;

  const proposedX = getX(proposedPrice);
  const medianX = getX(medianWtp);

  return (
    <div className={`p-4 rounded-[var(--radius-lg)] bg-[var(--surface-1)] border border-[var(--border-subtle)] space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono uppercase tracking-wider text-[var(--text-muted)] text-[10px] font-medium">
          Price vs. Commercial Demand Curve (n = {evaluations.length})
        </span>
        <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> Median WTP (${medianWtp})
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber)]" /> Proposed (${proposedPrice})
          </span>
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto text-[var(--text-muted)] font-mono text-[9px] select-none"
        >
          {/* Subtle Grid Lines (Horizontal: 0%, 50%, 100%) */}
          {[0, 50, 100].map((pct) => (
            <g key={pct}>
              <line
                x1={padding.left}
                y1={getY(pct)}
                x2={padding.left + graphWidth}
                y2={getY(pct)}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeDasharray="2,2"
              />
              <text
                x={padding.left - 6}
                y={getY(pct) + 3}
                textAnchor="end"
                fill="currentColor"
              >
                {pct}%
              </text>
            </g>
          ))}

          {/* Fill Area Gradient */}
          <defs>
            <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={fillD} fill="url(#curveGradient)" />

          {/* Curve line */}
          <path
            d={pathD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Proposed Price Marker Line */}
          {proposedPrice <= maxPrice && (
            <g>
              <line
                x1={proposedX}
                y1={padding.top}
                x2={proposedX}
                y2={padding.top + graphHeight}
                stroke="var(--amber)"
                strokeWidth="1.5"
                strokeDasharray="3,3"
                opacity="0.8"
              />
              <text
                x={proposedX}
                y={padding.top - 5}
                textAnchor="middle"
                fill="var(--amber)"
                fontWeight="bold"
              >
                Ask: ${proposedPrice}
              </text>
            </g>
          )}

          {/* Median WTP Marker Point */}
          {medianWtp <= maxPrice && (
            <g>
              <circle
                cx={medianX}
                cy={getY(
                  Math.round(
                    (evaluations.filter((e) => e.acceptablePrice >= medianWtp && e.vote !== 'reject').length /
                      evaluations.length) *
                      100
                  )
                )}
                r="3.5"
                fill="var(--accent)"
                stroke="var(--bg)"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Bottom X-Axis labels */}
          <text x={padding.left} y={height - 5} textAnchor="start" fill="currentColor">
            $0
          </text>
          <text x={padding.left + graphWidth / 2} y={height - 5} textAnchor="middle" fill="currentColor">
            ${Math.round(maxPrice / 2)}/{billingPeriod}
          </text>
          <text x={padding.left + graphWidth} y={height - 5} textAnchor="end" fill="currentColor">
            ${Math.round(maxPrice)}
          </text>
        </svg>
      </div>
    </div>
  );
};
