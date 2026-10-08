import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: '2FA được quản lý trong Supabase Auth; endpoint cũ đã ngừng hỗ trợ.' }, { status: 410 });
}
