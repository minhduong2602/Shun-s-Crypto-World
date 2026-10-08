import type { ChainType, Wallet, WalletToken } from '@/lib/types';

type AssetRow = Record<string, unknown>;
type WalletRow = Record<string, unknown> & { wallet_assets?: AssetRow[] | null };

function asNumber(value: unknown) {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

export function normalizeWalletAddress(chain: ChainType, address: string) {
  const trimmed = address.trim();
  return ['ETH', 'BSC', 'POLYGON', 'ARBITRUM', 'BTC'].includes(chain) ? trimmed.toLowerCase() : trimmed;
}

function mapAsset(row: AssetRow): WalletToken {
  return {
    id: String(row.id),
    chain: String(row.chain) as ChainType,
    symbol: String(row.symbol),
    name: String(row.name),
    balance: asNumber(row.balance),
    balanceUsd: asNumber(row.balance_usd),
    priceUsd: asNumber(row.price_usd),
    change24h: row.price_change_24h === null ? undefined : asNumber(row.price_change_24h),
    contractAddress: row.is_native ? undefined : String(row.asset_address),
    isNative: Boolean(row.is_native),
    decimals: asNumber(row.decimals),
  };
}

export function mapWalletRow(row: WalletRow): Wallet {
  const tokens = (row.wallet_assets ?? [])
    .filter((asset) => asset.is_active !== false)
    .map(mapAsset)
    .sort((left, right) => right.balanceUsd - left.balanceUsd);

  const total = tokens.reduce((sum, token) => sum + token.balanceUsd, 0);
  return {
    id: String(row.id),
    chain: String(row.chain) as ChainType,
    address: String(row.address),
    label: String(row.label),
    isActive: Boolean(row.is_active),
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : undefined,
    balanceUsd: asNumber(row.balance_usd),
    nativeBalance: asNumber(row.native_balance),
    nativeSymbol: String(row.native_symbol),
    tokensCount: asNumber(row.asset_count),
    tokens: tokens.map((token) => ({
      ...token,
      allocationPercentage: total > 0 ? Number(((token.balanceUsd / total) * 100).toFixed(1)) : 0,
    })),
    createdAt: String(row.created_at),
  };
}
