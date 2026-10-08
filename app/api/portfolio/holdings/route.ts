import { NextRequest, NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerSupabase } from '@/lib/supabase/server';
import { getLiveHoldings } from '@/lib/portfolio/repository';

function apiError(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để xem danh mục' }, { status: 401 });
  console.error('Portfolio holdings API error:', error);
  return NextResponse.json({ error: 'Không thể tải danh mục lúc này' }, { status: 500 });
}

export async function GET() {
  try {
    const user = await requireUser();
    const holdings = await getLiveHoldings(await getServerSupabase(), user.id);
    return NextResponse.json({ holdings, isLive: true, lastUpdated: new Date().toISOString() });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const symbol = String(body.symbol ?? body.coinId ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{2,20}$/.test(symbol)) return NextResponse.json({ error: 'Mã tài sản không hợp lệ' }, { status: 400 });
    const supabase = await getServerSupabase();
    const { data, error } = await supabase.from('portfolio_transactions')
      .update({ notes: typeof body.notes === 'string' ? body.notes : null })
      .eq('owner_id', user.id)
      .eq('symbol', symbol)
      .select('id');
    if (error) throw error;
    return NextResponse.json({ success: true, updated: (data ?? []).length > 0 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const search = new URL(request.url).searchParams;
    const symbol = String(search.get('symbol') ?? search.get('coinId') ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{2,20}$/.test(symbol)) return NextResponse.json({ error: 'Mã tài sản không hợp lệ' }, { status: 400 });
    const supabase = await getServerSupabase();
    const { data, error } = await supabase.from('portfolio_transactions').delete().eq('owner_id', user.id).eq('symbol', symbol).select('id');
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ error: 'Không tìm thấy vị thế' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
