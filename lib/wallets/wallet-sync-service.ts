import type { ChainType, Wallet, WalletToken } from '@/lib/types';
import type { WalletIndexer } from '@/lib/providers/wallet-indexer';
import { mapIndexedAssetsToWalletTokens, totalWalletValue } from '@/lib/wallets/portfolio-mapper';

type QueryResult = { error: { message: string } | null };

interface UpdateQuery extends PromiseLike<QueryResult> {
  eq(column: string, value: string): UpdateQuery;
  not(column: string, operator: string, value: string): UpdateQuery;
}

interface WalletDatabaseClient {
  from(table: string): {
    insert(payload: unknown): Promise<QueryResult>;
    upsert(payload: unknown, options?: unknown): Promise<QueryResult>;
    update(payload: unknown): UpdateQuery;
  };
}

export interface SyncableWallet {
  id: string;
  chain: ChainType;
  address: string;
}

function assertNoDatabaseError(result: QueryResult) {
  if (result.error) throw new Error(result.error.message);
}

function postgrestInFilter(values: string[]) {
  return `(${values.map((value) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')})`;
}

export async function syncWalletAssets({
  client,
  indexer,
  ownerId,
  wallet,
}: {
  client: WalletDatabaseClient;
  indexer: WalletIndexer;
  ownerId: string;
  wallet: SyncableWallet;
}): Promise<Pick<Wallet, 'balanceUsd' | 'nativeBalance' | 'nativeSymbol' | 'tokensCount' | 'tokens'>> {
  const startedAt = new Date().toISOString();
  const syncRunId = crypto.randomUUID();
  const run = await client.from('wallet_sync_runs').insert({
    id: syncRunId,
    owner_id: ownerId,
    wallet_id: wallet.id,
    status: 'running',
    provider: 'public-indexers',
    started_at: startedAt,
  });
  assertNoDatabaseError(run);

  try {
    const indexedAssets = await indexer.scan({ chain: wallet.chain, address: wallet.address });
    const tokens = mapIndexedAssetsToWalletTokens(indexedAssets);
    const totalValue = totalWalletValue(tokens);
    const native = tokens.find((asset) => asset.isNative);
    const tokensById = new Map(tokens.map((token) => [token.id, token]));
    const timestamp = new Date().toISOString();

    if (indexedAssets.length > 0) {
      const assets = indexedAssets.map((asset) => {
        const token = tokensById.get(`${asset.chain}:${asset.assetAddress}`);
        return {
        owner_id: ownerId,
        wallet_id: wallet.id,
        chain: asset.chain,
        asset_address: asset.assetAddress,
        asset_address_normalized: asset.chain === 'SOL' ? asset.assetAddress : asset.assetAddress.toLowerCase(),
        is_native: asset.isNative,
        symbol: asset.symbol,
        name: asset.name,
        decimals: asset.decimals,
        raw_balance: asset.rawBalance,
        balance: token?.balance ?? 0,
        price_usd: asset.priceUsd ?? null,
        price_change_24h: asset.priceChange24h ?? null,
        balance_usd: token?.balanceUsd ?? 0,
        price_updated_at: asset.priceUsd === undefined ? null : timestamp,
        synced_at: timestamp,
        is_active: true,
        };
      });
      assertNoDatabaseError(await client.from('wallet_assets').upsert(assets, { onConflict: 'wallet_id,chain,asset_address_normalized' }));
    }
    // Keep the last known-good snapshot active unless the replacement batch has been stored.
    const scannedAddresses = [...new Set(indexedAssets.map((asset) =>
      asset.chain === 'SOL' ? asset.assetAddress : asset.assetAddress.toLowerCase(),
    ))];
    let staleAssetsQuery = client.from('wallet_assets').update({ is_active: false }).eq('wallet_id', wallet.id);
    if (scannedAddresses.length > 0) {
      staleAssetsQuery = staleAssetsQuery.not('asset_address_normalized', 'in', postgrestInFilter(scannedAddresses));
    }
    assertNoDatabaseError(await staleAssetsQuery);

    assertNoDatabaseError(await client.from('wallets').update({
      native_balance: native?.balance ?? 0,
      native_symbol: native?.symbol ?? wallet.chain,
      balance_usd: totalValue,
      asset_count: tokens.length,
      last_synced_at: timestamp,
    }).eq('id', wallet.id));
    assertNoDatabaseError(await client.from('wallet_sync_runs').update({
      status: 'success', asset_count: tokens.length, completed_at: timestamp,
    }).eq('id', syncRunId));

    return {
      balanceUsd: totalValue,
      nativeBalance: native?.balance ?? 0,
      nativeSymbol: native?.symbol ?? wallet.chain,
      tokensCount: tokens.length,
      tokens,
    };
  } catch (error) {
    await client.from('wallet_sync_runs').update({
      status: 'failed',
      error_message: error instanceof Error ? error.message : String(error),
      completed_at: new Date().toISOString(),
    }).eq('id', syncRunId);
    throw error;
  }
}

export type { WalletDatabaseClient };
