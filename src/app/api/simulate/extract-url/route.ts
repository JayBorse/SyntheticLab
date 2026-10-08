import { NextRequest } from 'next/server';
import { extractProductFromUrl } from '@/core/synthetic-lab/url-extractor';
import { checkNegotiationRateLimit } from '@/core/security/rate-limiter';

export async function POST(req: NextRequest) {
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';

  // Use the generous rate limit for URL extraction
  const rateLimit = checkNegotiationRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: rateLimit.reason }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawUrl: string = body.url || '';

    if (!rawUrl || rawUrl.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid website URL (e.g. https://resend.com)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await extractProductFromUrl(rawUrl);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('URL extraction route error:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Failed to analyze website URL',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
