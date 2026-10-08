import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLiveCandlesticks } from '@/lib/market-service';

describe('getLiveCandlesticks', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('resolves a CoinGecko asset id to the exchange ticker', async () => {
    const candles = Array.from({ length: 10 }, (_, index) => [
      String((index + 1) * 60_000),
      '100',
      '110',
      '90',
      '105',
      '12',
    ]);
    const fetchMock = vi.fn().mockResolvedValue(Response.json(candles));
    vi.stubGlobal('fetch', fetchMock);

    await getLiveCandlesticks('bitcoin', '15m');

    expect(fetchMock.mock.calls[0][0]).toContain('symbol=BTCUSDT');
  });

  it('uses CoinGecko OHLC candles when both exchange providers and OKX are unavailable', async () => {
    vi.stubEnv('COINGECKO_DEMO_API_KEY', 'demo-key');
    vi.stubEnv('COINGECKO_DEMO_API_KEY_2', '');
    vi.stubEnv('COINGECKO_DEMO_API_KEY_3', '');
    const now = Math.floor(Date.now() / 1_800_000) * 1_800_000;
    const candles = Array.from({ length: 48 }, (_, index) => [
      now - (48 - index) * 1_800_000,
      100 + index,
      101 + index,
      99 + index,
      100.5 + index,
    ]);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v3/klines')) return new Response('exchange unavailable', { status: 503 });
      if (url.includes('www.okx.com')) return Response.json({ code: '1', data: [] });
      if (url.includes('/coins/bitcoin/ohlc?')) return Response.json(candles);
      throw new Error(`Unexpected provider URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const points = await getLiveCandlesticks('BTC', '15m');

    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/coins/bitcoin/ohlc?'))).toBe(true);
    const coinGeckoRequest = fetchMock.mock.calls.find(([input]) => String(input).includes('/coins/bitcoin/ohlc?'));
    expect(new Headers(coinGeckoRequest?.[1]?.headers).get('x-cg-demo-api-key')).toBe('demo-key');
    expect(points).toHaveLength(48);
    expect(points.at(-1)).toMatchObject({ open: 147, high: 148, low: 146, close: 147.5, volume: 0 });
    expect(points.at(-1)!.time - points.at(-2)!.time).toBe(1_800);
  });
});
