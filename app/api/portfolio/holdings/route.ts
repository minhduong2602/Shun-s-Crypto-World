import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET() {
  try {
    const holdings = await db.getLiveHoldings();
    return NextResponse.json({
      holdings,
      isLive: true,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi tải danh sách tài sản: ' + String(error) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { coinId, symbol, notes } = await req.json();
    const target = coinId || symbol;
    if (!target) {
      return NextResponse.json({ error: 'Thiếu mã coinId hoặc symbol' }, { status: 400 });
    }

    const updated = db.updateHoldingNotes(target, notes || '');
    return NextResponse.json({
      success: true,
      updated,
      message: 'Đã cập nhật ghi chú vị thế tài sản thành công!',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi cập nhật ghi chú: ' + String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const coinId = searchParams.get('coinId') || searchParams.get('symbol');

    if (!coinId) {
      return NextResponse.json({ error: 'Thiếu coinId hoặc symbol cần xóa' }, { status: 400 });
    }

    const removed = db.removeHolding(coinId);
    if (!removed) {
      return NextResponse.json({ error: 'Không tìm thấy tài sản để xóa' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Đã xóa toàn bộ vị thế ${coinId.toUpperCase()} và tính toán lại danh mục`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi xóa vị thế tài sản: ' + String(error) }, { status: 500 });
  }
}
