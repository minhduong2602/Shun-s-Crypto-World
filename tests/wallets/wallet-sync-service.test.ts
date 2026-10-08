import { describe, expect, it, vi } from 'vitest';
import { syncWalletAssets } from '@/lib/wallets/wallet-sync-service';

describe('syncWalletAssets', () => {
  it('upserts the full scan before marking missing prior assets inactive', async () => {
    const calls: Array<{ table: string; method: string; payload?: unknown }> = [];
    const staleFilter = vi.fn();
    const client = {
      from(table: string) {
        const query = {
          insert(payload: unknown) { calls.push({ table, method: 'insert', payload }); return Promise.resolve({ error: null }); },
          update(payload: unknown) {
            calls.push({ table, method: 'update', payload });
            const filter = Object.assign(Promise.resolve({ error: null }), {
              eq() { return filter; },
              not(...args: string[]) { staleFilter(...args); return filter; },
            });
            return filter;
          },
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
      'wallet_assets:upsert',
      'wallet_assets:update',
      'wallets:update',
      'wallet_sync_runs:update',
    ]);
    expect(staleFilter).toHaveBeenCalledWith('asset_address_normalized', 'in', '("native")');
  });

  it('keeps previously active wallet assets active when the replacement upsert fails', async () => {
    const calls: Array<{ table: string; method: string; payload?: unknown }> = [];
    const client = {
      from(table: string) {
        return {
          insert(payload: unknown) { calls.push({ table, method: 'insert', payload }); return Promise.resolve({ error: null }); },
          update(payload: unknown) {
            calls.push({ table, method: 'update', payload });
            const filter = Object.assign(Promise.resolve({ error: null }), {
              eq() { return filter; },
              not() { return filter; },
            });
            return filter;
          },
          upsert(payload: unknown) { calls.push({ table, method: 'upsert', payload }); return Promise.resolve({ error: { message: 'temporary database failure' } }); },
        };
      },
    };
    const indexer = {
      scan: vi.fn().mockResolvedValue([
        { chain: 'ETH', assetAddress: 'native', isNative: true, symbol: 'ETH', name: 'Ethereum', decimals: 18, rawBalance: '1000000000000000000', priceUsd: 2500 },
      ]),
    };

    await expect(syncWalletAssets({
      client,
      indexer,
      ownerId: 'owner-1',
      wallet: { id: 'wallet-1', chain: 'ETH', address: '0xabc' },
    })).rejects.toThrow('temporary database failure');

    expect(calls.some((call) => call.table === 'wallet_assets' && call.method === 'update')).toBe(false);
  });

  it('preserves the last known wallet assets when a provider scan fails', async () => {
    const calls: Array<{ table: string; method: string; payload?: unknown }> = [];
    const client = {
      from(table: string) {
        return {
          insert(payload: unknown) { calls.push({ table, method: 'insert', payload }); return Promise.resolve({ error: null }); },
          update(payload: unknown) {
            calls.push({ table, method: 'update', payload });
            const query = Object.assign(Promise.resolve({ error: null }), { eq() { return query; }, not() { return query; } });
            return query;
          },
          upsert(payload: unknown) { calls.push({ table, method: 'upsert', payload }); return Promise.resolve({ error: null }); },
        };
      },
    };
    const indexer = { scan: vi.fn().mockRejectedValue(new Error('Routescan repeated a pagination cursor.')) };

    await expect(syncWalletAssets({
      client,
      indexer,
      ownerId: 'owner-1',
      wallet: { id: 'wallet-1', chain: 'BSC', address: '0xabc' },
    })).rejects.toThrow('Routescan repeated a pagination cursor');

    expect(calls.some((call) => call.table === 'wallet_assets')).toBe(false);
    expect(calls.at(-1)).toMatchObject({
      table: 'wallet_sync_runs',
      method: 'update',
      payload: expect.objectContaining({ status: 'failed', error_message: 'Routescan repeated a pagination cursor.' }),
    });
  });
});
