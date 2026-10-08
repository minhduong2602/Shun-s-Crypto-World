import { NextResponse } from 'next/server';
import { getLiveTickers } from '@/lib/market-service';
import { getCoinGeckoUsdVndRate } from '@/lib/market/coingecko-currency';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await requireUser();
    const [allTickers, exchangeRate] = await Promise.all([getLiveTickers(), getCoinGeckoUsdVndRate()]);
    const supabase = await getServerSupabase();
    const { data: watchlist, error } = await supabase.from('market_watchlist').select('symbol').eq('owner_id', user.id);
    if (error) throw error;
    const symbols = new Set((watchlist ?? []).map((row) => row.symbol));
    const tickers = [...new Map([
      ...allTickers.slice(0, 100),
      ...allTickers.filter((ticker) => symbols.has(ticker.symbol)),
    ].map((ticker) => [ticker.symbol, ticker])).values()];
    return NextResponse.json({
      tickers,
      usdVndRate: exchangeRate?.rate ?? null,
      usdVndRateUpdatedAt: exchangeRate?.updatedAt ? new Date(exchangeRate.updatedAt * 1000).toISOString() : null,
      isLive: tickers.length > 0,
      lastUpdated: tickers.length > 0 ? new Date().toISOString() : null,
      globalMetrics: {
        totalVolume24hUsd: allTickers.reduce((total, ticker) => total + ticker.volume24hUsd, 0),
        activePairs: allTickers.length,
      },
      unavailableMetrics: ['totalMarketCapUsd', 'btcDominance', 'ethDominance', 'gasGwei', 'fearAndGreedIndex'],
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Lỗi tải dữ liệu thị trường trực tiếp: ' + String(error) }, { status: 503 });
  }
}
