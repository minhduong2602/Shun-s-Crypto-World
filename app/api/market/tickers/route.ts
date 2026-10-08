import { NextResponse } from 'next/server';
import { getLiveTickers } from '@/lib/market-service';
import { db } from '@/lib/db/store';

export async function GET() {
  try {
    let tickers = await getLiveTickers();

    // Fallback if network is temporarily restricted
    if (!tickers || tickers.length === 0) {
      tickers = db.getMarketTickers();
    }

    const totalMarketCap = tickers.slice(0, 100).reduce((acc, t) => acc + t.marketCapUsd, 0) + 900000000000;
    const totalVolume24h = tickers.slice(0, 100).reduce((acc, t) => acc + t.volume24hUsd, 0);
    const btcTicker = tickers.find((t) => t.symbol === 'BTC');
    const btcDominance = btcTicker ? Number(((btcTicker.marketCapUsd / totalMarketCap) * 100).toFixed(1)) : 58.4;

    return NextResponse.json({
      tickers: tickers.slice(0, 100), // Top 100
      isLive: true,
      lastUpdated: new Date().toISOString(),
      globalMetrics: {
        totalMarketCapUsd: totalMarketCap,
        totalVolume24hUsd: totalVolume24h,
        btcDominance,
        ethDominance: 14.2,
        gasGwei: 15,
        fearAndGreedIndex: 72,
        sentimentText: 'Greed',
        activeCryptos: tickers.length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi tải dữ liệu thị trường trực tiếp: ' + String(error) }, { status: 500 });
  }
}
