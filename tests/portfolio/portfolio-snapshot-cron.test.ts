import { describe, expect, it, vi } from 'vitest';
import { runPortfolioSnapshotBatch } from '@/lib/portfolio/snapshot-cron';
import type { PortfolioSummary } from '@/lib/types';

const completeSummary: PortfolioSummary = {
  totalValueUsd: 125.5, totalInvestedUsd: 100, totalProfitLossUsd: 25.5, realizedProfitLossUsd: 0,
  totalProfitLossPercentage: 25.5, change24hUsd: 5, change24hPercentage: 4,
  holdingsCount: 2, unpricedHoldingsCount: 0, isValuationComplete: true,
};

describe('runPortfolioSnapshotBatch', () => {
  it('records only fully priced portfolios and does not lose other users on failure', async () => {
    const record = vi.fn(async () => undefined);
    const result = await runPortfolioSnapshotBatch(
      ['priced-user', 'partial-user', 'error-user'],
      async (ownerId) => {
        if (ownerId === 'error-user') throw new Error('market unavailable');
        return ownerId === 'priced-user'
          ? completeSummary
          : { ...completeSummary, isValuationComplete: false, unpricedHoldingsCount: 1 };
      },
      record,
    );

    expect(result).toEqual({ recorded: 1, skippedIncomplete: 1, failed: 1 });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith('priced-user', 125.5, 5);
  });

  it('records portfolio value while preserving an unavailable 24-hour change as null', async () => {
    const record = vi.fn(async () => undefined);

    const result = await runPortfolioSnapshotBatch(
      ['user-without-24h-change'],
      async () => ({ ...completeSummary, change24hUsd: null }),
      record,
    );

    expect(result).toEqual({ recorded: 1, skippedIncomplete: 0, failed: 0 });
    expect(record).toHaveBeenCalledWith('user-without-24h-change', 125.5, null);
  });
});
