import { NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerSupabase } from '@/lib/supabase/server';
import { getLivePortfolio, summarizeHoldings } from '@/lib/portfolio/repository';

export async function GET() {
  try {
    const user = await requireUser();
    const { holdings, realizedProfitLossUsd, transactions } = await getLivePortfolio(await getServerSupabase(), user.id);
    const summary = summarizeHoldings(holdings, realizedProfitLossUsd);
    const allocation = holdings.map((holding) => ({
      coinId: holding.coinId,
      symbol: holding.symbol,
      name: holding.name,
      valueUsd: holding.currentValue,
      percentage: holding.allocationPercentage,
    }));
    return NextResponse.json({ holdings, summary, allocation, transactions, isLive: true, lastUpdated: new Date().toISOString() });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để xem danh mục' }, { status: 401 });
    console.error('Portfolio summary API error:', error);
    return NextResponse.json({ error: 'Không thể tải tổng quan danh mục lúc này' }, { status: 500 });
  }
}
