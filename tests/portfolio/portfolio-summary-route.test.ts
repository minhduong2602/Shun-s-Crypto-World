import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserMock, getServerSupabaseMock, getLivePortfolioMock, summarizeHoldingsMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getServerSupabaseMock: vi.fn(),
  getLivePortfolioMock: vi.fn(),
  summarizeHoldingsMock: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/auth/require-user')>(),
  requireUser: requireUserMock,
}));
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: getServerSupabaseMock }));
vi.mock('@/lib/portfolio/repository', () => ({
  getLivePortfolio: getLivePortfolioMock,
  summarizeHoldings: summarizeHoldingsMock,
}));

import { GET } from '@/app/api/portfolio/summary/route';

describe('GET /api/portfolio/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: 'owner-1' });
    getServerSupabaseMock.mockResolvedValue({});
    getLivePortfolioMock.mockResolvedValue({ holdings: [], realizedProfitLossUsd: 17 });
    summarizeHoldingsMock.mockReturnValue({
      totalValueUsd: 0, totalInvestedUsd: 0, totalProfitLossUsd: 0, realizedProfitLossUsd: 17,
      totalProfitLossPercentage: 0, change24hUsd: 0, change24hPercentage: 0, holdingsCount: 0,
    });
  });

  it('returns realized PnL computed from the authenticated user ledger', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(summarizeHoldingsMock).toHaveBeenCalledWith([], 17);
    await expect(response.json()).resolves.toMatchObject({ summary: { realizedProfitLossUsd: 17 } });
  });

  it('returns live holdings with the summary so the dashboard can reuse the same portfolio snapshot', async () => {
    const holdings = [{
      id: 'h-btc', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', amount: 1,
      avgBuyPrice: 90, totalInvested: 90, currentPrice: 100, currentValue: 100,
      priceChange24h: 1, priceAvailable: true, unrealizedPnL: 10,
      unrealizedPnLPercentage: 11.11, allocationPercentage: 100,
      sparkline7d: [], updatedAt: '2026-10-01T00:00:00.000Z',
    }];
    getLivePortfolioMock.mockResolvedValue({ holdings, realizedProfitLossUsd: 17 });

    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({ holdings });
  });

  it('returns the ledger alongside the live portfolio so polling does not load transactions twice', async () => {
    const transactions = [{ id: 'tx-newest', symbol: 'BTC', executedAt: '2026-10-09T00:00:00.000Z' }];
    getLivePortfolioMock.mockResolvedValue({ holdings: [], realizedProfitLossUsd: 0, transactions });

    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({ transactions });
  });
});
