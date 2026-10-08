import { describe, expect, it, vi } from 'vitest';
import { PublicWalletIndexer } from '@/lib/providers/public-wallet-indexer';

describe('PublicWalletIndexer', () => {
  it('returns every non-zero SPL token account from a public RPC response', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { value: [{ account: { data: { parsed: { info: { mint: 'MintA', tokenAmount: { amount: '42', decimals: 6, uiAmountString: '0.000042' } } } } } }] } })));
    const assets = await new PublicWalletIndexer(fetcher).scan({ chain: 'SOL', address: 'wallet' });
    expect(assets).toEqual([expect.objectContaining({ assetAddress: 'MintA', rawBalance: '42', decimals: 6 })]);
  });
});
