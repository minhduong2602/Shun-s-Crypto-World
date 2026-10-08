import { NextResponse } from 'next/server';
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
