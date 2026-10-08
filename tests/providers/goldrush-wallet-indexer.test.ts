import { describe, expect, it, vi } from 'vitest';
import { GoldRushWalletIndexer } from '@/lib/providers/goldrush-wallet-indexer';

describe('GoldRushWalletIndexer', () => {
  it('follows pagination and keeps only non-zero fungible assets', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          items: [
            { contract_address: '0xAAA', contract_ticker_symbol: 'AAA', contract_name: 'Alpha', contract_decimals: 18, balance: '2500000000000000000', type: 'cryptocurrency' },
            { contract_address: '0xZERO', contract_ticker_symbol: 'ZERO', contract_name: 'Zero', contract_decimals: 18, balance: '0', type: 'cryptocurrency' },
          ],
          pagination: { has_more: true, page_number: 0 },
        },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          items: [
            { contract_address: '0xBBB', contract_ticker_symbol: 'BBB', contract_name: 'Beta', contract_decimals: 6, balance: '4200000', type: 'cryptocurrency' },
            { contract_address: '0xNFT', contract_ticker_symbol: 'NFT', contract_name: 'Artwork', contract_decimals: 0, balance: '1', type: 'nft' },
          ],
          pagination: { has_more: false, page_number: 1 },
        },
      })));
    const indexer = new GoldRushWalletIndexer({ apiKey: 'test-key', fetcher });

    const result = await indexer.scan({ chain: 'ETH', address: '0xWallet' });

    expect(result).toEqual([
      expect.objectContaining({ assetAddress: '0xaaa', symbol: 'AAA', rawBalance: '2500000000000000000' }),
      expect.objectContaining({ assetAddress: '0xbbb', symbol: 'BBB', rawBalance: '4200000' }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
