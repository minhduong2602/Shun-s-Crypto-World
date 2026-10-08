import type { OHLCVPoint } from '@/lib/types';
import { getCoinGeckoIdForSymbol } from '@/lib/market/chart-symbol';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type OhlcRow = [number, number, number, number, number];
type Result = { data: OHLCVPoint[]; source: string } | null;

let nextApiKeyIndex = 0;

function getLookback(timeframe: string) {
  const normalized = timeframe.toLowerCase();
  if (normalized === '1w' || normalized === 'w') return { days: '90', intervalLabel: '4d' };
  if (normalized === '4h') return { days: '30', intervalLabel: '4h' };
  if (normalized === '1d' || normalized === 'd') return { days: '30', intervalLabel: '4h' };
  return { days: '1', intervalLabel: '30m' };
}

function toCandles(payload: unknown, fallbackIntervalSeconds: number): OHLCVPoint[] {
  if (!Array.isArray(payload)) return [];
  const rows = payload.flatMap((entry): OhlcRow[] => {
    if (!Array.isArray(entry) || entry.length < 5) return [];
    const [timestamp, open, high, low, close] = entry.map(Number);
    if (![timestamp, open, high, low, close].every(Number.isFinite)
      || timestamp <= 0 || open <= 0 || high <= 0 || low <= 0 || close <= 0 || high < low) return [];
    return [[timestamp, open, high, low, close]];
  }).sort((left, right) => left[0] - right[0]);

  const intervals = rows.slice(1).flatMap((row, index) => {
    const seconds = Math.round((row[0] - rows[index][0]) / 1000);
    return seconds > 0 ? [seconds] : [];
  }).sort((left, right) => left - right);
  const inferredIntervalSeconds = intervals.length
    ? intervals[Math.floor(intervals.length / 2)]
    : fallbackIntervalSeconds;
  const candles: OHLCVPoint[] = [];
  let lastTime = 0;
  for (const [timestamp, open, high, low, close] of rows) {
    // CoinGecko timestamps OHLC rows at candle close; chart libraries expect the open time.
    const time = Math.floor(timestamp / 1000) - inferredIntervalSeconds;
    if (time <= lastTime) continue;
    candles.push({ time, open, high, low, close, volume: 0 });
    lastTime = time;
  }
  return candles;
}

export async function fetchCoinGeckoOhlc(
  symbol: string,
  timeframe: string,
  options: { apiKeys?: string[]; fetcher?: Fetcher } = {},
): Promise<Result> {
  const coinId = getCoinGeckoIdForSymbol(symbol);
  const keys = (options.apiKeys ?? [
    process.env.COINGECKO_DEMO_API_KEY,
    process.env.COINGECKO_DEMO_API_KEY_2,
    process.env.COINGECKO_DEMO_API_KEY_3,
  ]).map((key) => key?.trim()).filter((key): key is string => Boolean(key));
  if (!coinId || keys.length === 0) return null;

  const { days, intervalLabel } = getLookback(timeframe);
  const params = new URLSearchParams({ vs_currency: 'usd', days });
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?${params}`;
  const fetcher = options.fetcher ?? fetch;
  const startIndex = nextApiKeyIndex % keys.length;
  nextApiKeyIndex = (startIndex + 1) % keys.length;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(startIndex + attempt) % keys.length];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetcher(url, {
        headers: { Accept: 'application/json', 'x-cg-demo-api-key': key },
        signal: controller.signal,
        next: { revalidate: 60 },
      });
      if (!response.ok) continue;
      const payload: unknown = await response.json();
      const fallbackSeconds = intervalLabel === '30m' ? 1_800 : intervalLabel === '4h' ? 14_400 : 345_600;
      const data = toCandles(payload, fallbackSeconds);
      if (data.length > 0) return { data, source: `CoinGecko OHLC · ${intervalLabel} fallback` };
    } catch {
      // Try the next configured Demo account before returning no fallback data.
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}
