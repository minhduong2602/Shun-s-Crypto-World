import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { getLiveWalletOnChain } from '@/lib/onchain-wallet-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const target = db.getWalletById(id);

    if (!target) {
      return NextResponse.json({ error: 'Không tìm thấy ví cần đồng bộ' }, { status: 404 });
    }

    // Query real live on-chain balance from public RPC / explorer
    const onChain = await getLiveWalletOnChain(target.chain, target.address);

    const updated = db.updateWallet(id, {
      nativeBalance: onChain.nativeBalance,
      nativeSymbol: onChain.nativeSymbol,
      balanceUsd: onChain.balanceUsd,
      tokensCount: onChain.tokensCount,
      tokens: onChain.tokens,
      lastSyncedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      wallet: updated,
      message: `Đã đồng bộ lại ${onChain.tokensCount} coins on-chain! Tổng giá trị: $${onChain.balanceUsd.toLocaleString()}`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi đồng bộ ví on-chain: ' + String(error) }, { status: 500 });
  }
}
