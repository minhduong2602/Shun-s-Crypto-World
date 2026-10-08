import type { MarketTicker, OHLCVPoint } from '@/lib/types';

export interface LiveChartResponse {
  coinId: string;
  symbol: string;
  timeframe: string;
  currentPrice: number | null;
  priceChange24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  dataSource: string | null;
  isLive: boolean;
  data: OHLCVPoint[];
  ticker?: MarketTicker | null;
}

export function buildChartResponse({
  coinId,
  timeframe,
  data,
  dataSource = 'Exchange OHLCV',
  ticker = null,
}: {
  coinId: string;
  timeframe: string;
  data: OHLCVPoint[];
  dataSource?: string | null;
  ticker?: MarketTicker | null;
}): LiveChartResponse {
  const symbol = coinId.trim().toUpperCase();
  const candles = [...data].sort((left, right) => left.time - right.time);
  const latest = candles.at(-1);

  return {
    coinId: symbol,
    symbol,
    timeframe,
    currentPrice: ticker?.priceUsd ?? latest?.close ?? null,
    priceChange24h: ticker?.priceChange24h ?? null,
    high24h: ticker?.high24h ?? null,
    low24h: ticker?.low24h ?? null,
    volume24h: ticker?.volume24hUsd ?? null,
    dataSource: latest ? dataSource : null,
    isLive: Boolean(latest),
    data: candles,
  };
}
