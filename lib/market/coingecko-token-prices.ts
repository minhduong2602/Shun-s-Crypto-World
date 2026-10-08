import type { ChainType } from '@/lib/types';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type PriceResponse = Record<string, { usd?: unknown; usd_24h_change?: unknown }>;

const PLATFORM_IDS: Partial<Record<ChainType, string>> = {
  ETH: 'ethereum',
  BSC: 'binance-smart-chain',
  POLYGON: 'polygon-pos',
  ARBITRUM: 'arbitrum-one',
  BASE: 'base',
  SOL: 'solana',
};
const MAX_ADDRESSES_PER_REQUEST = 515;
let nextApiKeyIndex = 0;

function configuredApiKeys() {
  return [
    process.env.COINGECKO_DEMO_API_KEY,
    process.env.COINGECKO_DEMO_API_KEY_2,
    process.env.COINGECKO_DEMO_API_KEY_3,
  ].filter((key): key is string => Boolean(key?.trim())).map((key) => key.trim());
}

function normalizeAddress(chain: ChainType, address: string) {
  return chain === 'SOL' ? address.trim() : address.trim().toLowerCase();
}

async function fetchChunk(
  platformId: string,
  addresses: string[],
  apiKeys: string[],
  fetcher: Fetcher,
): Promise<PriceResponse> {
  const params = new URLSearchParams({
    contract_addresses: addresses.join(','),
    vs_currencies: 'usd',
    include_24hr_change: 'true',
  });
  const url = `https://api.coingecko.com/api/v3/simple/token_price/${platformId}?${params}`;
  const startIndex = nextApiKeyIndex % apiKeys.length;
  nextApiKeyIndex = (startIndex + 1) % apiKeys.length;

  for (let attempt = 0; attempt < apiKeys.length; attempt++) {
    const apiKey = apiKeys[(startIndex + attempt) % apiKeys.length];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetcher(url, {
        headers: { Accept: 'application/json', 'x-cg-demo-api-key': apiKey },
        signal: controller.signal,
        next: { revalidate: 30 },
      });
      if (response.ok) {
        const payload: unknown = await response.json();
        return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as PriceResponse : {};
      }
      // A different configured account can still have quota even if this key is limited.
      if (response.status === 400) return {};
    } catch {
      // Retry the same request with the next configured Demo account.
    } finally {
      clearTimeout(timer);
    }
  }
  return {};
}

export async function fetchCoinGeckoTokenPrices(
  chain: ChainType,
  contractAddresses: string[],
  options: { apiKeys?: string[]; fetcher?: Fetcher } = {},
): Promise<Record<string, { priceUsd: number; change24h?: number }>> {
  const platformId = PLATFORM_IDS[chain];
  const apiKeys = (options.apiKeys ?? configuredApiKeys()).map((key) => key.trim()).filter(Boolean);
  if (!platformId || apiKeys.length === 0) return {};

  const addresses = [...new Set(contractAddresses.map((address) => normalizeAddress(chain, address)).filter(Boolean))];
  if (addresses.length === 0) return {};

  const fetcher = options.fetcher ?? fetch;
  const result: Record<string, { priceUsd: number; change24h?: number }> = {};
  for (let index = 0; index < addresses.length; index += MAX_ADDRESSES_PER_REQUEST) {
    const chunk = addresses.slice(index, index + MAX_ADDRESSES_PER_REQUEST);
    const rows = await fetchChunk(platformId, chunk, apiKeys, fetcher);
    for (const [address, values] of Object.entries(rows)) {
      const priceUsd = Number(values?.usd);
      if (!Number.isFinite(priceUsd) || priceUsd <= 0) continue;
      const change24h = Number(values.usd_24h_change);
      result[normalizeAddress(chain, address)] = {
        priceUsd,
        ...(Number.isFinite(change24h) ? { change24h } : {}),
      };
    }
  }
  return result;
}
