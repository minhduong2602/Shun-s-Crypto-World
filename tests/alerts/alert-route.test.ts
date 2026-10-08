import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerSupabaseMock, requireUserMock } = vi.hoisted(() => ({
  getServerSupabaseMock: vi.fn(),
  requireUserMock: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/auth/require-user')>(),
  requireUser: requireUserMock,
}));
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: getServerSupabaseMock }));
vi.mock('@/lib/config/env', () => ({ getServerEnv: () => ({ TELEGRAM_BOT_TOKEN: 'server-token' }) }));

import { POST } from '@/app/api/alerts/route';

describe('POST /api/alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: 'user-1' });
  });

  it('binds a wallet-asset alert to an active asset owned by the signed-in user', async () => {
    const walletAsset = {
      id: 'asset-1', owner_id: 'user-1', chain: 'BASE', asset_address_normalized: '0xtoken',
      symbol: 'TOK', is_active: true,
    };
    const insert = vi.fn((row) => ({
      select: () => ({ single: async () => ({ data: { id: 'alert-1', ...row, created_at: '2026-10-09T00:00:00.000Z' }, error: null }) }),
    }));
    const assetLookup = {
      select: () => ({
        eq: (_column: string, value: string) => ({
          eq: (_secondColumn: string, secondValue: string) => ({
            eq: (_thirdColumn: string, thirdValue: boolean) => ({ maybeSingle: async () => ({ data: value === 'asset-1' && secondValue === 'user-1' && thirdValue ? walletAsset : null, error: null }) }),
          }),
        }),
      }),
    };
    getServerSupabaseMock.mockResolvedValue({
      from: (table: string) => table === 'wallet_assets' ? assetLookup : { insert },
    });

    const request = new Request('http://localhost/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAssetId: 'asset-1', condition: 'ABOVE', targetValue: 2, isRecurring: true }),
    });
    const response = await POST(request as never);

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: 'user-1', wallet_asset_id: 'asset-1', chain: 'BASE',
      asset_address_normalized: '0xtoken', symbol: 'TOK',
    }));
  });

  it('rejects a wallet asset that is not owned by the signed-in user', async () => {
    getServerSupabaseMock.mockResolvedValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }),
    });
    const request = new Request('http://localhost/api/alerts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAssetId: 'foreign-asset', condition: 'ABOVE', targetValue: 2 }),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(404);
  });
});
