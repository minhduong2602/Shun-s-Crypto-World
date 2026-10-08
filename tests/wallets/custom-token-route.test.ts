import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserMock, getServerSupabaseMock, syncWalletAssetsMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getServerSupabaseMock: vi.fn(),
  syncWalletAssetsMock: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/require-user')>()),
  requireUser: requireUserMock,
}));
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: getServerSupabaseMock }));
vi.mock('@/lib/wallets/wallet-repository', () => ({
  mapWalletRow: () => ({ id: 'wallet-1', chain: 'SOL', address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', tokens: [] }),
}));
vi.mock('@/lib/wallets/wallet-sync-service', () => ({ syncWalletAssets: syncWalletAssetsMock }));

import { POST } from '@/app/api/wallets/[id]/route';

describe('POST /api/wallets/[id] custom token scan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: 'owner-1' });
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: { id: 'wallet-1' }, error: null }),
    };
    getServerSupabaseMock.mockResolvedValue({ from: () => query });
  });

  it('matches case-sensitive Solana mint addresses after sync', async () => {
    const mint = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
    syncWalletAssetsMock.mockResolvedValue({ tokens: [{ contractAddress: mint }] });

    const response = await POST(
      new Request('http://localhost/api/wallets/wallet-1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: mint }),
      }) as never,
      { params: Promise.resolve({ id: 'wallet-1' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });
});
