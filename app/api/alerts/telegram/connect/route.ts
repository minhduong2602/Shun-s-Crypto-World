import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerEnv } from '@/lib/config/env';
import { getAdminSupabase } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const user = await requireUser();
    const env = getServerEnv();
    if (!env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'Máy chủ chưa cấu hình TELEGRAM_BOT_TOKEN' }, { status: 503 });
    }
    if (!env.TELEGRAM_WEBHOOK_SECRET || !env.APP_URL || env.APP_URL.includes('localhost')) {
      return NextResponse.json({ error: 'Máy chủ cần cấu hình TELEGRAM_WEBHOOK_SECRET và APP_URL công khai trước khi liên kết bot.' }, { status: 503 });
    }

    const meResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`, {
      signal: AbortSignal.timeout(10_000),
    });
    const me = await meResponse.json().catch(() => null) as { ok?: boolean; result?: { username?: string } } | null;
    const username = me?.result?.username;
    if (!meResponse.ok || !me?.ok || !username) {
      return NextResponse.json({ error: 'Không thể xác minh bot Telegram. Kiểm tra lại TELEGRAM_BOT_TOKEN.' }, { status: 502 });
    }

    const webhookResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${env.APP_URL.replace(/\/$/, '')}/api/telegram/webhook`,
        secret_token: env.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ['message'],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const webhookResult = await webhookResponse.json().catch(() => null) as { ok?: boolean; description?: string } | null;
    if (!webhookResponse.ok || !webhookResult?.ok) {
      return NextResponse.json({ error: webhookResult?.description || 'Không thể cấu hình webhook Telegram.' }, { status: 502 });
    }

    const token = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    const admin = getAdminSupabase();
    const { error: removeError } = await admin.from('telegram_link_tokens')
      .delete().eq('owner_id', user.id).is('consumed_at', null);
    if (removeError) throw removeError;
    const { error: insertError } = await admin.from('telegram_link_tokens').insert({
      owner_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    return NextResponse.json({ botUsername: username, botLink: `https://t.me/${username}?start=${token}`, expiresAt });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để liên kết Telegram' }, { status: 401 });
    console.error('Telegram pairing setup failed:', error);
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    const message = error instanceof Error ? error.message : String(error);
    if (code === '42P01' || code === 'PGRST205' || /telegram_link_tokens/i.test(message)) {
      return NextResponse.json({
        error: 'Supabase chưa có bảng ghép cặp Telegram. Hãy chạy migration supabase/migrations/202610090012_telegram_bot_pairing.sql rồi thử lại.',
      }, { status: 503 });
    }
    if (code === '42501' || /permission denied/i.test(message)) {
      return NextResponse.json({ error: 'Supabase từ chối quyền service-role khi tạo liên kết Telegram. Kiểm tra SUPABASE_SERVICE_ROLE_KEY trong Vercel.' }, { status: 503 });
    }
    if (/Missing or invalid .*environment variables/i.test(message)) {
      return NextResponse.json({ error: 'Cấu hình môi trường server trên Vercel chưa đầy đủ hoặc không hợp lệ. Kiểm tra SUPABASE_SERVICE_ROLE_KEY và các biến Supabase server-side.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Không thể tạo liên kết Telegram lúc này' }, { status: 500 });
  }
}
