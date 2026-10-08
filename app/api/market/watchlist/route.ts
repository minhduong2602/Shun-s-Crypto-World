import { NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await getServerSupabase();
    const { data, error } = await supabase.from('market_watchlist').select('symbol').eq('owner_id', user.id);
    if (error) throw error;
    return NextResponse.json({ symbols: (data ?? []).map((row) => row.symbol) });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Không thể tải danh sách theo dõi.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{2,20}$/.test(symbol)) return NextResponse.json({ error: 'Mã token không hợp lệ.' }, { status: 400 });
    const supabase = await getServerSupabase();
    const { error } = await supabase.from('market_watchlist').upsert({ owner_id: user.id, symbol }, { onConflict: 'owner_id,symbol' });
    if (error) throw error;
    return NextResponse.json({ success: true, symbol });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Không thể thêm mã vào danh sách theo dõi.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const symbol = new URL(request.url).searchParams.get('symbol')?.trim().toUpperCase() ?? '';
    if (!/^[A-Z0-9]{2,20}$/.test(symbol)) return NextResponse.json({ error: 'Mã token không hợp lệ.' }, { status: 400 });
    const supabase = await getServerSupabase();
    const { error } = await supabase.from('market_watchlist').delete().eq('owner_id', user.id).eq('symbol', symbol);
    if (error) throw error;
    return NextResponse.json({ success: true, symbol });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Không thể xóa mã khỏi danh sách theo dõi.' }, { status: 500 });
  }
}
