import type { ChainType } from '@/lib/types';
import { normalizeAssetIdentity } from '@/lib/domain/asset-identity';

export interface IndexedWalletAsset {
  chain: ChainType;
  assetAddress: string;
  isNative: boolean;
  symbol: string;
  name: string;
  decimals: number;
  rawBalance: string;
  priceUsd?: number;
  priceChange24h?: number;
}

export interface WalletScanRequest {
  chain: ChainType;
  address: string;
}

export interface WalletIndexer {
  scan(request: WalletScanRequest): Promise<IndexedWalletAsset[]>;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const CHAIN_SLUG: Record<ChainType, string> = {
  ETH: 'eth-mainnet',
  BSC: 'bsc-mainnet',
  POLYGON: 'matic-mainnet',
  ARBITRUM: 'arbitrum-mainnet',
  SOL: 'solana-mainnet',
  BTC: 'btc-mainnet',
};

interface GoldRushItem {
  contract_address?: string;
  contract_ticker_symbol?: string;
  contract_name?: string;
  contract_decimals?: number;
  balance?: string;
  type?: string;
  is_spam?: boolean;
  quote_rate?: number;
  quote_rate_24h?: number;
}

interface GoldRushPage {
  data?: {
    items?: GoldRushItem[];
    pagination?: { has_more?: boolean };
  };
}

export class GoldRushWalletIndexer implements WalletIndexer {
  private readonly apiKey: string;
  private readonly fetcher: Fetcher;

  constructor({ apiKey, fetcher = fetch }: { apiKey: string; fetcher?: Fetcher }) {
    if (!apiKey) throw new Error('GOLDRUSH_API_KEY is required for wallet scans');
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  async scan({ chain, address }: WalletScanRequest): Promise<IndexedWalletAsset[]> {
    const assets: IndexedWalletAsset[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(`https://api.covalenthq.com/v1/${CHAIN_SLUG[chain]}/address/${address}/balances_v2/`);
      url.searchParams.set('page-size', '100');
      url.searchParams.set('page-number', String(page));
      url.searchParams.set('no-nft-fetch', 'true');

      const response = await this.fetcher(url, { headers: { Authorization: `Bearer ${this.apiKey}` } });
      if (!response.ok) throw new Error(`GoldRush wallet scan failed with HTTP ${response.status}`);
      const payload = (await response.json()) as GoldRushPage;

      for (const item of payload.data?.items ?? []) {
        if (item.type === 'nft' || item.is_spam || !item.balance || BigInt(item.balance) === 0n) continue;
        const isNative = !item.contract_address || item.contract_address === '0x0000000000000000000000000000000000000000';
        const identity = normalizeAssetIdentity({ chain, assetAddress: item.contract_address, isNative });
        assets.push({
          chain,
          assetAddress: identity.assetAddress,
          isNative,
          symbol: item.contract_ticker_symbol || (isNative ? chain : 'UNKNOWN'),
          name: item.contract_name || item.contract_ticker_symbol || 'Unknown token',
          decimals: item.contract_decimals ?? 0,
          rawBalance: item.balance,
          priceUsd: typeof item.quote_rate === 'number' && item.quote_rate >= 0 ? item.quote_rate : undefined,
          priceChange24h: typeof item.quote_rate === 'number' && typeof item.quote_rate_24h === 'number' && item.quote_rate_24h > 0
            ? Number((((item.quote_rate - item.quote_rate_24h) / item.quote_rate_24h) * 100).toFixed(4))
            : undefined,
        });
      }

      hasMore = Boolean(payload.data?.pagination?.has_more);
      page += 1;
    }

    return assets;
  }
}
