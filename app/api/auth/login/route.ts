import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Endpoint đã ngừng hỗ trợ. Hãy đăng nhập bằng Supabase Auth.' }, { status: 410 });
}
