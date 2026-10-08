import { SimulationInput } from './types';
import { nebiusNemotron } from '@/core/ai/nebius';

const FAST_MODEL_ID = process.env.NEBIUS_FAST_MODEL_ID || 'nvidia/nemotron-3-super-120b-a12b';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

export interface UrlExtractionResult {
  input: SimulationInput;
  detectedCompetitors: string[];
  summary: string;
  sourceUrl: string;
  domain: string;
  pageTitle?: string;
}

export interface PageFetchResult {
  title: string;
  metaDescription: string;
  content: string;
  domain: string;
  pricingUrl?: string;
  pricingData?: {
    metaDescription: string;
    text: string;
  };
  detectedPriceSignals: string[];
}

/**
 * Cleans and normalizes user-provided URLs
 */
export function normalizeUrl(rawUrl: string): string {
  let trimmed = rawUrl.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `https://${trimmed}`;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.href;
  } catch {
    return trimmed;
  }
}

/**
 * Discovers candidate internal pricing links from raw HTML
 */
function extractPricingLinks(html: string, baseUrl: string): string[] {
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']*(?:pricing|price|plans|tiers)[^"']*)["'][^>]*>/gi)];
  const urls: string[] = [];
  try {
    const baseObj = new URL(baseUrl);
    for (const m of matches) {
      const rawHref = m[1].trim();
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) continue;
      try {
        const resolved = new URL(rawHref, baseUrl);
        if (resolved.hostname === baseObj.hostname || resolved.hostname.endsWith(`.${baseObj.hostname}`)) {
          if (!urls.includes(resolved.href) && resolved.href !== baseUrl) {
            urls.push(resolved.href);
          }
        }
      } catch {
        // ignore malformed URLs
      }
    }
  } catch {
    // ignore URL parsing failures
  }
  return urls;
}

/**
 * Scans text content for explicit pricing signals (e.g. $499/mo, Decide $499, $999)
 */
function extractPriceSignals(text: string): string[] {
  const signals: string[] = [];
  // Match patterns like "$499/mo", "$999 a month", "Decide $499", "Fight $999", "$4,990/year"
  const matches = [...text.matchAll(/(?:([A-Z][a-zA-Z0-9_\-\s]{2,15})[\s:–—-]+)?(\$[0-9]{1,5}(?:,[0-9]{3})*(?:\.[0-9]{2})?)(?:\s*(?:\/|\s+per\s+|\s+a\s+)(?:mo|month|year|yr|quarter))?/g)];
  for (const m of matches) {
    const tier = m[1]?.trim();
    const price = m[2];
    if (price) {
      const signal = tier ? `${tier}: ${price}` : price;
      if (!signals.includes(signal)) {
        signals.push(signal);
      }
    }
  }
  return signals.slice(0, 10);
}

/**
 * Strips HTML boilerplate to extract meaningful text content
 */
function cleanHtmlContent(html: string): { title: string; metaDescription: string; text: string } {
  let title = '';
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  let metaDescription = '';
  const metaMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i) ||
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  if (metaMatch) {
    metaDescription = metaMatch[1].trim();
  }

  // Remove scripts, styles, svg, and tags
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Keep first 6,000 characters
  cleaned = cleaned.slice(0, 6000);

  return { title, metaDescription, text: cleaned };
}

/**
 * Fetches page content and automatically discovers dedicated pricing pages
 */
async function fetchPageContent(targetUrl: string): Promise<PageFetchResult> {
  const urlObj = new URL(targetUrl);
  const domain = urlObj.hostname.replace(/^www\./, '');
  let detectedSignals: string[] = [];

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  // Attempt 1: Direct fetch of the main page
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(targetUrl, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();
      const pricingLinks = extractPricingLinks(html, targetUrl);
      const { title, metaDescription, text } = cleanHtmlContent(html);

      // Check for price signals on main page
      const mainSignals = extractPriceSignals(`${metaDescription} ${text}`);
      detectedSignals.push(...mainSignals);

      let pricingUrl = pricingLinks[0];
      // Fallback: If no pricing link found and path is root, probe /pricing
      if (!pricingUrl && (urlObj.pathname === '/' || urlObj.pathname === '')) {
        pricingUrl = new URL('/pricing', targetUrl).href;
      }

      let pricingData: { metaDescription: string; text: string } | undefined = undefined;

      // Secondary fetch for dedicated pricing page if available
      if (pricingUrl && pricingUrl !== targetUrl) {
        try {
          const pController = new AbortController();
          const pTimeout = setTimeout(() => pController.abort(), 5000);
          const pRes = await fetch(pricingUrl, { headers, signal: pController.signal });
          clearTimeout(pTimeout);

          if (pRes.ok) {
            const pHtml = await pRes.text();
            const pMetaMatch =
              pHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
              pHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
            const pMeta = pMetaMatch ? pMetaMatch[1].trim() : '';
            const pCleaned = pHtml
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
              .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 4500);

            pricingData = {
              metaDescription: pMeta,
              text: pCleaned,
            };

            const pSignals = extractPriceSignals(`${pMeta} ${pCleaned}`);
            detectedSignals.push(...pSignals);
          }
        } catch (pErr) {
          console.warn(`[url-extractor] Secondary pricing fetch failed for ${pricingUrl}:`, pErr);
        }
      }

      if (text.length > 80) {
        return {
          title,
          metaDescription,
          content: `Title: ${title}\nDescription: ${metaDescription}\nPage Content: ${text}`,
          domain,
          pricingUrl,
          pricingData,
          detectedPriceSignals: [...new Set(detectedSignals)],
        };
      }
    }
  } catch (err) {
    console.warn(`[url-extractor] Direct fetch failed for ${targetUrl}, trying Tavily fallback:`, err);
  }

  // Attempt 2: Fallback to Tavily Extract or Search
  if (TAVILY_API_KEY && TAVILY_API_KEY !== 'placeholder_tavily_key') {
    try {
      // Tavily Search query specifically for product overview and pricing
      const searchRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: `site:${domain} pricing plans OR "${domain}" pricing tiers`,
          search_depth: 'basic',
          max_results: 4,
        }),
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (Array.isArray(searchData.results) && searchData.results.length > 0) {
          const combined = searchData.results.map((r: any) => `${r.title}: ${r.content}`).join('\n\n');
          const tavilySignals = extractPriceSignals(combined);
          return {
            title: searchData.results[0].title || domain,
            metaDescription: '',
            content: combined.slice(0, 5000),
            domain,
            detectedPriceSignals: tavilySignals,
          };
        }
      }
    } catch (tavilyErr) {
      console.warn('[url-extractor] Tavily fallback extraction error:', tavilyErr);
    }
  }

  // Fallback: Use domain as basic anchor
  return {
    title: domain,
    metaDescription: `Product platform hosted at ${domain}`,
    content: `Landing page domain: ${domain}. Product website offering software services.`,
    domain,
    detectedPriceSignals: [],
  };
}

/**
 * Extracts structured simulation input and competitor hints from any landing page URL
 */
export async function extractProductFromUrl(rawUrl: string): Promise<UrlExtractionResult> {
  const targetUrl = normalizeUrl(rawUrl);
  const pageData = await fetchPageContent(targetUrl);
  const { title, metaDescription, content, domain, pricingUrl, pricingData, detectedPriceSignals } = pageData;

  const fallbackProductName = domain
    .split('.')[0]
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const prompt = `You are an elite B2B Product Strategist and Market Analyst.
Analyze this landing page and dedicated pricing data from "${targetUrl}" (domain: ${domain}).
Extract and synthesize the exact product profile, commercial pricing model, target audience, and primary market category.

LANDING PAGE METADATA:
- URL: ${targetUrl}
- Domain: ${domain}
- Page Title: ${title}
- Meta Description: ${metaDescription}

MAIN PAGE CONTENT:
${content}

${
  pricingData
    ? `--- DEDICATED PRICING PAGE EVIDENCE (${pricingUrl}) ---
Pricing Meta Description: ${pricingData.metaDescription}
Pricing Plan Details & Breakdown:
${pricingData.text}`
    : ''
}

${
  detectedPriceSignals.length > 0
    ? `DETECTED NUMERICAL PRICE SIGNALS ON SITE:
${detectedPriceSignals.map((s) => `- ${s}`).join('\n')}`
    : ''
}

CRITICAL EXTRACTION INSTRUCTIONS:
1. "productName": Clean brand or tool name (e.g. "Predispute", "Resend", "Linear", "Pinecone").
2. "tagline": Concise, punchy 1-sentence value proposition.
3. "description": 2-3 detailed sentences explaining what the tool does, how it works, technical integrations, and primary benefits.
4. "proposedPrice": The primary commercial starting price in USD (integer number, e.g. 499 for Predispute Decide, 45 or 20 for Resend Pro, 29 for Starter).
   - CRITICAL: Search the DEDICATED PRICING PAGE EVIDENCE and DETECTED NUMERICAL PRICE SIGNALS. If real plans like "$499 a month" or "$999/mo" are stated, USE THE EXACT NUMBER ($499).
   - NEVER invent or default to a generic 49 or 29 when real pricing figures ($499, $999, etc.) appear in the text or metadata.
   - If there is a free tier alongside commercial paid tiers (e.g. Measure Free vs Decide $499/mo), set "proposedPrice" to the entry commercial paid plan ($499), NOT 0, so buyer personas can evaluate commercial willingness to pay.
5. "billingPeriod": 'month' | 'year' | 'quarter' | 'one_time'. If 'monthly', normalize to 'month'. Default to 'month'.
6. "pricingTiers": Comprehensive text breakdown of all tiers (e.g. "Measure: Free, Decide: $499/month, Fight: $999/month").
7. "targetAudience": The primary Ideal Customer Profile (ICP) (e.g. "Shopify and Stripe merchants, e-commerce store owners, and online businesses seeking to manage and reduce chargebacks").
8. "category": Choose one of: 'b2b_saas' | 'devtools_api' | 'security_cloud' | 'consumer_app' | 'custom'.
9. "detectedCompetitors": Array of 3-5 standard incumbent competitors or alternatives in this exact market space (e.g. for Predispute: ["Chargeflow", "Signifyd", "Chargeback911", "Riskified", "Midigator"]).

Return ONLY a strict JSON object with this exact schema:
{
  "productName": "Product Name",
  "tagline": "Punchy one-sentence value proposition",
  "description": "2-3 comprehensive sentences explaining how it works and key features",
  "proposedPrice": 499,
  "billingPeriod": "month",
  "pricingTiers": "Free tier available, Paid tier $499/month, Enterprise tier",
  "targetAudience": "Primary ideal customer profile",
  "category": "b2b_saas",
  "detectedCompetitors": ["Competitor 1", "Competitor 2", "Competitor 3", "Competitor 4"]
}`;

  try {
    const response = await nebiusNemotron.chat(
      [
        {
          role: 'system',
          content:
            'You output only strict, valid JSON matching the requested schema. Stay accurate to the scraped web content and real pricing figures.',
        },
        { role: 'user', content: prompt },
      ],
      {
        modelId: FAST_MODEL_ID,
        responseFormat: 'json_object',
        temperature: 0.1,
      }
    );

    const cleaned = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Normalize billing period
    let billingPeriod = (parsed.billingPeriod || 'month').toLowerCase().trim();
    if (billingPeriod === 'monthly') billingPeriod = 'month';
    if (billingPeriod === 'annually' || billingPeriod === 'yearly') billingPeriod = 'year';
    if (billingPeriod === 'quarterly') billingPeriod = 'quarter';

    let proposedPrice =
      typeof parsed.proposedPrice === 'number' && parsed.proposedPrice > 0 ? parsed.proposedPrice : 0;

    // Price reconciliation safeguard:
    // If the model defaulted to 49 or 0, but detected price signals contain unambiguous real prices like 499 or 999
    if (detectedPriceSignals.length > 0) {
      const numericSignals = detectedPriceSignals
        .map((s) => {
          const match = s.match(/\$([0-9]{1,5})/);
          return match ? parseInt(match[1], 10) : null;
        })
        .filter((n): n is number => n !== null && n > 0 && n < 50000);

      if (
        (proposedPrice === 0 || proposedPrice === 49) &&
        !numericSignals.includes(49) &&
        numericSignals.length > 0
      ) {
        // Pick the entry commercial price
        const entryPaid = Math.min(...numericSignals);
        console.log(
          `[url-extractor] Reconciling proposedPrice from ${proposedPrice} to detected commercial price ${entryPaid}`
        );
        proposedPrice = entryPaid;
      }
    }

    if (proposedPrice <= 0) {
      proposedPrice = 49; // fallback if zero pricing information exists anywhere
    }

    const simulationInput: SimulationInput = {
      productName: parsed.productName || fallbackProductName,
      tagline: parsed.tagline || metaDescription || `Modern platform for ${domain}`,
      description: parsed.description || `Cloud software solution at ${domain} providing specialized services.`,
      proposedPrice,
      billingPeriod,
      pricingTiers: parsed.pricingTiers || undefined,
      targetAudience: parsed.targetAudience || 'Software engineers, founders, and technical decision-makers',
      category: parsed.category || 'b2b_saas',
    };

    const competitors: string[] = Array.isArray(parsed.detectedCompetitors)
      ? parsed.detectedCompetitors.filter((c: any) => typeof c === 'string' && c.trim().length > 0)
      : [];

    return {
      input: simulationInput,
      detectedCompetitors: competitors,
      summary: `Extracted ${simulationInput.productName} from ${domain} (${simulationInput.category}, $${simulationInput.proposedPrice}/${simulationInput.billingPeriod})`,
      sourceUrl: targetUrl,
      domain,
      pageTitle: title || simulationInput.productName,
    };
  } catch (err) {
    console.warn(`[url-extractor] LLM extraction fallback for ${targetUrl}:`, err);
    // Robust heuristic fallback
    return {
      input: {
        productName: fallbackProductName,
        tagline: metaDescription || `Advanced cloud solution by ${fallbackProductName}`,
        description: content.slice(0, 240) || `Innovative software platform hosted at ${domain}.`,
        proposedPrice: 49,
        billingPeriod: 'month',
        targetAudience: 'Technical decision-makers and developers',
        category: 'b2b_saas',
      },
      detectedCompetitors: [],
      summary: `Auto-indexed ${fallbackProductName} from ${domain}`,
      sourceUrl: targetUrl,
      domain,
      pageTitle: title || fallbackProductName,
    };
  }
}
