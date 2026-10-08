import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const settings = db.getSettings();

    // In single-user mode, default master password is "shun123"
    if (password !== (settings.passwordHash || 'shun123')) {
      return NextResponse.json({ error: 'Mật khẩu quản trị không chính xác' }, { status: 401 });
    }

    // If 2FA is enabled, user must complete TOTP step next
    if (settings.twoFactorEnabled) {
      return NextResponse.json({
        requires2FA: true,
        message: 'Yêu cầu mã xác thực 2 lớp (Google Authenticator / TOTP)',
      });
    }

    const sessionToken = db.createSessionToken();
    const res = NextResponse.json({
      success: true,
      requires2FA: false,
      message: 'Đăng nhập thành công vào Shun\'s Crypto World',
    });

    res.cookies.set('shun_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400 * 30, // 30 days
    });

    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi xử lý đăng nhập: ' + String(error) }, { status: 500 });
  }
}
