export interface CoinGeckoSearchAsset {
  id: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  change24h: number | null;
  volume24h: number;
  source: 'CoinGecko';
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type SearchCoin = { id?: unknown; symbol?: unknown; name?: unknown; market_cap_rank?: unknown };
type PriceQuote = { usd?: unknown; usd_24h_change?: unknown };
type Options = { apiKeys?: string[]; fetcher?: Fetcher };

let nextApiKeyIndex = 0;

function getApiKeys(apiKeys?: string[]) {
  return (apiKeys ?? [
    process.env.COINGECKO_DEMO_API_KEY,
    process.env.COINGECKO_DEMO_API_KEY_2,
    process.env.COINGECKO_DEMO_API_KEY_3,
  ]).map((key) => key?.trim()).filter((key): key is string => Boolean(key));
}

async function fetchWithKeyRotation(url: string, keys: string[], fetcher: Fetcher): Promise<Response | null> {
  const start = nextApiKeyIndex % keys.length;
  nextApiKeyIndex = (start + 1) % keys.length;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetcher(url, {
        headers: { Accept: 'application/json', 'x-cg-demo-api-key': keys[(start + attempt) % keys.length] },
        signal: controller.signal,
        next: { revalidate: 60 },
      } as RequestInit);
      if (response.ok) return response;
    } catch {
      // Rotate across configured Demo keys on network and rate-limit failures.
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

export async function searchCoinGeckoAssets(query: string, options: Options = {}): Promise<CoinGeckoSearchAsset[]> {
  const cleanQuery = query.trim().slice(0, 80);
  const keys = getApiKeys(options.apiKeys);
  if (!cleanQuery || keys.length === 0) return [];

  const fetcher = options.fetcher ?? fetch;
  const searchUrl = `https://api.coingecko.com/api/v3/search?${new URLSearchParams({ query: cleanQuery })}`;
  const searchResponse = await fetchWithKeyRotation(searchUrl, keys, fetcher);
  if (!searchResponse) return [];

  const payload: unknown = await searchResponse.json().catch(() => null);
  const coins = (payload && typeof payload === 'object' && Array.isArray((payload as { coins?: unknown }).coins)
    ? (payload as { coins: SearchCoin[] }).coins
    : [])
    .filter((coin) => typeof coin.id === 'string' && typeof coin.symbol === 'string' && typeof coin.name === 'string')
    .sort((a, b) => Number(a.market_cap_rank ?? Number.MAX_SAFE_INTEGER) - Number(b.market_cap_rank ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 15);
  if (coins.length === 0) return [];

  const ids = coins.map((coin) => String(coin.id));
  const priceParams = new URLSearchParams({ ids: ids.join(','), vs_currencies: 'usd', include_24hr_change: 'true' });
  const priceResponse = await fetchWithKeyRotation(`https://api.coingecko.com/api/v3/simple/price?${priceParams}`, keys, fetcher);
  const prices = priceResponse
    ? await priceResponse.json().catch(() => null) as Record<string, PriceQuote> | null
    : null;

  return coins.map((coin) => {
    const id = String(coin.id);
    const quote = prices?.[id];
    const price = Number(quote?.usd);
    const change = Number(quote?.usd_24h_change);
    return {
      id,
      symbol: String(coin.symbol).toUpperCase(),
      name: String(coin.name),
      priceUsd: Number.isFinite(price) && price > 0 ? price : null,
      change24h: Number.isFinite(change) ? change : null,
      volume24h: 0,
      source: 'CoinGecko',
    };
  });
}
