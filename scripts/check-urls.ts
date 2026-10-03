const urls = [
  'https://pinecone.io/pricing',
  'https://www.reddit.com/r/vectordatabase/comments/1l7rods/rate_databases',
  'https://www.reddit.com/r/vectordatabase/comments/1sfv5x1/benchmark_pgvector_vs_pinecone_vs_qdrant_vs',
  'https://www.reddit.com/r/cybersecurity/comments/10iz243/drata_vs_vanta',
  'https://www.reddit.com/r/soc2/comments/1j8v8jb/soc_2_type_1_using_drata_need_advice_on_cost',
  'https://www.reddit.com/r/gamedev/comments/1oto28q/unity_pricing_changes_runtime_fee_cancellation',
  'https://www.reddit.com/r/technology/comments/1ffv45c/unity_is_dropping_its_unpopular_perinstall',
  'https://www.reddit.com/r/xbox/comments/1ff7257/unity_cancels_controversial_fees_to_use_its_game',
];

async function checkUrl(url: string): Promise<{ url: string; status: number; ok: boolean; location?: string }> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    });
    return {
      url,
      status: res.status,
      ok: res.ok,
      location: res.url !== url ? res.url : undefined,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { url, status: 0, ok: false, location: msg };
  }
}

async function run() {
  console.log('Testing all preset URLs live with HTTP GET...\n');
  for (const u of urls) {
    const res = await checkUrl(u);
    console.log(`${res.ok ? '✓ PASS' : '✗ FAIL'} [HTTP ${res.status}] ${u}`);
    if (res.location) console.log(`  -> Redirect/Error: ${res.location}`);
  }
}

run();
