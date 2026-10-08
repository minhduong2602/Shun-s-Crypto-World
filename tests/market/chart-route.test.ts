import { describe, expect, it, vi } from 'vitest';

const { getLiveCandlesticksMock, getLiveTickersMock } = vi.hoisted(() => ({
  getLiveCandlesticksMock: vi.fn(),
  getLiveTickersMock: vi.fn(),
}));

vi.mock('@/lib/market-service', () => ({
  getLiveCandlesticksWithSource: getLiveCandlesticksMock,
  getLiveTickers: getLiveTickersMock,
}));

import { GET } from '@/app/api/market/chart/route';

describe('GET /api/market/chart', () => {
  it('normalizes CoinGecko asset IDs before requesting candles and ticker data', async () => {
    getLiveCandlesticksMock.mockResolvedValue({ data: [{ time: 1, open: 100, high: 105, low: 95, close: 102, volume: 20 }], source: 'Exchange OHLCV' });
    getLiveTickersMock.mockResolvedValue([{
      id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', rank: 1, priceUsd: 103,
      priceChange1h: null, priceChange24h: 3, priceChange7d: null, marketCapUsd: null,
      volume24hUsd: 1000, circulatingSupply: null, sparkline7d: [], high24h: 110, low24h: 90,
    }]);

    const response = await GET(new Request('http://localhost/api/market/chart?coinId=bitcoin') as never);

    expect(response.status).toBe(200);
    expect(getLiveCandlesticksMock).toHaveBeenCalledWith('BTC', '15m');
    await expect(response.json()).resolves.toMatchObject({ coinId: 'BTC', currentPrice: 103 });
  });

  it('returns the actual fallback source label so the chart never implies exchange precision', async () => {
    getLiveCandlesticksMock.mockResolvedValue({
      data: [{ time: 1, open: 100, high: 105, low: 95, close: 102, volume: 0 }],
      source: 'CoinGecko OHLC · 30m fallback',
    });
    getLiveTickersMock.mockResolvedValue([]);

    const response = await GET(new Request('http://localhost/api/market/chart?coinId=BTC') as never);

    await expect(response.json()).resolves.toMatchObject({ dataSource: 'CoinGecko OHLC · 30m fallback' });
  });
});
