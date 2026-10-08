import { MarketTicker, OHLCVPoint } from './types';
import { normalizeChartSymbol } from './market/chart-symbol';
import { fetchCoinGeckoOhlc } from './market/coingecko-ohlc';

// In-memory cache for live market data
let cachedTickers: MarketTicker[] = [];
let lastTickerFetchTime = 0;
const CACHE_TTL_MS = 6000; // 6 seconds cache for snappy updates while respecting rate limits

// Top popular crypto metadata mapping (name, icon colors)
export const COIN_METADATA: Record<string, { name: string; rank: number }> = {
  BTC: { name: 'Bitcoin', rank: 1 },
  ETH: { name: 'Ethereum', rank: 2 },
  USDT: { name: 'Tether USD', rank: 3 },
  BNB: { name: 'BNB', rank: 4 },
  SOL: { name: 'Solana', rank: 5 },
  XRP: { name: 'XRP', rank: 6 },
  USDC: { name: 'USD Coin', rank: 7 },
  DOGE: { name: 'Dogecoin', rank: 8 },
  ADA: { name: 'Cardano', rank: 9 },
  TRX: { name: 'TRON', rank: 10 },
  AVAX: { name: 'Avalanche', rank: 11 },
  SUI: { name: 'Sui', rank: 12 },
  LINK: { name: 'Chainlink', rank: 13 },
  SHIB: { name: 'Shiba Inu', rank: 14 },
  TON: { name: 'Toncoin', rank: 15 },
  XLM: { name: 'Stellar', rank: 16 },
  DOT: { name: 'Polkadot', rank: 17 },
  BCH: { name: 'Bitcoin Cash', rank: 18 },
  HBAR: { name: 'Hedera', rank: 19 },
  PEPE: { name: 'Pepe', rank: 20 },
  NEAR: { name: 'NEAR Protocol', rank: 21 },
  UNI: { name: 'Uniswap', rank: 22 },
  APT: { name: 'Aptos', rank: 23 },
  LTC: { name: 'Litecoin', rank: 24 },
  TAO: { name: 'Bittensor', rank: 25 },
  ICP: { name: 'Internet Computer', rank: 26 },
  POL: { name: 'Polygon', rank: 27 },
  FET: { name: 'Artificial Superintelligence', rank: 28 },
  RENDER: { name: 'Render', rank: 29 },
  AAVE: { name: 'Aave', rank: 30 },
  KAS: { name: 'Kaspa', rank: 31 },
  WIF: { name: 'dogwifhat', rank: 32 },
  ONDO: { name: 'Ondo', rank: 33 },
  ATOM: { name: 'Cosmos', rank: 34 },
  INJ: { name: 'Injective', rank: 35 },
  TIA: { name: 'Celestia', rank: 36 },
  SEI: { name: 'Sei', rank: 37 },
  FIL: { name: 'Filecoin', rank: 38 },
  ARB: { name: 'Arbitrum', rank: 39 },
  OP: { name: 'Optimism', rank: 40 },
  BONK: { name: 'Bonk', rank: 41 },
  FLOKI: { name: 'Floki', rank: 42 },
};

interface ExchangeProvider {
  name: string;
  baseUrl: string;
}

// Exchange providers list. MEXC has Binance v3 API parity and isn't blocked by corporate firewalls.
const EXCHANGE_PROVIDERS: ExchangeProvider[] = [
  { name: 'MEXC', baseUrl: 'https://api.mexc.com' },
  { name: 'Binance', baseUrl: 'https://api.binance.com' },
];

let preferredProviderIndex = 0;
let lastProviderFailureTime = 0;
const RECHECK_PRIMARY_INTERVAL_MS = 10 * 60 * 1000;

async function fetchFromExchange(path: string, options?: RequestInit): Promise<any> {
  const now = Date.now();
  const startIndex = now - lastProviderFailureTime > RECHECK_PRIMARY_INTERVAL_MS
    ? 0
    : preferredProviderIndex;

  const orderedIndices = [
    startIndex,
    ...EXCHANGE_PROVIDERS.map((_, i) => i).filter((i) => i !== startIndex),
  ];

  let lastError: any = null;

  for (const idx of orderedIndices) {
    const provider = EXCHANGE_PROVIDERS[idx];
    const url = `${provider.baseUrl}${path}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ShunCryptoPortfolio/1.0',
          ...(options?.headers || {}),
        },
      });
      clearTimeout(timer);

      if (res.ok) {
        if (preferredProviderIndex !== idx) {
          console.info(`[MarketService] Nguồn dữ liệu thị trường đang dùng: ${provider.name}`);
          preferredProviderIndex = idx;
        }
        return await res.json();
      }

      lastError = new Error(`${provider.name} trả về HTTP ${res.status}`);
      if (idx === preferredProviderIndex) {
        preferredProviderIndex = (preferredProviderIndex + 1) % EXCHANGE_PROVIDERS.length;
        lastProviderFailureTime = now;
      }
    } catch (err: any) {
      lastError = err;
      if (idx === preferredProviderIndex) {
        preferredProviderIndex = (preferredProviderIndex + 1) % EXCHANGE_PROVIDERS.length;
        lastProviderFailureTime = now;
      }
    }
  }

  throw lastError || new Error('Tất cả nguồn dữ liệu sàn giao dịch đều không phản hồi');
}

/**
 * Fetches real-time 24hr tickers directly from Exchange Public REST API
 */
export async function getLiveTickers(): Promise<MarketTicker[]> {
  const now = Date.now();
  if (cachedTickers.length > 0 && now - lastTickerFetchTime < CACHE_TTL_MS) {
    return cachedTickers;
  }

  try {
    const data: Array<{
      symbol: string;
      lastPrice: string;
      prevClosePrice?: string;
      priceChangePercent: string;
      highPrice: string;
      lowPrice: string;
      volume: string;
      quoteVolume: string;
    }> = await fetchFromExchange('/api/v3/ticker/24hr', {
      next: { revalidate: 5 },
    });

    // Filter only USDT pairs, excluding leveraged/fan tokens if unwanted
    const usdtPairs = data.filter(
      (item) =>
        item.symbol.endsWith('USDT') &&
        !item.symbol.includes('UPUSDT') &&
        !item.symbol.includes('DOWNUSDT') &&
        !item.symbol.includes('BEARUSDT') &&
        !item.symbol.includes('BULLUSDT')
    );

    // Map into our structured MarketTicker format
    const tickers: MarketTicker[] = [];

    for (const item of usdtPairs) {
      const baseSymbol = item.symbol.replace('USDT', '');
      const price = parseFloat(item.lastPrice);
      if (isNaN(price) || price <= 0) continue;

      let change24h: number;
      if (item.prevClosePrice && parseFloat(item.prevClosePrice) > 0) {
        const prevClose = parseFloat(item.prevClosePrice);
        change24h = ((price - prevClose) / prevClose) * 100;
      } else {
        let rawChange = parseFloat(item.priceChangePercent);
        if (Math.abs(rawChange) < 0.6 && rawChange !== 0) rawChange = rawChange * 100;
        change24h = rawChange;
      }

      const volumeUsd = parseFloat(item.quoteVolume);
      const meta = COIN_METADATA[baseSymbol];

      tickers.push({
        id: baseSymbol.toLowerCase(),
        symbol: baseSymbol,
        name: meta?.name || `${baseSymbol} Token`,
        rank: meta?.rank || 999,
        priceUsd: price,
        priceChange1h: null,
        priceChange24h: Number(change24h.toFixed(2)),
        priceChange7d: null,
        marketCapUsd: null,
        volume24hUsd: Math.round(volumeUsd),
        circulatingSupply: null,
        sparkline7d: [],
        high24h: parseFloat(item.highPrice) || price * 1.03,
        low24h: parseFloat(item.lowPrice) || price * 0.97,
      });
    }

    // Sort: known coins with ranks first, then by 24h trading volume
    tickers.sort((a, b) => {
      if (a.rank !== 999 && b.rank !== 999) return a.rank - b.rank;
      if (a.rank !== 999) return -1;
      if (b.rank !== 999) return 1;
      return b.volume24hUsd - a.volume24hUsd;
    });

    // Re-assign continuous ranks
    tickers.forEach((t, i) => {
      t.rank = i + 1;
    });

    cachedTickers = tickers;
    lastTickerFetchTime = now;
    return tickers;
  } catch (error) {
    console.error('Lỗi khi fetch live tickers từ sàn giao dịch:', error);
    if (cachedTickers.length > 0) {
      return cachedTickers;
    }
    return [];
  }
}

/**
 * Searches any crypto ticker in the world
 */
export async function searchTickerLive(query: string): Promise<
  Array<{
    symbol: string;
    name: string;
    priceUsd: number;
    change24h: number;
    volume24h: number;
  }>
> {
  const clean = query.trim().toUpperCase();
  if (!clean) return [];

  const allTickers = await getLiveTickers();

  // Search exact or matching prefix
  const matched = allTickers.filter(
    (t) =>
      t.symbol.startsWith(clean) ||
      t.symbol.includes(clean) ||
      t.name.toUpperCase().includes(clean)
  );

  return matched.slice(0, 15).map((t) => ({
    symbol: t.symbol,
    name: t.name,
    priceUsd: t.priceUsd,
    change24h: t.priceChange24h,
    volume24h: t.volume24hUsd,
  }));
}

/**
 * Fetches real-time price for a single coin symbol
 */
export async function getLivePriceForSymbol(symbol: string): Promise<{
  priceUsd: number;
  change24h: number;
  high24h?: number;
  low24h?: number;
  name?: string;
} | null> {
  const cleanSymbol = symbol.trim().toUpperCase();

  try {
    const data = await fetchFromExchange(
      `/api/v3/ticker/24hr?symbol=${cleanSymbol}USDT`,
      { next: { revalidate: 3 } }
    );
    if (data && data.lastPrice) {
      const price = parseFloat(data.lastPrice);
      let change24h: number;
      if (data.prevClosePrice && parseFloat(data.prevClosePrice) > 0) {
        const prevClose = parseFloat(data.prevClosePrice);
        change24h = ((price - prevClose) / prevClose) * 100;
      } else {
        let raw = parseFloat(data.priceChangePercent);
        if (Math.abs(raw) < 0.6 && raw !== 0) raw = raw * 100;
        change24h = raw;
      }
      return {
        priceUsd: price,
        change24h: Number(change24h.toFixed(2)),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        name: COIN_METADATA[cleanSymbol]?.name || `${cleanSymbol} Token`,
      };
    }
  } catch (e) {
    console.warn(`Không thể lấy giá trực tiếp từ sàn cho ${cleanSymbol}:`, e);
  }

  // Fallback to cached ticker
  const match = cachedTickers.find((t) => t.symbol === cleanSymbol);
  if (match) {
    return {
      priceUsd: match.priceUsd,
      change24h: match.priceChange24h,
      high24h: match.high24h,
      low24h: match.low24h,
      name: match.name,
    };
  }

  return null;
}

/**
 * Fetches real live OHLCV candlestick data directly from Exchange Klines API (Binance, MEXC, OKX)
 */
export type LiveCandlestickResult = { data: OHLCVPoint[]; source: string | null };

export async function getLiveCandlesticksWithSource(
  symbol: string,
  timeframe: string
): Promise<LiveCandlestickResult> {
  const cleanSymbol = normalizeChartSymbol(symbol);
  const pair = `${cleanSymbol}USDT`;

  let interval = '15m';
  let limit = 200;
  let okxBar = '15m';

  const tf = timeframe.toLowerCase();
  if (tf === '1m') {
    interval = '1m';
    limit = 200;
    okxBar = '1m';
  } else if (tf === '5m') {
    interval = '5m';
    limit = 200;
    okxBar = '5m';
  } else if (tf === '15m') {
    interval = '15m';
    limit = 200;
    okxBar = '15m';
  } else if (tf === '1h' || tf === '60m') {
    interval = '1h';
    limit = 200;
    okxBar = '1H';
  } else if (tf === '4h') {
    interval = '4h';
    limit = 200;
    okxBar = '4H';
  } else if (tf === '1d' || tf === 'd') {
    interval = '1d';
    limit = 200;
    okxBar = '1D';
  } else if (tf === '1w' || tf === 'w') {
    interval = '1w';
    limit = 150;
    okxBar = '1W';
  }

  // 1. Try Primary Exchange Providers (Binance & MEXC)
  try {
    const klines = await fetchFromExchange(
      `/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`,
      { next: { revalidate: 3 } }
    );

    if (Array.isArray(klines) && klines.length > 0) {
      const points: OHLCVPoint[] = [];
      let lastTime = 0;
      for (const k of klines) {
        const timeSec = Math.floor(k[0] / 1000);
        if (timeSec > lastTime) {
          points.push({
            time: timeSec,
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
          });
          lastTime = timeSec;
        }
      }
      if (points.length >= 10) return { data: points, source: 'Exchange OHLCV' };
    }
  } catch (e) {
    console.warn(`Primary exchange Klines failed for ${pair}:`, e);
  }

  // 2. Fallback to OKX Public REST API
  try {
    const okxRes = await fetch(
      `https://www.okx.com/api/v5/market/candles?instId=${cleanSymbol}-USDT&bar=${okxBar}&limit=${limit}`,
      { next: { revalidate: 3 } }
    );
    if (okxRes.ok) {
      const okxJson = await okxRes.json();
      if (okxJson.code === '0' && Array.isArray(okxJson.data) && okxJson.data.length > 0) {
        // OKX returns newest first, reverse to ascending
        const sorted = [...okxJson.data].reverse();
        const points: OHLCVPoint[] = [];
        let lastTime = 0;
        for (const k of sorted) {
          const timeSec = Math.floor(parseInt(k[0], 10) / 1000);
          if (timeSec > lastTime) {
            points.push({
              time: timeSec,
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
            });
            lastTime = timeSec;
          }
        }
        if (points.length >= 10) return { data: points, source: 'Exchange OHLCV' };
      }
    }
  } catch (e) {
    console.warn(`OKX fallback failed for ${cleanSymbol}:`, e);
  }

  const coinGeckoResult = await fetchCoinGeckoOhlc(cleanSymbol, timeframe);
  if (coinGeckoResult) return coinGeckoResult;
  return { data: [], source: null };
}

export async function getLiveCandlesticks(
  symbol: string,
  timeframe: string,
): Promise<OHLCVPoint[]> {
  return (await getLiveCandlesticksWithSource(symbol, timeframe)).data;
}
