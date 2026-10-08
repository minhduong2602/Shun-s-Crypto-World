import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserMock, getServerSupabaseMock, listTransactionsMock, insertSingleMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getServerSupabaseMock: vi.fn(),
  listTransactionsMock: vi.fn(),
  insertSingleMock: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/auth/require-user')>(),
  requireUser: requireUserMock,
}));
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: getServerSupabaseMock }));
vi.mock('@/lib/portfolio/repository', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/portfolio/repository')>(),
  listTransactions: listTransactionsMock,
}));

import { POST } from '@/app/api/portfolio/transactions/route';

describe('POST /api/portfolio/transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: 'owner-1' });
    listTransactionsMock.mockResolvedValue([{
      id: 'buy-1', coinId: 'btc', symbol: 'BTC', name: 'Bitcoin', type: 'BUY', amount: 1,
      pricePerCoin: 10, totalAmount: 10, fee: 0,
      executedAt: '2026-10-08T00:00:00.000Z', createdAt: '2026-10-08T00:00:00.000Z',
    }]);
    insertSingleMock.mockResolvedValue({ data: null, error: {
      code: '23514', message: 'Transaction would make chronological asset balance negative.',
    } });
    getServerSupabaseMock.mockResolvedValue({
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single: insertSingleMock })),
        })),
      })),
    });
  });

  it('returns a conflict when the database rejects an oversell after the pre-check', async () => {
    const request = new Request('http://localhost/api/portfolio/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: 'BTC', type: 'SELL', amount: 1, pricePerCoin: 10 }),
    }) as never;

    const response = await POST(request);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/balance|số dư/i) });
  });
});
