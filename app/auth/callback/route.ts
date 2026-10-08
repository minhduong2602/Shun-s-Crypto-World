import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { safeAuthRedirect } from '@/lib/auth/redirect';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeAuthRedirect(url.searchParams.get('next'));
  if (!code) return NextResponse.redirect(new URL('/login?error=auth', url.origin));
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/login?error=auth', url.origin));
  return NextResponse.redirect(new URL(next, url.origin));
}
