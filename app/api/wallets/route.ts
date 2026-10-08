import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { ChainType } from '@/lib/types';
import { getLiveWalletOnChain, validateAddress } from '@/lib/onchain-wallet-service';

export async function GET() {
  try {
    const wallets = db.getWallets();
    const totalWalletBalance = wallets.reduce((acc, w) => acc + w.balanceUsd, 0);

    return NextResponse.json({
      wallets,
      totalWalletBalance: Number(totalWalletBalance.toFixed(2)),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi tải danh sách ví: ' + String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chain, address, label } = body;

    if (!chain || !address || !label) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp mạng blockchain, địa chỉ ví và tên nhãn gợi nhớ' },
        { status: 400 }
      );
    }

    const trimmed = address.trim();

    // Strict address validation
    const validation = validateAddress(chain as ChainType, trimmed);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Security check: Reject private keys (e.g. 64-char hex without 0x or 66-char starting with 0x that isn't address)
    if (trimmed.length === 64 && /^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return NextResponse.json(
        { error: 'CẢNH BÁO BẢO MẬT: Chuỗi bạn nhập trông giống Private Key! Tuyệt đối không bao giờ nhập Private Key vào bất kỳ đâu. Chỉ nhập Public Address.' },
        { status: 400 }
      );
    }

    // Query actual on-chain balance from public RPC / explorer
    const onChain = await getLiveWalletOnChain(chain as ChainType, trimmed);

    const wallet = db.addWallet({
      chain: chain as ChainType,
      address: trimmed,
      label: label.trim(),
      isActive: true,
      nativeBalance: onChain.nativeBalance,
      nativeSymbol: onChain.nativeSymbol,
      balanceUsd: onChain.balanceUsd,
      tokensCount: onChain.tokensCount,
      tokens: onChain.tokens,
    });

    return NextResponse.json({
      success: true,
      wallet,
      message: `Đã kết nối ví chỉ xem! Quét được ${onChain.tokensCount} coins. Tổng giá trị: $${onChain.balanceUsd.toLocaleString()}`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi thêm ví view-only: ' + String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id || body?.address;
      } catch {
        // body might be empty
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'Thiếu wallet ID hoặc địa chỉ ví' }, { status: 400 });
    }

    const removed = db.removeWallet(id);
    if (!removed) {
      return NextResponse.json({ error: 'Không tìm thấy ví cần xóa trong hệ thống' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa ví khỏi danh sách theo dõi thành công' });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi xóa ví: ' + String(error) }, { status: 500 });
  }
}
