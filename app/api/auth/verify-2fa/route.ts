import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { verifyTotpCode } from '@/lib/crypto-totp';

export async function POST(req: NextRequest) {
  try {
    const { code, isEnabling } = await req.json();
    const settings = db.getSettings();

    const secret = settings.twoFactorSecret;
    if (!secret) {
      return NextResponse.json({ error: 'Chưa khởi tạo khóa bí mật 2FA' }, { status: 400 });
    }

    const isValid = verifyTotpCode(secret, code);
    if (!isValid) {
      return NextResponse.json({ error: 'Mã OTP 6 chữ số không hợp lệ hoặc đã hết hạn' }, { status: 400 });
    }

    // If verifying to enable 2FA for the first time
    if (isEnabling || !settings.twoFactorEnabled) {
      db.updateSettings({ twoFactorEnabled: true });
    }

    const sessionToken = db.createSessionToken();
    const res = NextResponse.json({
      success: true,
      twoFactorEnabled: true,
      message: 'Xác thực 2 lớp thành công!',
    });

    res.cookies.set('shun_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400 * 30,
    });

    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi xác minh 2FA: ' + String(error) }, { status: 500 });
  }
}
