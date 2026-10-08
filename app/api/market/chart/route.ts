import { NextRequest, NextResponse } from 'next/server';
import { buildChartResponse } from '@/lib/market/chart-response';
import { getLiveCandlesticks } from '@/lib/market-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const coinId = (searchParams.get('coinId') || 'BTC').toUpperCase();
    const timeframe = (searchParams.get('timeframe') || '15m').toLowerCase();

    const data = await getLiveCandlesticks(coinId, timeframe);
    const response = buildChartResponse({ coinId, timeframe, data });

    if (!response.isLive) {
      return NextResponse.json(
        {
          ...response,
          error: `Không có dữ liệu OHLCV thực cho ${coinId}/USDT từ các nguồn sàn hiện tại.`,
          code: 'MARKET_DATA_UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: `Lỗi tải dữ liệu biểu đồ nến: ${String(error)}`, code: 'MARKET_DATA_UNAVAILABLE' },
      { status: 503 }
    );
  }
}
