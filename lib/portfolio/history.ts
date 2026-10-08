import type { SupabaseClient } from '@supabase/supabase-js';

export type PortfolioSnapshot = {
  date: string;
  totalValueUsd: number;
  change24hUsd: number | null;
};

type SnapshotRow = {
  snapshot_date: string;
  total_value_usd: number | string;
  change_24h_usd: number | string | null;
};

export async function getPortfolioHistory(
  client: SupabaseClient,
  ownerId: string,
  days: number,
  now = new Date(),
): Promise<PortfolioSnapshot[]> {
  const startDate = new Date(now);
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() - Math.max(0, days - 1));

  const { data, error } = await client.from('portfolio_snapshots')
    .select('snapshot_date, total_value_usd, change_24h_usd')
    .eq('owner_id', ownerId)
    .gte('snapshot_date', startDate.toISOString().slice(0, 10))
    .order('snapshot_date', { ascending: true });
  if (error) throw error;

  return ((data ?? []) as SnapshotRow[]).flatMap((row) => {
    const totalValueUsd = Number(row.total_value_usd);
    const change24hUsd = row.change_24h_usd === null ? null : Number(row.change_24h_usd);
    if (!Number.isFinite(totalValueUsd) || (change24hUsd !== null && !Number.isFinite(change24hUsd))) return [];
    return [{ date: row.snapshot_date, totalValueUsd, change24hUsd }];
  });
}
