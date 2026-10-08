import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '@/lib/auth/require-user';

const { requireUserMock, getServerSupabaseMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getServerSupabaseMock: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/require-user')>()),
  requireUser: requireUserMock,
}));
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: getServerSupabaseMock }));

import { DELETE, GET } from '@/app/api/wallets/route';
import { DELETE as deleteWalletById } from '@/app/api/wallets/[id]/route';

describe('/api/wallets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: 'owner-1' });
  });

  it('returns 401 instead of 500 when the wallet list is requested without a session', async () => {
    requireUserMock.mockRejectedValue(new UnauthorizedError());

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it('returns 404 when the requested wallet does not belong to the user or no longer exists', async () => {
    const query = Object.assign(Promise.resolve({ data: null, error: null }), {
      eq: () => query,
      select: () => query,
      maybeSingle: async () => ({ data: null, error: null }),
    });
    getServerSupabaseMock.mockResolvedValue({ from: () => ({ delete: () => query }) });

    const response = await DELETE(new Request('http://localhost/api/wallets?id=missing-wallet') as never);

    expect(response.status).toBe(404);
  });

  it('returns 404 when deleting a missing wallet through its dynamic route', async () => {
    const query = Object.assign(Promise.resolve({ data: null, error: null }), {
      eq: () => query,
      select: () => query,
      maybeSingle: async () => ({ data: null, error: null }),
    });
    getServerSupabaseMock.mockResolvedValue({ from: () => ({ delete: () => query }) });

    const response = await deleteWalletById(new Request('http://localhost/api/wallets/missing-wallet') as never, {
      params: Promise.resolve({ id: 'missing-wallet' }),
    });

    expect(response.status).toBe(404);
  });
});
