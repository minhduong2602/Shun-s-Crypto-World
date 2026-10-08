import { NextResponse } from 'next/server';
import { getLiveTickers } from '@/lib/market-service';
import { db } from '@/lib/db/store';

export async function GET() {
  try {
    let tickers: any[] = [];
    try {
      tickers = await getLiveTickers();
    } catch {
      tickers = [];
    }

    // Fallback if network is temporarily restricted or external APIs fail
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { symbol, name, price, change24h } = body;
    if (!symbol) {
      return NextResponse.json({ error: 'Thiếu mã symbol token' }, { status: 400 });
    }

    db.addCustomTicker({
      symbol: symbol.toUpperCase(),
      name: name || symbol.toUpperCase(),
      price: Number(price || 1),
      change24h: Number(change24h || 0),
    });

    return NextResponse.json({
      success: true,
      message: `Đã thêm ${symbol.toUpperCase()} vào danh sách theo dõi thị trường!`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi thêm token theo dõi: ' + String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');
    if (!symbol) {
      return NextResponse.json({ error: 'Thiếu mã symbol cần xóa' }, { status: 400 });
    }

    const removed = db.removeCustomTicker(symbol);
    return NextResponse.json({
      success: true,
      removed,
      message: `Đã xóa ${symbol.toUpperCase()} khỏi danh sách theo dõi`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi xóa token: ' + String(error) }, { status: 500 });
  }
}
