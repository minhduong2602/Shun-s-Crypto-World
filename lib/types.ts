export type ChainType = 'ETH' | 'BSC' | 'POLYGON' | 'ARBITRUM' | 'BASE' | 'SOL' | 'BTC';

export interface UserSettings {
  id: string;
  hasPassword: boolean;
  passwordHash?: string;
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  telegramChatId?: string;
  telegramBotToken?: string;
  telegramAlertsEnabled: boolean;
  baseCurrency: 'USD' | 'VND' | 'EUR';
  updatedAt: string;
}

export interface WalletToken {
  id: string;
  symbol: string;
  name: string;
  balance: number;
  balanceUsd: number;
  priceUsd: number;
  priceAvailable?: boolean;
  change24h?: number;
  contractAddress?: string;
  isNative: boolean;
  decimals: number;
  icon?: string;
  chain: ChainType;
  allocationPercentage?: number;
}

export interface Wallet {
  id: string;
  chain: ChainType;
  address: string;
  label: string;
  isActive: boolean;
  lastSyncedAt?: string;
  balanceUsd: number;
  nativeBalance: number;
  nativeSymbol: string;
  tokensCount: number;
  unpricedAssetsCount?: number;
  tokens?: WalletToken[];
  createdAt: string;
}

export type TransactionType = 'BUY' | 'SELL' | 'TRANSFER_IN' | 'TRANSFER_OUT';

export interface Transaction {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  type: TransactionType;
  amount: number;
  pricePerCoin: number;
  totalAmount: number;
  fee: number;
  walletId?: string;
  txHash?: string;
  executedAt: string;
  notes?: string;
  createdAt: string;
}

export interface Holding {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  amount: number;
  avgBuyPrice: number;
  totalInvested: number;
  currentPrice: number | null;
  currentValue: number | null;
  priceChange24h: number | null;
  priceAvailable?: boolean;
  unrealizedPnL: number | null;
  unrealizedPnLPercentage: number | null;
  allocationPercentage: number;
  sparkline7d: number[];
  notes?: string;
  updatedAt: string;
}

export interface PortfolioSummary {
  totalValueUsd: number;
  totalInvestedUsd: number;
  totalProfitLossUsd: number | null;
  realizedProfitLossUsd: number;
  totalProfitLossPercentage: number | null;
  change24hUsd: number | null;
  change24hPercentage: number | null;
  holdingsCount: number;
  unpricedHoldingsCount?: number;
  isValuationComplete?: boolean;
  bestPerformer?: {
    symbol: string;
    gainPercentage: number;
  };
  worstPerformer?: {
    symbol: string;
    gainPercentage: number;
  };
}

export type AlertCondition = 'ABOVE' | 'BELOW' | 'PCT_UP_24H' | 'PCT_DOWN_24H';

export interface PriceAlert {
  id: string;
  coinId: string;
  symbol: string;
  condition: AlertCondition;
  targetValue: number;
  currentValueAtCreation: number;
  isActive: boolean;
  isRecurring: boolean;
  triggeredAt?: string;
  lastNotificationStatus?: 'SUCCESS' | 'FAILED' | 'PENDING';
  createdAt: string;
  walletAssetId?: string;
  chain?: ChainType;
  assetAddress?: string;
}

export interface MarketTicker {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  priceUsd: number;
  priceChange1h: number | null;
  priceChange24h: number;
  priceChange7d: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number;
  circulatingSupply: number | null;
  sparkline7d: number[];
  high24h: number;
  low24h: number;
}

export interface OHLCVPoint {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AiRecommendation {
  id: string;
  summary: string;
  riskScore: number; // 1-100
  marketSentiment: 'EXTREME_GREED' | 'GREED' | 'NEUTRAL' | 'FEAR' | 'EXTREME_FEAR';
  rebalanceSuggestions: {
    symbol: string;
    action: 'ACCUMULATE' | 'TAKE_PROFIT' | 'HOLD' | 'REDUCE';
    targetAllocationPct: number;
    currentAllocationPct: number;
    reasoning: string;
  }[];
  portfolioStrengths: string[];
  riskWarnings: string[];
  macroInsight: string;
  createdAt: string;
}
