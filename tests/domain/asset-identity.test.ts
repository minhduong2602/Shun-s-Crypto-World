import { describe, expect, it } from 'vitest';
import { assetIdentityKey, normalizeAssetIdentity } from '@/lib/domain/asset-identity';

describe('asset identity', () => {
  it('uses the chain and normalized address so assets with the same symbol stay distinct', () => {
    expect(
      assetIdentityKey(normalizeAssetIdentity({ chain: 'ETH', assetAddress: '0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48' }))
    ).toBe('ETH:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
    expect(
      assetIdentityKey(normalizeAssetIdentity({ chain: 'SOL', assetAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }))
    ).toBe('SOL:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  });

  it('uses a deterministic native asset sentinel for every chain', () => {
    expect(normalizeAssetIdentity({ chain: 'BTC', isNative: true })).toEqual({
      chain: 'BTC',
      assetAddress: 'native',
      isNative: true,
    });
  });
});
