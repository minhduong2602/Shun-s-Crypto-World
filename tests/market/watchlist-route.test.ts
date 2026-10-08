import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '@/lib/auth/require-user';

const { requireUserMock, getServerSupabaseMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getServerSupabaseMock: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/auth/require-user')>(),
  requireUser: requireUserMock,
}));
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: getServerSupabaseMock }));

import { GET } from '@/app/api/market/watchlist/route';

describe('GET /api/market/watchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: 'owner-1' });
  });

  it('returns 401 for an expired session', async () => {
    requireUserMock.mockRejectedValue(new UnauthorizedError());

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it('identifies a missing watchlist migration instead of returning an opaque 500', async () => {
    const query = { select: vi.fn(), eq: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockResolvedValue({ data: null, error: { code: 'PGRST205', message: 'Could not find the table in schema cache' } });
    getServerSupabaseMock.mockResolvedValue({ from: () => query });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: 'WATCHLIST_SCHEMA_NOT_READY' });
  });

  it('identifies a missing authenticated table grant', async () => {
    const query = { select: vi.fn(), eq: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied for table market_watchlist' } });
    getServerSupabaseMock.mockResolvedValue({ from: () => query });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: 'WATCHLIST_PERMISSION_DENIED' });
  });
});
