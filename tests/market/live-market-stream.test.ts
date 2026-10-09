import { describe, expect, it } from 'vitest';
import { mergeLiveMarketTickers, parseBinanceMiniTickers } from '@/lib/market/live-market-stream';
import type { MarketTicker } from '@/lib/types';

const btc: MarketTicker = {
  id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', rank: 1, priceUsd: 100,
  priceChange1h: null, priceChange24h: 1, priceChange7d: null, marketCapUsd: null,
  volume24hUsd: 10, circulatingSupply: null, sparkline7d: [], high24h: 105, low24h: 95,
};

describe('live market stream', () => {
  it('parses changed USDT mini tickers and ignores unsupported pairs', () => {
    const quotes = parseBinanceMiniTickers([
      { s: 'BTCUSDT', c: '110', o: '100', h: '112', l: '98', q: '9000' },
      { s: 'ETHBTC', c: '0.05', o: '0.04', h: '0.06', l: '0.03', q: '10' },
      { s: 'BTCUPUSDT', c: '1', o: '1', h: '1', l: '1', q: '1' },
    ]);

    expect(quotes.size).toBe(1);
    expect(quotes.get('BTC')).toEqual({
      symbol: 'BTC', priceUsd: 110, priceChange24h: 10, high24h: 112, low24h: 98, volume24hUsd: 9000,
    });
  });

  it('merges a live quote without replacing market metadata', () => {
    const quotes = parseBinanceMiniTickers([{ s: 'BTCUSDT', c: '110', o: '100', h: '112', l: '98', q: '9000' }]);
    const [updated] = mergeLiveMarketTickers([btc], quotes);

    expect(updated.name).toBe('Bitcoin');
    expect(updated.priceUsd).toBe(110);
    expect(updated.priceChange24h).toBe(10);
    expect(updated.volume24hUsd).toBe(9000);
  });
});
