import { describe, expect, it, vi } from 'vitest';
import { hasCronAuthorization, runWalletSyncBatch } from '@/lib/wallets/wallet-sync-cron';

describe('wallet sync cron helpers', () => {
  it('requires a configured secret and an exact bearer token', () => {
    expect(hasCronAuthorization(new Request('https://example.test', { headers: { authorization: 'Bearer secret' } }), undefined)).toBe(false);
    expect(hasCronAuthorization(new Request('https://example.test'), 'secret')).toBe(false);
    expect(hasCronAuthorization(new Request('https://example.test', { headers: { authorization: 'Bearer wrong' } }), 'secret')).toBe(false);
    expect(hasCronAuthorization(new Request('https://example.test', { headers: { authorization: 'Bearer secret' } }), 'secret')).toBe(true);
  });

  it('processes sequentially, continues after failures, and reports each result', async () => {
    const order: string[] = [];
    const wait = vi.fn(async () => undefined);
    const results = await runWalletSyncBatch(
      [{ id: 'wallet-1' }, { id: 'wallet-2' }, { id: 'wallet-3' }],
      async (wallet) => {
        order.push(wallet.id);
        if (wallet.id === 'wallet-2') throw new Error('indexer unavailable');
      },
      100,
      wait,
    );

    expect(order).toEqual(['wallet-1', 'wallet-2', 'wallet-3']);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(results).toEqual([
      { walletId: 'wallet-1', status: 'success' },
      { walletId: 'wallet-2', status: 'failed', error: 'indexer unavailable' },
      { walletId: 'wallet-3', status: 'success' },
    ]);
  });
});
