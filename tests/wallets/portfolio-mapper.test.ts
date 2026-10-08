import { describe, expect, it } from 'vitest';
import { mapIndexedAssetsToWalletTokens } from '@/lib/wallets/portfolio-mapper';

describe('mapIndexedAssetsToWalletTokens', () => {
  it('keeps the exact raw balance while calculating a usable decimal balance and allocation', () => {
    const tokens = mapIndexedAssetsToWalletTokens([
      {
        chain: 'ETH', assetAddress: 'native', isNative: true, symbol: 'ETH', name: 'Ethereum',
        decimals: 18, rawBalance: '2500000000000000000', priceUsd: 2000, priceChange24h: 1.2,
      },
      {
        chain: 'ETH', assetAddress: '0xa0b8', isNative: false, symbol: 'USDC', name: 'USD Coin',
        decimals: 6, rawBalance: '5000000', priceUsd: 1, priceChange24h: 0,
      },
    ]);

    expect(tokens).toEqual([
      expect.objectContaining({ symbol: 'ETH', balance: 2.5, balanceUsd: 5000, allocationPercentage: 99.9 }),
      expect.objectContaining({ symbol: 'USDC', balance: 5, balanceUsd: 5, allocationPercentage: 0.1 }),
    ]);
  });
});
