import { NextRequest } from 'next/server';
import {
  SimulationInput,
  SyntheticPersona,
  PersonaEvaluation,
  NegotiationMessage,
} from '@/core/synthetic-lab/types';
import { sparWithBuyer } from '@/core/synthetic-lab/negotiation-engine';
import { checkNegotiationRateLimit } from '@/core/security/rate-limiter';

export async function POST(req: NextRequest) {
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';

  // Check rate limits specifically for negotiation sparring
  const rateLimit = checkNegotiationRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: rateLimit.reason }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const input: SimulationInput = body.input;
    const persona: SyntheticPersona = body.persona;
    const evaluation: PersonaEvaluation = body.evaluation;
    const messages: NegotiationMessage[] = body.messages || [];
    const counterOffer: string = body.counterOffer || '';
    const battlecard = body.battlecard;
    const existingChecklist = body.existingChecklist;

    if (!input || !persona || !evaluation || !counterOffer.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters for negotiation sparring' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await sparWithBuyer({
      input,
      persona,
      evaluation,
      messages,
      counterOffer: counterOffer.trim(),
      battlecard,
      existingChecklist,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Negotiation route error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal negotiation error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
