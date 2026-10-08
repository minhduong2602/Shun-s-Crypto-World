import { NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerSupabase } from '@/lib/supabase/server';
import { getPortfolioHistory } from '@/lib/portfolio/history';

const rangeDays: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };

export async function GET(request: Request) {
  try {
    const range = new URL(request.url).searchParams.get('range') ?? '30d';
    const days = Object.hasOwn(rangeDays, range) ? rangeDays[range] : undefined;
    if (!days) return NextResponse.json({ error: 'Khoảng thời gian không hợp lệ' }, { status: 400 });

    const user = await requireUser();
    const snapshots = await getPortfolioHistory(await getServerSupabase(), user.id, days);
    return NextResponse.json({ snapshots });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để xem lịch sử danh mục' }, { status: 401 });
    console.error('Portfolio history API error:', error);
    return NextResponse.json({ error: 'Không thể tải lịch sử danh mục lúc này' }, { status: 500 });
  }
}
