import type { ChainType } from '@/lib/types';

export const NATIVE_ASSET_ADDRESS = 'native';

export interface AssetIdentity {
  chain: ChainType;
  assetAddress: string;
  isNative: boolean;
}

export function normalizeAssetIdentity(input: {
  chain: ChainType;
  assetAddress?: string | null;
  isNative?: boolean;
}): AssetIdentity {
  if (input.isNative) {
    return { chain: input.chain, assetAddress: NATIVE_ASSET_ADDRESS, isNative: true };
  }

  const assetAddress = input.assetAddress?.trim();
  if (!assetAddress) {
    throw new Error('A non-native asset requires a contract or mint address');
  }

  return {
    chain: input.chain,
    assetAddress: input.chain === 'SOL' ? assetAddress : assetAddress.toLowerCase(),
    isNative: false,
  };
}

export function assetIdentityKey(identity: AssetIdentity) {
  return `${identity.chain}:${identity.assetAddress}`;
}
