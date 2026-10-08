import type { OHLCVPoint } from '@/lib/types';

export interface LiveChartResponse {
  coinId: string;
  symbol: string;
  timeframe: string;
  currentPrice: number | null;
  dataSource: 'Exchange OHLCV' | null;
  isLive: boolean;
  data: OHLCVPoint[];
}

export function buildChartResponse({
  coinId,
  timeframe,
  data,
}: {
  coinId: string;
  timeframe: string;
  data: OHLCVPoint[];
}): LiveChartResponse {
  const symbol = coinId.trim().toUpperCase();
  const candles = [...data].sort((left, right) => left.time - right.time);
  const latest = candles.at(-1);

  return {
    coinId: symbol,
    symbol,
    timeframe,
    currentPrice: latest?.close ?? null,
    dataSource: latest ? 'Exchange OHLCV' : null,
    isLive: Boolean(latest),
    data: candles,
  };
}
