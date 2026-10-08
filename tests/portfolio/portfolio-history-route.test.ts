import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserMock, getServerSupabaseMock, getPortfolioHistoryMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getServerSupabaseMock: vi.fn(),
  getPortfolioHistoryMock: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/auth/require-user')>(),
  requireUser: requireUserMock,
}));
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: getServerSupabaseMock }));
vi.mock('@/lib/portfolio/history', () => ({ getPortfolioHistory: getPortfolioHistoryMock }));

import { GET } from '@/app/api/portfolio/history/route';

describe('portfolio history route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: 'owner-1' });
    getServerSupabaseMock.mockResolvedValue({});
    getPortfolioHistoryMock.mockResolvedValue([{ date: '2026-10-09', totalValueUsd: 100, change24hUsd: 3 }]);
  });

  it('returns only an authenticated user range of portfolio snapshots', async () => {
    const response = await GET(new Request('http://localhost/api/portfolio/history?range=30d'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ snapshots: [{ date: '2026-10-09', totalValueUsd: 100, change24hUsd: 3 }] });
    expect(getPortfolioHistoryMock).toHaveBeenCalledWith({}, 'owner-1', 30);
  });

  it('rejects unsupported ranges instead of widening the query', async () => {
    const response = await GET(new Request('http://localhost/api/portfolio/history?range=all'));

    expect(response.status).toBe(400);
    expect(getPortfolioHistoryMock).not.toHaveBeenCalled();
  });

  it('rejects inherited object property names as ranges', async () => {
    const response = await GET(new Request('http://localhost/api/portfolio/history?range=toString'));

    expect(response.status).toBe(400);
    expect(getPortfolioHistoryMock).not.toHaveBeenCalled();
  });
});
