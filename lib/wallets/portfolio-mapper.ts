import type { IndexedWalletAsset } from '@/lib/providers/wallet-indexer';
import type { WalletToken } from '@/lib/types';

export type PricedIndexedWalletAsset = IndexedWalletAsset & {
  priceUsd?: number;
  priceChange24h?: number;
};

function decimalBalance(rawBalance: string, decimals: number) {
  const raw = BigInt(rawBalance);
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = (raw % divisor).toString().padStart(decimals, '0').slice(0, 12).replace(/0+$/, '');
  return Number(fraction ? `${whole}.${fraction}` : whole);
}

export function mapIndexedAssetsToWalletTokens(assets: PricedIndexedWalletAsset[]): WalletToken[] {
  const mapped = assets.map((asset) => {
    const balance = decimalBalance(asset.rawBalance, asset.decimals);
    const priceUsd = asset.priceUsd ?? 0;
    return {
      id: `${asset.chain}:${asset.assetAddress}`,
      symbol: asset.symbol,
      name: asset.name,
      balance,
      balanceUsd: Number((balance * priceUsd).toFixed(8)),
      priceUsd,
      priceAvailable: asset.priceUsd !== undefined,
      change24h: asset.priceChange24h,
      contractAddress: asset.isNative ? undefined : asset.assetAddress,
      isNative: asset.isNative,
      decimals: asset.decimals,
      chain: asset.chain,
    } satisfies WalletToken;
  });
  const total = mapped.reduce((sum, asset) => sum + asset.balanceUsd, 0);

  return mapped
    .map((asset) => ({
      ...asset,
      allocationPercentage: total > 0 ? Number(((asset.balanceUsd / total) * 100).toFixed(1)) : 0,
    }))
    .sort((left, right) => right.balanceUsd - left.balanceUsd);
}

export function totalWalletValue(tokens: WalletToken[]) {
  return Number(tokens.reduce((sum, asset) => sum + asset.balanceUsd, 0).toFixed(8));
}
