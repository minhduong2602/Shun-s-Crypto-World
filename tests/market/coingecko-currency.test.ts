import { describe, expect, it, vi } from 'vitest';
import { fetchCoinGeckoUsdVndRate } from '@/lib/market/coingecko-currency';

describe('fetchCoinGeckoUsdVndRate', () => {
  it('derives the USD/VND rate from CoinGecko prices for the same asset', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ bitcoin: { usd: 100_000, vnd: 2_600_000_000, last_updated_at: 1_760_000_000 } }));

    await expect(fetchCoinGeckoUsdVndRate({ apiKeys: ['demo-key'], fetcher }))
      .resolves.toEqual({ rate: 26_000, updatedAt: 1_760_000_000 });

    expect(String(fetcher.mock.calls[0][0])).toContain('ids=bitcoin');
    expect(String(fetcher.mock.calls[0][0])).toContain('vs_currencies=usd%2Cvnd');
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('x-cg-demo-api-key')).toBe('demo-key');
  });

  it('rotates through configured CoinGecko keys on provider rate limiting', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(Response.json({ bitcoin: { usd: 100, vnd: 2_550_000 } }));

    await expect(fetchCoinGeckoUsdVndRate({ apiKeys: ['first', 'second'], fetcher }))
      .resolves.toEqual({ rate: 25_500, updatedAt: null });
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get('x-cg-demo-api-key')).not.toBe(new Headers(fetcher.mock.calls[0][1]?.headers).get('x-cg-demo-api-key'));
  });

  it('does not return an invalid or incomplete conversion rate', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ bitcoin: { usd: 0, vnd: 2_550_000 } }));
    await expect(fetchCoinGeckoUsdVndRate({ apiKeys: ['demo'], fetcher })).resolves.toBeNull();
  });
});
