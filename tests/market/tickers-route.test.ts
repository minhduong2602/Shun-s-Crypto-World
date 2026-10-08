import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserMock, getServerSupabaseMock, getLiveTickersMock, getCoinGeckoUsdVndRateMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getServerSupabaseMock: vi.fn(),
  getLiveTickersMock: vi.fn(),
  getCoinGeckoUsdVndRateMock: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/auth/require-user')>(),
  requireUser: requireUserMock,
}));
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: getServerSupabaseMock }));
vi.mock('@/lib/market-service', () => ({ getLiveTickers: getLiveTickersMock }));
vi.mock('@/lib/market/coingecko-currency', () => ({ getCoinGeckoUsdVndRate: getCoinGeckoUsdVndRateMock }));

import { GET } from '@/app/api/market/tickers/route';

describe('GET /api/market/tickers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: 'owner-1' });
    getLiveTickersMock.mockResolvedValue([]);
    getCoinGeckoUsdVndRateMock.mockResolvedValue({ rate: 26_000, updatedAt: 1_760_000_000 });
    const query = { select: vi.fn(), eq: vi.fn(), then: undefined };
    query.select.mockReturnValue(query);
    query.eq.mockResolvedValue({ data: [], error: null });
    getServerSupabaseMock.mockResolvedValue({ from: () => query });
  });

  it('returns the current CoinGecko-derived USD/VND rate with the market payload', async () => {
    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({
      usdVndRate: 26_000,
      usdVndRateUpdatedAt: '2025-10-09T08:53:20.000Z',
    });
  });
});
