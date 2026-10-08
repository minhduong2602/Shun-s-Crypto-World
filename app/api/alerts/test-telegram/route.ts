import { NextRequest, NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerEnv } from '@/lib/config/env';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
    const saveOnly = Boolean(body.saveOnly);
    if (!chatId) return NextResponse.json({ error: 'Vui lòng nhập Telegram Chat ID' }, { status: 400 });

    const env = getServerEnv();
    if (!env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'Máy chủ chưa cấu hình TELEGRAM_BOT_TOKEN' }, { status: 503 });
    }

    if (!saveOnly) {
      const telegramResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🔔 Shun's Crypto World đã kết nối Telegram. Cảnh báo giá sẽ được gửi tới đây.`,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const telegramResult: unknown = await telegramResponse.json().catch(() => null);
      const telegramDescription = typeof telegramResult === 'object' && telegramResult !== null && 'description' in telegramResult
        && typeof telegramResult.description === 'string' ? telegramResult.description : null;
      const telegramAccepted = typeof telegramResult === 'object' && telegramResult !== null && 'ok' in telegramResult
        && telegramResult.ok === true;
      if (!telegramResponse.ok || !telegramAccepted) {
        return NextResponse.json({ error: telegramDescription || 'Telegram không nhận tin nhắn test' }, { status: 502 });
      }
    }

    const supabase = await getServerSupabase();
    const { error: saveError } = await supabase.from('user_settings').upsert({
      owner_id: user.id,
      telegram_chat_id: chatId,
      telegram_alerts_enabled: true,
    }, { onConflict: 'owner_id' });
    if (saveError) throw saveError;

    if (saveOnly) return NextResponse.json({ success: true, message: 'Đã lưu Telegram Chat ID.' });

    return NextResponse.json({ success: true, message: 'Đã gửi tin nhắn thử nghiệm tới Telegram.' });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để cấu hình Telegram' }, { status: 401 });
    console.error('Telegram setup error:', error);
    return NextResponse.json({ error: 'Không thể lưu hoặc gửi tin nhắn Telegram lúc này' }, { status: 500 });
  }
}
