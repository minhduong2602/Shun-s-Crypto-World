import { NextRequest, NextResponse } from 'next/server';
import { db, DEFAULT_PRICES } from '@/lib/db/store';
import { TransactionType } from '@/lib/types';

export async function GET() {
  try {
    const transactions = db.getTransactions();
    return NextResponse.json({ transactions });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi tải lịch sử giao dịch: ' + String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { coinId, symbol, name, type, amount, pricePerCoin, fee, notes, walletId, executedAt } = body;

    if (!coinId || !symbol || !amount || !pricePerCoin || !type) {
      return NextResponse.json({ error: 'Thiếu thông tin giao dịch bắt buộc' }, { status: 400 });
    }

    const numAmount = Number(amount);
    const numPrice = Number(pricePerCoin);
    const numFee = Number(fee || 0);

    if (numAmount <= 0 || numPrice <= 0) {
      return NextResponse.json({ error: 'Số lượng và đơn giá phải lớn hơn 0' }, { status: 400 });
    }

    const totalAmount = Number((numAmount * numPrice + numFee).toFixed(2));
    const coinInfo = DEFAULT_PRICES[coinId.toLowerCase()];

    const transaction = db.addTransaction({
      coinId: coinId.toLowerCase(),
      symbol: symbol.toUpperCase(),
      name: name || coinInfo?.name || symbol.toUpperCase(),
      type: type as TransactionType,
      amount: numAmount,
      pricePerCoin: numPrice,
      totalAmount,
      fee: numFee,
      walletId: walletId || undefined,
      notes: notes || undefined,
      executedAt: executedAt || new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      transaction,
      message: 'Giao dịch đã được ghi nhận và cập nhật danh mục thành công!',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi thêm giao dịch: ' + String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Thiếu transaction ID' }, { status: 400 });
    }

    const deleted = db.deleteTransaction(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Không tìm thấy giao dịch' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Đã xóa giao dịch và tính toán lại danh mục',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi xóa giao dịch: ' + String(error) }, { status: 500 });
  }
}
