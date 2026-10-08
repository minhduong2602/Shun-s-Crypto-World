import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  return NextResponse.json({ isAuthenticated: Boolean(data.user), user: data.user ? { email: data.user.email } : null });
}
