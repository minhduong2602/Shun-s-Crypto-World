import { describe, expect, it } from 'vitest';
import { safeAuthRedirect } from '@/lib/auth/redirect';

describe('safeAuthRedirect', () => {
  it('keeps only a local path after Supabase authentication', () => {
    expect(safeAuthRedirect('/wallets')).toBe('/wallets');
    expect(safeAuthRedirect('https://malicious.example')).toBe('/');
  });
});
