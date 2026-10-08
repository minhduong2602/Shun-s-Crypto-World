import { NextRequest, NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerSupabase } from '@/lib/supabase/server';
import { mapWalletRow } from '@/lib/wallets/wallet-repository';

async function loadWallet(id: string, ownerId: string) {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('wallets')
    .select('*, wallet_assets(*)')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw error;
  return { supabase, wallet: data ? mapWalletRow(data as unknown as Record<string, unknown>) : null };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { wallet } = await loadWallet(id, user.id);
    if (!wallet) return NextResponse.json({ error: 'Không tìm thấy ví' }, { status: 404 });
    return NextResponse.json({ wallet });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để xem ví' }, { status: 401 });
    return NextResponse.json({ error: `Lỗi tải chi tiết ví: ${String(error)}` }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();
    if (body.action === 'remove_token') {
      return NextResponse.json(
        { error: 'Danh mục token được đồng bộ từ blockchain; hãy ẩn token bằng bộ lọc giao diện thay vì xóa dữ liệu on-chain.' },
        { status: 400 }
      );
    }
    if (typeof body.label !== 'string' || !body.label.trim()) {
      return NextResponse.json({ error: 'Tên nhãn ví không hợp lệ' }, { status: 400 });
    }
    const { supabase } = await loadWallet(id, user.id);
    const { error } = await supabase.from('wallets').update({ label: body.label.trim() }).eq('id', id).eq('owner_id', user.id);
    if (error) throw error;
    const { wallet } = await loadWallet(id, user.id);
    if (!wallet) return NextResponse.json({ error: 'Không tìm thấy ví' }, { status: 404 });
    return NextResponse.json({ success: true, wallet, message: 'Cập nhật ví thành công' });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để cập nhật ví' }, { status: 401 });
    return NextResponse.json({ error: `Lỗi cập nhật ví: ${String(error)}` }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const supabase = await getServerSupabase();
    const { error } = await supabase.from('wallets').delete().eq('id', id).eq('owner_id', user.id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Đã xóa ví thành công' });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để xóa ví' }, { status: 401 });
    return NextResponse.json({ error: `Lỗi xóa ví: ${String(error)}` }, { status: 500 });
  }
}
