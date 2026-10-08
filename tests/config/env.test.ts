import { describe, expect, it } from 'vitest';
import { getPublicEnv, getServerEnv } from '@/lib/config/env';

const fullEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  GOLDRUSH_API_KEY: 'goldrush-key',
  TELEGRAM_BOT_TOKEN: 'telegram-token',
  CRON_SHARED_SECRET: 'cron-secret',
};

describe('environment configuration', () => {
  it('rejects a missing service-role secret', () => {
    expect(() =>
      getServerEnv({
        NEXT_PUBLIC_SUPABASE_URL: fullEnv.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: fullEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      })
    ).toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('does not expose server-only secrets through public configuration', () => {
    expect(getPublicEnv(fullEnv)).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    });
  });
});
