import { NextRequest } from 'next/server';
import {
  SimulationInput,
  SimulationVerdict,
  GroundedEvidence,
  SyntheticPersona,
  SimulationRunEvent,
} from '@/core/synthetic-lab/types';
import { optimizeProductPitch } from '@/core/synthetic-lab/optimizer';
import { executeHoldOutRetest } from '@/core/synthetic-lab/holdout-retest';
import { checkSimulationRateLimit } from '@/core/security/rate-limiter';

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '127.0.0.1';
  const rateLimit = checkSimulationRateLimit(clientIp);

  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: rateLimit.reason }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({}));
  const input: SimulationInput = body.input;
  const verdict: SimulationVerdict = body.verdict;
  const evidence: GroundedEvidence[] = body.evidence || [];
  const initialPersonas: SyntheticPersona[] = body.personas || [];

  if (!input || !verdict) {
    return new Response(JSON.stringify({ error: 'Missing simulation input or initial verdict' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const startTime = Date.now();
  const ultraModel = process.env.NEBIUS_ULTRA_MODEL_ID || 'nvidia/Nemotron-3-Ultra-550b-a55b';
  const fastModel = process.env.NEBIUS_FAST_MODEL_ID || 'nvidia/nemotron-3-super-120b-a12b';

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const emit = (event: SimulationRunEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // stream closed
        }
      };

      try {
        // Stage 1: Autonomous Pitch & Packaging Optimization via Nemotron 3 Ultra
        emit({
          stage: 'optimizing_pitch',
          message: `NVIDIA Nemotron 3 Ultra (${ultraModel}) is dissecting fatal objections and restructuring packaging...`,
          timestamp: Date.now(),
        });

        const optimizedPitch = await optimizeProductPitch(input, verdict, evidence);

        emit({
          stage: 'optimizing_pitch',
          message: `Pitch optimized: Revised tagline, risk reversals, and calibrated pricing ($${optimizedPitch.calibratedPrice}/${optimizedPitch.calibratedPeriod}).`,
          timestamp: Date.now(),
          data: { optimizedPitch },
        });

        // Stage 2: Spawning Blinded Hold-Out Cohort B
        emit({
          stage: 'spawning_holdout',
          message: `Generating fresh Hold-Out Panel (Cohort B) to strictly eliminate circular grading bias...`,
          timestamp: Date.now(),
        });

        // Stage 3: Running Hold-Out Retest
        emit({
          stage: 'running_holdout',
          message: `Presenting optimized pitch to independent hold-out committee...`,
          timestamp: Date.now(),
        });

        const holdOutResult = await executeHoldOutRetest(
          optimizedPitch,
          verdict,
          evidence,
          initialPersonas,
          (evaluation) => {
            emit({
              stage: 'running_holdout',
              message: `Hold-Out Persona [${evaluation.personaName} (${evaluation.role})]: Voted "${evaluation.vote.toUpperCase()}" (WTP: $${evaluation.acceptablePrice})`,
              timestamp: Date.now(),
              data: { evaluation },
            });
          }
        );

        const latencyMs = Date.now() - startTime;

        // Stage 4: Hold-Out Retest Completed
        emit({
          stage: 'retest_completed',
          message: `Autonomous loop finished in ${(latencyMs / 1000).toFixed(1)}s. ${holdOutResult.deltaSummary}`,
          timestamp: Date.now(),
          data: {
            optimizedPitch,
            holdOutResult,
            telemetry: {
              modelFast: fastModel,
              modelReasoning: ultraModel,
              parallelCalls: holdOutResult.holdOutPersonas.length,
              latencyMs,
            },
          },
        });
      } catch (error) {
        emit({
          stage: 'error',
          message: `Optimization loop failed: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: Date.now(),
        });
      } finally {
        try {
          controller.close();
        } catch {
          // ignore
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
