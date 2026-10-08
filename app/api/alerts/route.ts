import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { AlertCondition } from '@/lib/types';

export async function GET() {
  try {
    const alerts = db.getAlerts();
    const settings = db.getSettings();
    return NextResponse.json({
      alerts,
      telegramConfig: {
        chatId: settings.telegramChatId || '',
        botToken: settings.telegramBotToken ? '••••••••' + settings.telegramBotToken.slice(-4) : '',
        hasToken: Boolean(settings.telegramBotToken),
        enabled: settings.telegramAlertsEnabled,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi tải cảnh báo giá: ' + String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { coinId, symbol, condition, targetValue, isRecurring } = body;

    if (!coinId || !symbol || !condition || targetValue === undefined) {
      return NextResponse.json({ error: 'Thiếu thông tin cảnh báo bắt buộc' }, { status: 400 });
    }

    const alert = db.addAlert({
      coinId: coinId.toLowerCase(),
      symbol: symbol.toUpperCase(),
      condition: condition as AlertCondition,
      targetValue: Number(targetValue),
      isActive: true,
      isRecurring: Boolean(isRecurring),
    });

    return NextResponse.json({
      success: true,
      alert,
      message: `Đã thiết lập cảnh báo Telegram cho ${symbol.toUpperCase()} khi ${condition} ${targetValue}`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi tạo cảnh báo: ' + String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Thiếu alert ID' }, { status: 400 });
    }

    const deleted = db.deleteAlert(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Không tìm thấy cảnh báo' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa cảnh báo' });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi xóa cảnh báo: ' + String(error) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Thiếu alert ID' }, { status: 400 });
    }

    const updated = db.toggleAlert(id);
    if (!updated) {
      return NextResponse.json({ error: 'Không tìm thấy cảnh báo' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      alert: updated,
      message: updated.isActive ? 'Đã kích hoạt lại cảnh báo' : 'Đã tạm ngưng cảnh báo',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi cập nhật cảnh báo: ' + String(error) }, { status: 500 });
  }
}
