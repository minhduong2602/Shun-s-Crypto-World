import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/config/env';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getLiveHoldings, summarizeHoldings } from '@/lib/portfolio/repository';
import { runPortfolioSnapshotBatch } from '@/lib/portfolio/snapshot-cron';
import { hasCronAuthorization } from '@/lib/wallets/wallet-sync-cron';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  let secret: string | undefined;
  try {
    secret = getServerEnv().CRON_SHARED_SECRET;
  } catch {
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 });
  }
  if (!hasCronAuthorization(request, secret)) {
    return NextResponse.json({ error: secret ? 'Unauthorized' : 'Cron is not configured' }, { status: secret ? 401 : 503 });
  }

  try {
    const supabase = getAdminSupabase();
    const { data: ownerRows, error: ownersError } = await supabase.rpc('list_portfolio_snapshot_owners');
    if (ownersError) throw ownersError;
    const ownerIds = ((ownerRows ?? []) as string[]).map((ownerId: string) => String(ownerId));

    const result = await runPortfolioSnapshotBatch(
      ownerIds,
      async (ownerId) => summarizeHoldings(await getLiveHoldings(supabase, ownerId)),
      async (ownerId, totalValueUsd, change24hUsd) => {
        const { error } = await supabase.rpc('record_daily_snapshot', {
          p_owner_id: ownerId,
          p_total_value_usd: totalValueUsd,
          p_change_24h_usd: change24hUsd,
        });
        if (error) throw error;
      },
    );

    return NextResponse.json({ owners: ownerIds.length, ...result });
  } catch (error) {
    console.error('Portfolio snapshot cron failed:', error);
    return NextResponse.json({ error: 'Portfolio snapshots could not be recorded' }, { status: 500 });
  }
}
