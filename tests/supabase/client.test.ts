import { afterEach, describe, expect, it, vi } from 'vitest';
import { getClientPublicEnv } from '@/lib/supabase/client';

describe('Supabase browser configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads the two public Supabase variables for the browser client', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    expect(getClientPublicEnv()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    });
  });
});
