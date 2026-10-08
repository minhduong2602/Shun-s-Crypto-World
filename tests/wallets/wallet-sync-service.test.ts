import { describe, expect, it, vi } from 'vitest';
import { syncWalletAssets } from '@/lib/wallets/wallet-sync-service';

describe('syncWalletAssets', () => {
  it('marks prior assets inactive, upserts the full scan, then updates wallet summary', async () => {
    const calls: Array<{ table: string; method: string; payload?: unknown }> = [];
    const client = {
      from(table: string) {
        const query = {
          insert(payload: unknown) { calls.push({ table, method: 'insert', payload }); return Promise.resolve({ error: null }); },
          update(payload: unknown) { calls.push({ table, method: 'update', payload }); return { eq: () => Promise.resolve({ error: null }) }; },
          upsert(payload: unknown) { calls.push({ table, method: 'upsert', payload }); return Promise.resolve({ error: null }); },
        };
        return query;
      },
    };
    const indexer = {
      scan: vi.fn().mockResolvedValue([
        { chain: 'ETH', assetAddress: 'native', isNative: true, symbol: 'ETH', name: 'Ethereum', decimals: 18, rawBalance: '1000000000000000000', priceUsd: 2500 },
      ]),
    };

    const result = await syncWalletAssets({
      client,
      indexer,
      ownerId: 'owner-1',
      wallet: { id: 'wallet-1', chain: 'ETH', address: '0xabc' },
    });

    expect(result).toMatchObject({ tokensCount: 1, balanceUsd: 2500, nativeBalance: 1 });
    expect(calls.map((call) => `${call.table}:${call.method}`)).toEqual([
      'wallet_sync_runs:insert',
      'wallet_assets:update',
      'wallet_assets:upsert',
      'wallets:update',
      'wallet_sync_runs:update',
    ]);
  });
});
