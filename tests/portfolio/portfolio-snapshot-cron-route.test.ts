import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerEnvMock, getAdminSupabaseMock, getLiveHoldingsMock, summarizeHoldingsMock, rpcMock } = vi.hoisted(() => ({
  getServerEnvMock: vi.fn(),
  getAdminSupabaseMock: vi.fn(),
  getLiveHoldingsMock: vi.fn(),
  summarizeHoldingsMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/lib/config/env', () => ({ getServerEnv: getServerEnvMock }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminSupabase: getAdminSupabaseMock }));
vi.mock('@/lib/portfolio/repository', () => ({
  getLiveHoldings: getLiveHoldingsMock,
  summarizeHoldings: summarizeHoldingsMock,
}));

import { GET } from '@/app/api/cron/portfolio-snapshots/route';

describe('portfolio snapshot cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnvMock.mockReturnValue({ CRON_SHARED_SECRET: 'cron-secret' });
    getLiveHoldingsMock.mockResolvedValue([]);
    summarizeHoldingsMock.mockReturnValue({ totalValueUsd: 100, change24hUsd: 2, isValuationComplete: true });
    rpcMock.mockImplementation(async (name: string) => name === 'list_portfolio_snapshot_owners'
      ? { data: ['owner-1'], error: null }
      : { data: null, error: null });
    getAdminSupabaseMock.mockReturnValue({ rpc: rpcMock });
  });

  it('rejects requests without the cron bearer secret before touching Supabase', async () => {
    const response = await GET(new Request('http://localhost/api/cron/portfolio-snapshots'));

    expect(response.status).toBe(401);
    expect(getAdminSupabaseMock).not.toHaveBeenCalled();
  });

  it('uses the service-side owner list and writes a complete daily snapshot', async () => {
    const request = new Request('http://localhost/api/cron/portfolio-snapshots', {
      headers: { Authorization: 'Bearer cron-secret' },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ owners: 1, recorded: 1, skippedIncomplete: 0, failed: 0 });
    expect(rpcMock).toHaveBeenCalledWith('list_portfolio_snapshot_owners');
    expect(rpcMock).toHaveBeenCalledWith('record_daily_snapshot', {
      p_owner_id: 'owner-1', p_total_value_usd: 100, p_change_24h_usd: 2,
    });
  });
});
