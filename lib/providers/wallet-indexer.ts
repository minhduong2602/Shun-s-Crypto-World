import type { ChainType } from '@/lib/types';

export interface IndexedWalletAsset { chain: ChainType; assetAddress: string; isNative: boolean; symbol: string; name: string; decimals: number; rawBalance: string; priceUsd?: number; priceChange24h?: number }
export interface WalletScanRequest { chain: ChainType; address: string }
export interface WalletIndexer { scan(request: WalletScanRequest): Promise<IndexedWalletAsset[]> }
