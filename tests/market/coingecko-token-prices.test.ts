import { describe, expect, it, vi } from 'vitest';
import { fetchCoinGeckoTokenPrices } from '@/lib/market/coingecko-token-prices';

describe('fetchCoinGeckoTokenPrices', () => {
  it('uses CoinGecko Base platform for Base token prices', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ '0xabc': { usd: 3.5, usd_24h_change: 1.1 } }));
    const prices = await fetchCoinGeckoTokenPrices('BASE', ['0xABC'], { apiKeys: ['demo'], fetcher });
    expect(String(fetcher.mock.calls[0][0])).toContain('/simple/token_price/base?');
    expect(prices['0xabc']).toEqual({ priceUsd: 3.5, change24h: 1.1 });
  });

  it('retries with the next configured Demo key after a rate limit and maps by contract address', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(Response.json({
        '0xabc': { usd: 2.75, usd_24h_change: -1.2 },
        '0xdef': { usd: 0, usd_24h_change: 0 },
      }));

    const prices = await fetchCoinGeckoTokenPrices('ETH', ['0xABC', '0xDEF'], {
      apiKeys: ['first-key', 'second-key'],
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('x-cg-demo-api-key')).toBe('first-key');
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get('x-cg-demo-api-key')).toBe('second-key');
    expect(String(fetcher.mock.calls[0][0])).toContain('/simple/token_price/ethereum?');
    expect(decodeURIComponent(String(fetcher.mock.calls[0][0]))).toContain('contract_addresses=0xabc,0xdef');
    expect(prices).toEqual({ '0xabc': { priceUsd: 2.75, change24h: -1.2 } });
  });
});
