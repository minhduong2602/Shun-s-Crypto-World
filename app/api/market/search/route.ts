import { NextRequest, NextResponse } from 'next/server';
import { searchTickerLive, getLivePriceForSymbol } from '@/lib/market-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';

    if (!query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchTickerLive(query);

    // If no direct list match, check if query is a valid symbol directly on Binance
    if (results.length === 0) {
      const direct = await getLivePriceForSymbol(query);
      if (direct) {
        return NextResponse.json({
          results: [
            {
              symbol: query.toUpperCase(),
              name: direct.name || `${query.toUpperCase()} Token`,
              priceUsd: direct.priceUsd,
              change24h: direct.change24h,
            },
          ],
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi tìm kiếm ticker: ' + String(error) }, { status: 500 });
  }
}
