import { describe, expect, it, vi } from 'vitest';
import { getPortfolioHistory } from '@/lib/portfolio/history';

describe('getPortfolioHistory', () => {
  it('returns the signed-in owner snapshots in date order within the selected range', async () => {
    const calls: unknown[][] = [];
    const query = {
      select: vi.fn((...args: unknown[]) => { calls.push(['select', ...args]); return query; }),
      eq: vi.fn((...args: unknown[]) => { calls.push(['eq', ...args]); return query; }),
      gte: vi.fn((...args: unknown[]) => { calls.push(['gte', ...args]); return query; }),
      order: vi.fn((...args: unknown[]) => { calls.push(['order', ...args]); return query; }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({
        data: [
          { snapshot_date: '2026-10-03', total_value_usd: '100.25', change_24h_usd: '2.5' },
          { snapshot_date: '2026-10-05', total_value_usd: '112', change_24h_usd: null },
          { snapshot_date: '2026-10-09', total_value_usd: '120', change_24h_usd: '4' },
        ],
        error: null,
      }).then(resolve),
    };
    const client = { from: vi.fn(() => query) };

    const snapshots = await getPortfolioHistory(client as never, 'owner-7', 7, new Date('2026-10-09T12:00:00.000Z'));

    expect(client.from).toHaveBeenCalledWith('portfolio_snapshots');
    expect(calls).toContainEqual(['eq', 'owner_id', 'owner-7']);
    expect(calls).toContainEqual(['gte', 'snapshot_date', '2026-10-03']);
    expect(snapshots).toEqual([
      { date: '2026-10-03', totalValueUsd: 100.25, change24hUsd: 2.5 },
      { date: '2026-10-05', totalValueUsd: 112, change24hUsd: null },
      { date: '2026-10-09', totalValueUsd: 120, change24hUsd: 4 },
    ]);
  });
});
