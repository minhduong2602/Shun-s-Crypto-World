import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserMock, getServerSupabaseMock, listTransactionsMock, insertMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getServerSupabaseMock: vi.fn(),
  listTransactionsMock: vi.fn(),
  insertMock: vi.fn(),
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

import { POST } from '@/app/api/portfolio/transactions/import/route';

const header = 'Executed At,Type,Symbol,Name,Amount,Unit Price USD,Fee USD,Total USD,Wallet ID,Transaction Hash,Notes';

function request(csv: string, mode: 'preview' | 'import' = 'preview') {
  return new Request('http://localhost/api/portfolio/transactions/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv, mode }),
  }) as never;
}

describe('POST /api/portfolio/transactions/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: 'owner-1' });
    listTransactionsMock.mockResolvedValue([]);
    insertMock.mockResolvedValue({ error: null });
    getServerSupabaseMock.mockResolvedValue({
      from: vi.fn(() => ({ insert: insertMock })),
    });
  });

  it('previews duplicates without writing rows', async () => {
    listTransactionsMock.mockResolvedValue([{
      id: 'existing', coinId: 'btc', symbol: 'BTC', name: 'Bitcoin', type: 'BUY',
      amount: 1, pricePerCoin: 100, totalAmount: 100, fee: 0, txHash: '0xabc',
      executedAt: '2026-01-02T03:04:05.000Z', createdAt: '2026-01-02T03:04:05.000Z',
    }]);

    const response = await POST(request(`${header}\n2026-01-02T03:04:05.000Z,BUY,BTC,Bitcoin,1,100,0,100,,0xABC,`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ canImport: false, duplicateCount: 1, rows: [] });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('rejects an import that would oversell before writing any transaction', async () => {
    listTransactionsMock.mockResolvedValue([{
      id: 'buy', coinId: 'btc', symbol: 'BTC', name: 'Bitcoin', type: 'BUY',
      amount: 1, pricePerCoin: 100, totalAmount: 100, fee: 0,
      executedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z',
    }]);

    const response = await POST(request(`${header}\n2026-01-02T03:04:05.000Z,SELL,BTC,Bitcoin,2,110,0,220,,,`, 'import'));

    expect(response.status).toBe(409);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('commits valid rows as one owner-scoped insert', async () => {
    const csv = `${header}\n2026-01-02T03:04:05.000Z,BUY,ETH,Ethereum,0.5,2000,2,1002,,,DCA`;

    const response = await POST(request(csv, 'import'));

    expect(response.status).toBe(201);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith([expect.objectContaining({
      owner_id: 'owner-1', symbol: 'ETH', amount: 0.5,
      price_per_coin: 2000, fee: 2, total_amount: 1002,
    })]);
  });

  it('does not query malformed wallet IDs from an edited CSV', async () => {
    const response = await POST(request(`${header}\n2026-01-02T03:04:05.000Z,BUY,ETH,Ethereum,0.5,2000,2,1002,not-a-uuid,,DCA`));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.canImport).toBe(true);
    expect(body.rows[0].walletId).toBeUndefined();
    expect(body.warnings).toMatchObject([{ line: 2 }]);
  });
});
