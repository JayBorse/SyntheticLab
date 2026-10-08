/**
 * In-Memory Sliding Window Rate Limiter for SyntheticLab API
 * Protects Nebius Token Factory and Tavily AI Search API credits from automated scraping / runaway loops.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const ipRequestMap = new Map<string, RateLimitEntry>();
let globalHourlyCount = 0;
let globalResetAt = Date.now() + 60 * 60 * 1000;

// Configurable thresholds
const MAX_REQUESTS_PER_IP_PER_HOUR = 8; // 8 simulations per user IP per hour
const MAX_GLOBAL_SIMULATIONS_PER_HOUR = 60; // 60 total simulations per hour across all users

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMinutes: number;
  reason?: string;
}

export function checkSimulationRateLimit(clientIp: string): RateLimitResult {
  const now = Date.now();

  // Reset global count if hourly window elapsed
  if (now > globalResetAt) {
    globalHourlyCount = 0;
    globalResetAt = now + 60 * 60 * 1000;
  }

  // Check global throttle
  if (globalHourlyCount >= MAX_GLOBAL_SIMULATIONS_PER_HOUR) {
    const minutesLeft = Math.ceil((globalResetAt - now) / 60000);
    return {
      allowed: false,
      remaining: 0,
      resetMinutes: minutesLeft,
      reason: `Global hourly simulation quota reached to protect hackathon API credits. Try again in ${minutesLeft} minutes, or explore our pre-saved benchmark replay instantly.`,
    };
  }

  // Check client IP entry
  const entry = ipRequestMap.get(clientIp);

  if (!entry || now > entry.resetAt) {
    // New or expired window
    ipRequestMap.set(clientIp, {
      count: 1,
      resetAt: now + 60 * 60 * 1000,
    });
    globalHourlyCount += 1;
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_IP_PER_HOUR - 1,
      resetMinutes: 60,
    };
  }

  if (entry.count >= MAX_REQUESTS_PER_IP_PER_HOUR) {
    const minutesLeft = Math.ceil((entry.resetAt - now) / 60000);
    return {
      allowed: false,
      remaining: 0,
      resetMinutes: minutesLeft,
      reason: `Per-visitor simulation limit exceeded (${MAX_REQUESTS_PER_IP_PER_HOUR}/hour). Please wait ${minutesLeft} minutes, or inspect our verified saved run replay.`,
    };
  }

  // Increment
  entry.count += 1;
  globalHourlyCount += 1;

  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_IP_PER_HOUR - entry.count,
    resetMinutes: Math.ceil((entry.resetAt - now) / 60000),
  };
}

const negotiationIpMap = new Map<string, RateLimitEntry>();
const MAX_NEGOTIATION_PER_IP_PER_HOUR = 150; // Allow 150 chat messages per IP/hour

export function checkNegotiationRateLimit(clientIp: string): RateLimitResult {
  const now = Date.now();
  const entry = negotiationIpMap.get(clientIp);

  if (!entry || now > entry.resetAt) {
    negotiationIpMap.set(clientIp, {
      count: 1,
      resetAt: now + 60 * 60 * 1000,
    });
    return {
      allowed: true,
      remaining: MAX_NEGOTIATION_PER_IP_PER_HOUR - 1,
      resetMinutes: 60,
    };
  }

  if (entry.count >= MAX_NEGOTIATION_PER_IP_PER_HOUR) {
    const minutesLeft = Math.ceil((entry.resetAt - now) / 60000);
    return {
      allowed: false,
      remaining: 0,
      resetMinutes: minutesLeft,
      reason: `Negotiation chat message limit reached (${MAX_NEGOTIATION_PER_IP_PER_HOUR}/hour). Please wait ${minutesLeft} minutes.`,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: MAX_NEGOTIATION_PER_IP_PER_HOUR - entry.count,
    resetMinutes: Math.ceil((entry.resetAt - now) / 60000),
  };
}

