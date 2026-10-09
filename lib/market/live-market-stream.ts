import type { MarketTicker } from '@/lib/types';

export interface LiveMarketQuote {
  symbol: string;
  priceUsd: number;
  priceChange24h: number;
  high24h: number;
  low24h: number;
  volume24hUsd: number;
}

const EXCLUDED_SYMBOL_PARTS = ['UPUSDT', 'DOWNUSDT', 'BEARUSDT', 'BULLUSDT'];

export function parseBinanceMiniTickers(payload: unknown): Map<string, LiveMarketQuote> {
  const rawItems = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && 'data' in payload && Array.isArray(payload.data)
      ? payload.data
      : [];
  const quotes = new Map<string, LiveMarketQuote>();

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const item = rawItem as Record<string, unknown>;
    const pair = typeof item.s === 'string' ? item.s.toUpperCase() : '';
    if (!pair.endsWith('USDT') || EXCLUDED_SYMBOL_PARTS.some((part) => pair.includes(part))) continue;

    const priceUsd = Number(item.c);
    const openPrice = Number(item.o);
    const high24h = Number(item.h);
    const low24h = Number(item.l);
    const volume24hUsd = Number(item.q);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) continue;

    const symbol = pair.slice(0, -4);
    const priceChange24h = Number.isFinite(openPrice) && openPrice > 0
      ? ((priceUsd - openPrice) / openPrice) * 100
      : 0;
    quotes.set(symbol, {
      symbol,
      priceUsd,
      priceChange24h: Number(priceChange24h.toFixed(2)),
      high24h: Number.isFinite(high24h) && high24h > 0 ? high24h : priceUsd,
      low24h: Number.isFinite(low24h) && low24h > 0 ? low24h : priceUsd,
      volume24hUsd: Number.isFinite(volume24hUsd) && volume24hUsd >= 0 ? volume24hUsd : 0,
    });
  }

  return quotes;
}

export function mergeLiveMarketTickers(
  tickers: MarketTicker[],
  quotes: ReadonlyMap<string, LiveMarketQuote>,
): MarketTicker[] {
  let changed = false;
  const next = tickers.map((ticker) => {
    const quote = quotes.get(ticker.symbol.toUpperCase());
    if (!quote) return ticker;
    if (
      ticker.priceUsd === quote.priceUsd
      && ticker.priceChange24h === quote.priceChange24h
      && ticker.high24h === quote.high24h
      && ticker.low24h === quote.low24h
      && ticker.volume24hUsd === quote.volume24hUsd
    ) return ticker;
    changed = true;
    return {
      ...ticker,
      priceUsd: quote.priceUsd,
      priceChange24h: quote.priceChange24h,
      high24h: quote.high24h,
      low24h: quote.low24h,
      volume24hUsd: quote.volume24hUsd,
    };
  });
  return changed ? next : tickers;
}
