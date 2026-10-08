import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(req: NextRequest) {
  try {
    const { botToken, chatId, saveOnly } = await req.json();

    if (botToken !== undefined || chatId !== undefined) {
      db.updateSettings({
        ...(botToken !== undefined ? { telegramBotToken: botToken.trim() } : {}),
        ...(chatId !== undefined ? { telegramChatId: chatId.trim() } : {}),
        telegramAlertsEnabled: true,
      });
    }

    if (saveOnly) {
      return NextResponse.json({
        success: true,
        message: 'Đã lưu thông tin cấu hình Telegram Bot thành công!',
      });
    }

    const settings = db.getSettings();
    const token = botToken || settings.telegramBotToken;
    const chat = chatId || settings.telegramChatId;

    if (!token || !chat) {
      return NextResponse.json({
        error: 'Vui lòng cung cấp cả Telegram Bot Token và Chat ID để gửi tin nhắn thử nghiệm',
      }, { status: 400 });
    }

    const testMessage = `🚀 *[Shun's Crypto World]* Cảnh báo thử nghiệm!\n\n` +
      `🔔 *Hệ thống thông báo Telegram Bot đã kết nối thành công!*\n` +
      `📊 Thời gian: ${new Date().toLocaleString('vi-VN')}\n` +
      `💰 Danh mục đang được theo dõi bảo mật 24/7.\n` +
      `Bạn sẽ nhận được cảnh báo ngay khi giá chạm mục tiêu hoặc có biến động đột biến.`;

    const telegramApiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const tgRes = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: testMessage,
        parse_mode: 'Markdown',
      }),
    });

    const tgData = await tgRes.json();
    if (!tgData.ok) {
      return NextResponse.json({
        error: `Telegram API phản hồi lỗi: ${tgData.description || 'Token hoặc Chat ID không hợp lệ'}`,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Đã gửi tin nhắn thông báo thành công đến Telegram của bạn!',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi gửi tin nhắn Telegram: ' + String(error) }, { status: 500 });
  }
}
