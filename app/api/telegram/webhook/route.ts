import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/config/env';
import { getAdminSupabase } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number | string; type?: string };
  };
};

function secretMatches(actual: string | null, expected: string) {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret || !secretMatches(request.headers.get('x-telegram-bot-api-secret-token'), webhookSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json() as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }
  const message = update.message;
  const match = message?.chat?.type === 'private'
    ? message.text?.match(/^\/start(?:@\w+)?\s+([a-f0-9]{48})$/i)
    : null;
  if (!match || message?.chat?.id === undefined) return NextResponse.json({ ok: true });
  if (!env.TELEGRAM_BOT_TOKEN) return NextResponse.json({ error: 'Telegram bot is not configured' }, { status: 503 });

  const tokenHash = createHash('sha256').update(match[1]).digest('hex');
  const { data: linked, error } = await getAdminSupabase().rpc('complete_telegram_link', {
    p_token_hash: tokenHash,
    p_chat_id: String(message.chat.id),
  });
  if (error) {
    console.error('Telegram link completion failed:', error.message);
    return NextResponse.json({ error: 'Could not complete Telegram pairing' }, { status: 500 });
  }
  if (linked) {
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: message.chat.id,
          text: "✅ Telegram đã kết nối với Shun's Crypto World. Bạn sẽ nhận cảnh báo giá tại đây.",
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (sendError) {
      console.error('Telegram pairing confirmation could not be sent:', sendError);
    }
  } else {
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: message.chat.id, text: 'Liên kết đã hết hạn hoặc đã được sử dụng. Hãy tạo liên kết mới trong ứng dụng.' }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // Telegram retries the webhook; the one-time pairing result is already definitive.
    }
  }
  return NextResponse.json({ ok: true });
}
