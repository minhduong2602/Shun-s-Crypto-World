import { describe, expect, it, vi } from 'vitest';
import { createAlertMarketQuoteProvider, isAlertTriggered } from '@/supabase/functions/_shared/alert-market-quotes';

describe('alert market quotes', () => {
  it('fetches a fresh contract quote for the alert chain and rotates keys after rate limiting', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(Response.json({ '0xabc': { usd: 12.5, usd_24h_change: -2.25 } }));
    const provider = createAlertMarketQuoteProvider({ apiKeys: ['first', 'second'], fetcher });

    const quote = await provider.forAsset({ symbol: 'TOK', chain: 'BASE', assetAddress: '0xABC', isNative: false });

    expect(String(fetcher.mock.calls[0][0])).toContain('/simple/token_price/base?');
    expect(decodeURIComponent(String(fetcher.mock.calls[0][0]))).toContain('contract_addresses=0xabc');
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('x-cg-demo-api-key')).toBe('first');
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get('x-cg-demo-api-key')).toBe('second');
    expect(quote).toEqual({ price: 12.5, change24h: -2.25 });
  });

  it('uses a ticker quote for native assets and does not refetch the same asset twice per run', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json([{ symbol: 'ETH', current_price: 2100, price_change_percentage_24h: 1.5 }]));
    const provider = createAlertMarketQuoteProvider({ apiKeys: ['demo'], fetcher });
    const asset = { symbol: 'ETH', chain: 'BASE', assetAddress: 'native', isNative: true };

    await expect(provider.forAsset(asset)).resolves.toEqual({ price: 2100, change24h: 1.5 });
    await expect(provider.forAsset(asset)).resolves.toEqual({ price: 2100, change24h: 1.5 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain('/coins/markets?');
  });

  it('does not trigger percentage alerts when the live quote lacks 24-hour change data', () => {
    expect(isAlertTriggered({ condition: 'PCT_UP_24H', target: 5 }, { price: 100, change24h: null })).toBe(false);
    expect(isAlertTriggered({ condition: 'ABOVE', target: 95 }, { price: 100, change24h: null })).toBe(true);
  });
});
