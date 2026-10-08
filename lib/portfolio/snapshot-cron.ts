import type { PortfolioSummary } from '@/lib/types';

export type PortfolioSnapshotBatchResult = {
  recorded: number;
  skippedIncomplete: number;
  failed: number;
};

export async function runPortfolioSnapshotBatch(
  ownerIds: string[],
  loadSummary: (ownerId: string) => Promise<PortfolioSummary>,
  record: (ownerId: string, totalValueUsd: number, change24hUsd: number | null) => Promise<void>,
): Promise<PortfolioSnapshotBatchResult> {
  const result: PortfolioSnapshotBatchResult = { recorded: 0, skippedIncomplete: 0, failed: 0 };
  for (const ownerId of [...new Set(ownerIds)]) {
    try {
      const summary = await loadSummary(ownerId);
      if (summary.isValuationComplete !== true) {
        result.skippedIncomplete += 1;
        continue;
      }
      await record(ownerId, summary.totalValueUsd, summary.change24hUsd);
      result.recorded += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}
