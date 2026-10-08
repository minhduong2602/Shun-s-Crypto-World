import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('shun_session')?.value;
  const settings = db.getSettings();
  const isAuthenticated = Boolean(token && db.verifySession(token));

  return NextResponse.json({
    isAuthenticated,
    twoFactorEnabled: settings.twoFactorEnabled,
    baseCurrency: settings.baseCurrency,
    telegramAlertsEnabled: settings.telegramAlertsEnabled,
    telegramConfigured: Boolean(settings.telegramChatId && settings.telegramBotToken),
  });
}
