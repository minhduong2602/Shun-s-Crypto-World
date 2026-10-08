import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET() {
  try {
    const summary = await db.getLivePortfolioSummary();
    const holdings = await db.getLiveHoldings();

    const allocation = holdings.map((h) => ({
      coinId: h.coinId,
      symbol: h.symbol,
      name: h.name,
      valueUsd: h.currentValue,
      percentage: h.allocationPercentage,
    }));

    return NextResponse.json({
      summary,
      allocation,
      isLive: true,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi tải tổng quan danh mục: ' + String(error) }, { status: 500 });
  }
}
