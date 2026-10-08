type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Options = { apiKeys: string[]; fetcher?: Fetcher };

let nextApiKeyIndex = 0;

export async function fetchCoinGeckoUsdVndRate(
  { apiKeys, fetcher = fetch }: Options,
): Promise<{ rate: number; updatedAt: number | null } | null> {
  const keys = apiKeys.map((key) => key.trim()).filter(Boolean);
  if (keys.length === 0) return null;

  const params = new URLSearchParams({ ids: 'bitcoin', vs_currencies: 'usd,vnd', include_last_updated_at: 'true' });
  const url = `https://api.coingecko.com/api/v3/simple/price?${params}`;
  const startIndex = nextApiKeyIndex % keys.length;
  nextApiKeyIndex = (startIndex + 1) % keys.length;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const apiKey = keys[(startIndex + attempt) % keys.length];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetcher(url, {
        headers: { Accept: 'application/json', 'x-cg-demo-api-key': apiKey },
        signal: controller.signal,
        next: { revalidate: 300 },
      });
      if (!response.ok) continue;

      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object') return null;
      const bitcoin = (payload as Record<string, { usd?: unknown; vnd?: unknown; last_updated_at?: unknown }>).bitcoin;
      const usd = Number(bitcoin?.usd);
      const vnd = Number(bitcoin?.vnd);
      const rate = vnd / usd;
      if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(vnd) || vnd <= 0 || !Number.isFinite(rate) || rate <= 0) return null;
      const updatedAt = Number(bitcoin?.last_updated_at);
      return { rate, updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : null };
    } catch {
      // Retry the same quote with the next configured Demo account.
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

export function getCoinGeckoUsdVndRate() {
  return fetchCoinGeckoUsdVndRate({
    apiKeys: [
      process.env.COINGECKO_DEMO_API_KEY,
      process.env.COINGECKO_DEMO_API_KEY_2,
      process.env.COINGECKO_DEMO_API_KEY_3,
    ].filter((key): key is string => Boolean(key?.trim())),
  });
}
