import { NextRequest, NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerSupabase } from '@/lib/supabase/server';
import { PublicWalletIndexer } from '@/lib/providers/public-wallet-indexer';
import { mapWalletRow } from '@/lib/wallets/wallet-repository';
import { syncWalletAssets, type WalletDatabaseClient } from '@/lib/wallets/wallet-sync-service';
import type { ChainType } from '@/lib/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const supabase = await getServerSupabase();
    const { data: target, error: targetError } = await supabase
      .from('wallets')
      .select('id, chain, address')
      .eq('id', id)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) {
      return NextResponse.json({ error: 'Không tìm thấy ví cần đồng bộ' }, { status: 404 });
    }

    const summary = await syncWalletAssets({
      client: supabase as unknown as WalletDatabaseClient,
      indexer: new PublicWalletIndexer(),
      ownerId: user.id,
      wallet: target as unknown as { id: string; chain: ChainType; address: string },
    });
    const { data: updated, error: updateError } = await supabase
      .from('wallets')
      .select('*, wallet_assets(*)')
      .eq('id', id)
      .single();
    if (updateError || !updated) throw updateError ?? new Error('Không thể tải ví vừa đồng bộ');

    return NextResponse.json({
      success: true,
      wallet: mapWalletRow(updated as unknown as Record<string, unknown>),
      message: `Đã đồng bộ lại ${summary.tokensCount} token on-chain! Tổng giá trị: $${summary.balanceUsd.toLocaleString()}`,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để đồng bộ ví' }, { status: 401 });
    const message = error instanceof Error ? error.message : String(error);
    console.error('Wallet on-chain sync failed', { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({
      error: `Không thể đồng bộ ví on-chain: ${message}. Dữ liệu trước đó (nếu có) vẫn được giữ nguyên. Vui lòng thử lại sau ít phút.`,
    }, { status: 502 });
  }
}
