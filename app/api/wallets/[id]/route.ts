import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { getLiveWalletOnChain, scanCustomToken } from '@/lib/onchain-wallet-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const wallet = db.getWalletById(id);

    if (!wallet) {
      return NextResponse.json({ error: 'Không tìm thấy ví' }, { status: 404 });
    }

    // If wallet has no tokens yet, scan once
    if (!wallet.tokens || wallet.tokens.length === 0) {
      const onChain = await getLiveWalletOnChain(wallet.chain, wallet.address);
      const updated = db.updateWallet(id, {
        tokens: onChain.tokens,
        tokensCount: onChain.tokensCount,
        balanceUsd: onChain.balanceUsd,
        nativeBalance: onChain.nativeBalance,
        lastSyncedAt: new Date().toISOString(),
      });
      return NextResponse.json({ wallet: updated || wallet });
    }

    return NextResponse.json({ wallet });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi tải chi tiết ví: ' + String(error) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const removed = db.removeWallet(id);

    if (!removed) {
      return NextResponse.json({ error: 'Không tìm thấy ví cần xóa' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa ví thành công' });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi xóa ví: ' + String(error) }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const wallet = db.getWalletById(id);

    if (!wallet) {
      return NextResponse.json({ error: 'Không tìm thấy ví' }, { status: 404 });
    }

    const { contractAddress } = await req.json();
    if (!contractAddress) {
      return NextResponse.json({ error: 'Thiếu địa chỉ hợp đồng token' }, { status: 400 });
    }

    const customToken = await scanCustomToken(wallet.chain, wallet.address, contractAddress);
    if (!customToken) {
      return NextResponse.json({ error: 'Không tìm thấy số dư cho hợp đồng này hoặc mạng không hỗ trợ' }, { status: 400 });
    }

    const currentTokens = wallet.tokens || [];
    // Replace or push
    const existingIndex = currentTokens.findIndex((t) => t.contractAddress?.toLowerCase() === contractAddress.toLowerCase());
    let nextTokens = [...currentTokens];
    if (existingIndex >= 0) {
      nextTokens[existingIndex] = customToken;
    } else {
      nextTokens.push(customToken);
    }

    const totalUsd = nextTokens.reduce((acc, t) => acc + t.balanceUsd, 0);
    for (const t of nextTokens) {
      t.allocationPercentage = totalUsd > 0 ? Number(((t.balanceUsd / totalUsd) * 100).toFixed(1)) : 0;
    }
    nextTokens.sort((a, b) => b.balanceUsd - a.balanceUsd);

    const updated = db.updateWallet(id, {
      tokens: nextTokens,
      tokensCount: nextTokens.length,
      balanceUsd: Number(totalUsd.toFixed(2)),
      lastSyncedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      token: customToken,
      wallet: updated,
      message: `Đã phát hiện token hợp đồng! Số dư: ${customToken.balance} ${customToken.symbol}`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi quét token tùy chỉnh: ' + String(error) }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const wallet = db.getWalletById(id);

    if (!wallet) {
      return NextResponse.json({ error: 'Không tìm thấy ví' }, { status: 404 });
    }

    const body = await req.json();

    // Check if removing a token
    if (body.action === 'remove_token' && body.tokenId) {
      const removed = db.removeWalletToken(id, body.tokenId);
      const updated = db.getWalletById(id);
      return NextResponse.json({
        success: removed,
        wallet: updated,
        message: removed ? 'Đã gỡ token khỏi ví' : 'Không tìm thấy token để gỡ',
      });
    }

    // Normal update (label, isActive)
    const updates: Partial<typeof wallet> = {};
    if (typeof body.label === 'string') updates.label = body.label.trim();
    if (typeof body.isActive === 'boolean') updates.isActive = body.isActive;

    const updated = db.updateWallet(id, updates);

    return NextResponse.json({
      success: true,
      wallet: updated,
      message: 'Cập nhật ví thành công',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi cập nhật ví: ' + String(error) }, { status: 500 });
  }
}
