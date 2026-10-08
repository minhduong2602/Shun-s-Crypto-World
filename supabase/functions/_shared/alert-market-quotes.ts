export type AlertMarketQuote = { price: number; change24h: number | null };

type AlertQuoteAsset = { symbol: string; chain: string; assetAddress: string; isNative: boolean };
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Options = { apiKeys: string[]; fetcher?: Fetcher };

const COINGECKO_PLATFORM: Record<string, string> = {
  ETH: 'ethereum',
  BSC: 'binance-smart-chain',
  POLYGON: 'polygon-pos',
  ARBITRUM: 'arbitrum-one',
  BASE: 'base',
  SOL: 'solana',
};

function normalizedAddress(chain: string, address: string) {
  return chain === 'SOL' ? address.trim() : address.trim().toLowerCase();
}

function toQuote(priceValue: unknown, changeValue: unknown): AlertMarketQuote | null {
  const price = Number(priceValue);
  if (!Number.isFinite(price) || price <= 0) return null;
  const change = changeValue === null || changeValue === undefined ? null : Number(changeValue);
  return { price, change24h: change !== null && Number.isFinite(change) ? change : null };
}

export function createAlertMarketQuoteProvider({ apiKeys, fetcher = fetch }: Options) {
  const keys = apiKeys.map((key) => key.trim()).filter(Boolean);
  const cache = new Map<string, Promise<AlertMarketQuote | null>>();
  let nextKey = 0;

  async function getQuote(cacheKey: string, url: string, select: (payload: unknown) => AlertMarketQuote | null) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const request = (async () => {
      for (let attempt = 0; attempt < keys.length; attempt++) {
        const key = keys[nextKey % keys.length];
        nextKey = (nextKey + 1) % keys.length;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5_000);
        try {
          const response = await fetcher(url, {
            signal: controller.signal,
            headers: { Accept: 'application/json', 'x-cg-demo-api-key': key },
          });
          if (response.status === 400) return null;
          if (!response.ok) continue;
          return select(await response.json());
        } catch {
          // Retry this quote with the next configured CoinGecko account.
        } finally {
          clearTimeout(timeout);
        }
      }
      return null;
    })();
    cache.set(cacheKey, request);
    return request;
  }

  function bySymbol(symbol: string) {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized || keys.length === 0) return Promise.resolve(null);
    const params = new URLSearchParams({
      vs_currency: 'usd',
      symbols: normalized.toLowerCase(),
      include_tokens: 'top',
      price_change_percentage: '24h',
    });
    const url = `https://api.coingecko.com/api/v3/coins/markets?${params}`;
    return getQuote(`symbol:${normalized}`, url, (payload) => {
      if (!Array.isArray(payload)) return null;
      const coin = payload.find((item) => item?.symbol?.toUpperCase() === normalized);
      return toQuote(coin?.current_price, coin?.price_change_percentage_24h);
    });
  }

  function forAsset(asset: AlertQuoteAsset) {
    const address = asset.assetAddress.trim();
    if (asset.isNative || address.toLowerCase() === 'native') return bySymbol(asset.symbol);
    const platform = COINGECKO_PLATFORM[asset.chain];
    if (!platform || !address || keys.length === 0) return Promise.resolve(null);

    const normalized = normalizedAddress(asset.chain, address);
    const params = new URLSearchParams({
      contract_addresses: normalized,
      vs_currencies: 'usd',
      include_24hr_change: 'true',
    });
    const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?${params}`;
    return getQuote(`asset:${asset.chain}:${normalized}`, url, (payload) => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
      const values = (payload as Record<string, { usd?: unknown; usd_24h_change?: unknown }>)[normalized];
      return toQuote(values?.usd, values?.usd_24h_change);
    });
  }

  return { bySymbol, forAsset };
}

export function isAlertTriggered(
  alert: { condition: 'ABOVE' | 'BELOW' | 'PCT_UP_24H' | 'PCT_DOWN_24H'; target: number },
  quote: AlertMarketQuote,
) {
  if (alert.condition === 'ABOVE') return quote.price >= alert.target;
  if (alert.condition === 'BELOW') return quote.price <= alert.target;
  if (quote.change24h === null) return false;
  if (alert.condition === 'PCT_UP_24H') return quote.change24h >= alert.target;
  return quote.change24h <= -Math.abs(alert.target);
}
