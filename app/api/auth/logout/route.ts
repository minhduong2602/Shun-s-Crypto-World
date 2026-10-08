import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, message: 'Đã đăng xuất an toàn' });
}
