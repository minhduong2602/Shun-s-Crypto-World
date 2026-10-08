import { describe, expect, it } from 'vitest';
import { buildChartResponse } from '@/lib/market/chart-response';

describe('buildChartResponse', () => {
  it('uses the final candle close as the displayed price', () => {
    const result = buildChartResponse({
      coinId: 'eth',
      timeframe: '15m',
      data: [
        { time: 1, open: 10, high: 13, low: 9, close: 11, volume: 100 },
        { time: 2, open: 11, high: 15, low: 10, close: 14, volume: 120 },
      ],
    });

    expect(result).toMatchObject({
      coinId: 'ETH',
      currentPrice: 14,
      isLive: true,
      dataSource: 'Exchange OHLCV',
    });
  });

  it('uses the exchange 24-hour ticker for live price and daily statistics', () => {
    const result = buildChartResponse({
      coinId: 'BTC',
      timeframe: '1w',
      data: [
        { time: 1, open: 90, high: 120, low: 80, close: 100, volume: 10 },
      ],
      ticker: {
        id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', rank: 1,
        priceUsd: 105, priceChange1h: null, priceChange24h: 5.25,
        priceChange7d: null, marketCapUsd: null, volume24hUsd: 42_000,
        circulatingSupply: null, sparkline7d: [], high24h: 110, low24h: 95,
      },
    });

    expect(result).toMatchObject({
      currentPrice: 105,
      priceChange24h: 5.25,
      high24h: 110,
      low24h: 95,
      volume24h: 42_000,
    });
  });

  it('does not manufacture candles when no provider data is available', () => {
    const result = buildChartResponse({ coinId: 'UNKNOWN', timeframe: '1h', data: [] });

    expect(result).toEqual({
      coinId: 'UNKNOWN',
      symbol: 'UNKNOWN',
      timeframe: '1h',
      currentPrice: null,
      priceChange24h: null,
      high24h: null,
      low24h: null,
      volume24h: null,
      dataSource: null,
      isLive: false,
      data: [],
    });
  });
});
