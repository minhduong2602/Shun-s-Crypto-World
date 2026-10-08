import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/config/env';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { PublicWalletIndexer } from '@/lib/providers/public-wallet-indexer';
import { syncWalletAssets, type SyncableWallet, type WalletDatabaseClient } from '@/lib/wallets/wallet-sync-service';
import { hasCronAuthorization, runWalletSyncBatch } from '@/lib/wallets/wallet-sync-cron';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH_SIZE = 5;
const RECENT_FAILURE_COOLDOWN_MS = 60 * 60 * 1000;

export async function GET(request: Request) {
  const secret = getServerEnv().CRON_SHARED_SECRET;
  if (!hasCronAuthorization(request, secret)) {
    return NextResponse.json({ error: secret ? 'Unauthorized' : 'Cron is not configured' }, { status: secret ? 401 : 503 });
  }

  const supabase = getAdminSupabase();
  const { data: claimed, error: lockError } = await supabase.rpc('claim_wallet_sync_cron_lock');
  if (lockError) {
    console.error('Could not acquire wallet sync cron lock:', lockError.message);
    return NextResponse.json({ error: 'Wallet sync lock unavailable' }, { status: 503 });
  }
  if (!claimed) return NextResponse.json({ skipped: true, reason: 'another_sync_batch_is_running' });

  try {
    const { data: candidates, error: walletsError } = await supabase
      .from('wallets')
      .select('id, owner_id, chain, address')
      .eq('is_active', true)
      .order('last_synced_at', { ascending: true, nullsFirst: true })
      .limit(500);
    if (walletsError) throw walletsError;

    const wallets = (candidates ?? []) as Array<SyncableWallet & { owner_id: string }>;
    if (!wallets.length) return NextResponse.json({ selected: 0, succeeded: 0, failed: 0 });

    const retryCutoff = new Date(Date.now() - RECENT_FAILURE_COOLDOWN_MS).toISOString();
    const { data: recentRuns, error: runsError } = await supabase
      .from('wallet_sync_runs')
      .select('wallet_id')
      .in('wallet_id', wallets.map((wallet) => wallet.id))
      .in('status', ['failed', 'running'])
      .gte('started_at', retryCutoff);
    if (runsError) throw runsError;

    const coolingDown = new Set((recentRuns ?? []).map((run) => String(run.wallet_id)));
    const batch = wallets.filter((wallet) => !coolingDown.has(wallet.id)).slice(0, BATCH_SIZE);
    const results = await runWalletSyncBatch(
      batch,
      (wallet) => syncWalletAssets({
        client: supabase as unknown as WalletDatabaseClient,
        indexer: new PublicWalletIndexer(),
        ownerId: wallet.owner_id,
        wallet,
      }),
      1_000,
    );

    const succeeded = results.filter((result) => result.status === 'success').length;
    const failed = results.length - succeeded;
    return NextResponse.json({ selected: batch.length, succeeded, failed, skippedRecentlyFailed: coolingDown.size });
  } catch (error) {
    console.error('Wallet sync cron failed:', error);
    return NextResponse.json({ error: 'Wallet sync batch failed' }, { status: 500 });
  } finally {
    const { error } = await supabase.rpc('release_wallet_sync_cron_lock');
    if (error) console.error('Could not release wallet sync cron lock:', error.message);
  }
}
