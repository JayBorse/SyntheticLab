import { NextRequest } from 'next/server';
import { executeNebiusSandboxPoc, isTechnicalBlocker } from '@/core/nebius/sandbox-runner';
import { checkNegotiationRateLimit } from '@/core/security/rate-limiter';
import { SimulationInput } from '@/core/synthetic-lab/types';

export async function POST(req: NextRequest) {
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';

  const rateLimit = checkNegotiationRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: rateLimit.reason }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const blockerText: string = body.blockerText || '';
    const personaRole: string = body.personaRole || '';
    const input: SimulationInput | undefined = body.input;

    if (!blockerText.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing blockerText parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isTech = isTechnicalBlocker(blockerText, personaRole);
    const result = await executeNebiusSandboxPoc({
      blockerText,
      personaRole,
      input,
      productName: input?.productName,
      proposedPrice: input?.proposedPrice,
    });

    return new Response(
      JSON.stringify({
        success: true,
        isTechnicalBlocker: isTech,
        result,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Nebius Sandbox execution error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Nebius Sandbox execution failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
