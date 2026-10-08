import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicEnv } from '@/lib/config/env';

export async function getServerSupabase() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot mutate cookies; middleware refreshes sessions instead.
        }
      },
    },
  });
}
