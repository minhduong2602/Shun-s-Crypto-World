import { NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerEnv } from '@/lib/config/env';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST() {
  try {
    const user = await requireUser();
    const env = getServerEnv();
    if (!env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'Máy chủ chưa cấu hình TELEGRAM_BOT_TOKEN' }, { status: 503 });
    }
    const supabase = await getServerSupabase();
    const { data: settings, error: settingsError } = await supabase.from('user_settings')
      .select('telegram_chat_id, telegram_alerts_enabled')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings?.telegram_alerts_enabled || !settings.telegram_chat_id) {
      return NextResponse.json({ error: 'Hãy liên kết Telegram bot trước khi gửi tin thử.' }, { status: 409 });
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.telegram_chat_id,
        text: "🔔 Shun's Crypto World đã kết nối Telegram. Cảnh báo giá sẽ được gửi tới đây.",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const telegramResult: unknown = await telegramResponse.json().catch(() => null);
    const telegramDescription = typeof telegramResult === 'object' && telegramResult !== null && 'description' in telegramResult
      && typeof telegramResult.description === 'string' ? telegramResult.description : null;
    const telegramAccepted = typeof telegramResult === 'object' && telegramResult !== null && 'ok' in telegramResult
      && telegramResult.ok === true;
    if (!telegramResponse.ok || !telegramAccepted) {
      return NextResponse.json({ error: telegramDescription || 'Telegram không nhận tin nhắn thử' }, { status: 502 });
    }
    return NextResponse.json({ success: true, message: 'Đã gửi tin nhắn thử nghiệm tới Telegram.' });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để gửi tin thử Telegram' }, { status: 401 });
    console.error('Telegram test delivery failed:', error);
    return NextResponse.json({ error: 'Không thể gửi tin nhắn Telegram lúc này' }, { status: 500 });
  }
}
