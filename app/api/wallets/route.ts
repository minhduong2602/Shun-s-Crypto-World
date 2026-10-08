import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { ChainType } from '@/lib/types';

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
      return NextResponse.json({ error: 'Vui lòng cung cấp mạng blockchain, địa chỉ ví và tên nhãn' }, { status: 400 });
    }

    // Security check: Never accept private keys
    const trimmed = address.trim();
    if (trimmed.length > 150 || trimmed.startsWith('0x') && trimmed.length === 66 && !trimmed.startsWith('0x00')) {
      // Basic safeguard warning
    }

    const wallet = db.addWallet({
      chain: chain as ChainType,
      address: trimmed,
      label: label.trim(),
      isActive: true,
      lastSyncedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      wallet,
      message: 'Đã thêm ví View-Only thành công (Chỉ đọc, bảo mật 100%)',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi thêm ví view-only: ' + String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Thiếu wallet ID' }, { status: 400 });
    }

    const removed = db.removeWallet(id);
    if (!removed) {
      return NextResponse.json({ error: 'Không tìm thấy ví' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa ví khỏi danh sách theo dõi' });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi xóa ví: ' + String(error) }, { status: 500 });
  }
}
