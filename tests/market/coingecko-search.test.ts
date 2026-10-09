import { describe, expect, it, vi } from 'vitest';
import { searchCoinGeckoAssets } from '@/lib/market/coingecko-search';

describe('searchCoinGeckoAssets', () => {
  it('finds CoinGecko catalog assets beyond the exchange ticker list and attaches live quotes', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ coins: [
        { id: 'kaspa', symbol: 'kas', name: 'Kaspa', market_cap_rank: 40 },
        { id: 'kaspa-bridged', symbol: 'kas', name: 'Kaspa Bridged', market_cap_rank: 900 },
      ] }))
      .mockResolvedValueOnce(Response.json({
        kaspa: { usd: 0.12, usd_24h_change: 3.5 },
        'kaspa-bridged': { usd: 0.11, usd_24h_change: -1 },
      }));

    const result = await searchCoinGeckoAssets('kas', { apiKeys: ['demo-key'], fetcher });

    expect(result).toEqual([
      { id: 'kaspa', symbol: 'KAS', name: 'Kaspa', priceUsd: 0.12, change24h: 3.5, volume24h: 0, source: 'CoinGecko' },
      { id: 'kaspa-bridged', symbol: 'KAS', name: 'Kaspa Bridged', priceUsd: 0.11, change24h: -1, volume24h: 0, source: 'CoinGecko' },
    ]);
    expect(fetcher.mock.calls[0][0]).toContain('/search?query=kas');
    expect(fetcher.mock.calls[1][0]).toContain('ids=kaspa%2Ckaspa-bridged');
  });

  it('returns no catalog results if no CoinGecko keys are configured', async () => {
    await expect(searchCoinGeckoAssets('kas', { apiKeys: [], fetcher: vi.fn() })).resolves.toEqual([]);
  });
});
