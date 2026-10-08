import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('shun_session')?.value;
  if (token) {
    db.revokeSession(token);
  }

  const res = NextResponse.json({ success: true, message: 'Đã đăng xuất an toàn' });
  res.cookies.set('shun_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
