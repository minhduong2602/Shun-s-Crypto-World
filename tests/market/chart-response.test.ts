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

  it('does not manufacture candles when no provider data is available', () => {
    const result = buildChartResponse({ coinId: 'UNKNOWN', timeframe: '1h', data: [] });

    expect(result).toEqual({
      coinId: 'UNKNOWN',
      symbol: 'UNKNOWN',
      timeframe: '1h',
      currentPrice: null,
      dataSource: null,
      isLive: false,
      data: [],
    });
  });
});
