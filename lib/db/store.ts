import {
  UserSettings,
  Wallet,
  Transaction,
  Holding,
  PortfolioSummary,
  PriceAlert,
  MarketTicker,
  AiRecommendation,
} from '../types';

// In-memory persistent database singleton for Next.js runtime
declare global {
  var __SHUN_DB__: {
    settings: UserSettings;
    wallets: Wallet[];
    transactions: Transaction[];
    alerts: PriceAlert[];
    aiAnalyses: AiRecommendation[];
    sessionTokens: Set<string>;
  } | undefined;
}

// Initial default market price seeds (reflective of current live markets)
export const DEFAULT_PRICES: Record<string, { price: number; change24h: number; change7d: number; symbol: string; name: string }> = {
  bitcoin: { price: 91450.0, change24h: 2.45, change7d: 5.12, symbol: 'BTC', name: 'Bitcoin' },
  ethereum: { price: 3420.5, change24h: -0.85, change7d: 3.20, symbol: 'ETH', name: 'Ethereum' },
  solana: { price: 184.2, change24h: 4.12, change7d: 12.4, symbol: 'SOL', name: 'Solana' },
  binancecoin: { price: 625.8, change24h: 1.15, change7d: 2.1, symbol: 'BNB', name: 'BNB' },
  sui: { price: 3.15, change24h: 6.80, change7d: 18.5, symbol: 'SUI', name: 'Sui' },
  ripple: { price: 2.35, change24h: 1.45, change7d: -1.2, symbol: 'XRP', name: 'XRP' },
  cardano: { price: 0.78, change24h: -1.10, change7d: 4.5, symbol: 'ADA', name: 'Cardano' },
  avalanche: { price: 28.4, change24h: 3.10, change7d: 6.2, symbol: 'AVAX', name: 'Avalanche' },
  dogecoin: { price: 0.22, change24h: 2.90, change7d: -3.4, symbol: 'DOGE', name: 'Dogecoin' },
  near: { price: 5.45, change24h: 4.80, change7d: 9.3, symbol: 'NEAR', name: 'NEAR Protocol' },
  chainlink: { price: 16.8, change24h: 0.75, change7d: 4.8, symbol: 'LINK', name: 'Chainlink' },
  render: { price: 6.95, change24h: 5.20, change7d: 14.1, symbol: 'RENDER', name: 'Render' },
};

function generateSparkline(basePrice: number, change24h: number, points = 24): number[] {
  const result: number[] = [];
  let curr = basePrice * (1 - change24h / 100);
  const step = (basePrice - curr) / points;
  for (let i = 0; i < points; i++) {
    const jitter = (Math.random() - 0.48) * (basePrice * 0.012);
    curr = Math.max(basePrice * 0.7, curr + step + jitter);
    result.push(Number(curr.toFixed(2)));
  }
  result[result.length - 1] = basePrice;
  return result;
}

function initializeDatabase() {
  if (global.__SHUN_DB__) {
    return global.__SHUN_DB__;
  }

  const defaultTransactions: Transaction[] = [
    {
      id: 'tx-1',
      coinId: 'bitcoin',
      symbol: 'BTC',
      name: 'Bitcoin',
      type: 'BUY',
      amount: 0.85,
      pricePerCoin: 68200,
      totalAmount: 57970,
      fee: 15,
      executedAt: new Date(Date.now() - 45 * 86400000).toISOString(),
      notes: 'DCA Bitcoin trước chu kỳ tăng',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-2',
      coinId: 'ethereum',
      symbol: 'ETH',
      name: 'Ethereum',
      type: 'BUY',
      amount: 4.5,
      pricePerCoin: 2850,
      totalAmount: 12825,
      fee: 8,
      executedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      notes: 'Staking & DeFi pool',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-3',
      coinId: 'solana',
      symbol: 'SOL',
      name: 'Solana',
      type: 'BUY',
      amount: 40,
      pricePerCoin: 135,
      totalAmount: 5400,
      fee: 2,
      executedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      notes: 'Hệ sinh thái Solana & Memecoin liquidity',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-4',
      coinId: 'sui',
      symbol: 'SUI',
      name: 'Sui',
      type: 'BUY',
      amount: 1500,
      pricePerCoin: 1.85,
      totalAmount: 2775,
      fee: 1,
      executedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
      notes: 'Move ecosystem growth play',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-5',
      coinId: 'binancecoin',
      symbol: 'BNB',
      name: 'BNB',
      type: 'BUY',
      amount: 10,
      pricePerCoin: 540,
      totalAmount: 5400,
      fee: 5,
      executedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      notes: 'Launchpool & fee discount',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-6',
      coinId: 'render',
      symbol: 'RENDER',
      name: 'Render',
      type: 'BUY',
      amount: 250,
      pricePerCoin: 5.2,
      totalAmount: 1300,
      fee: 1,
      executedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      notes: 'AI compute narrative',
      createdAt: new Date().toISOString(),
    },
  ];

  const defaultWallets: Wallet[] = [
    {
      id: 'w-1',
      chain: 'ETH',
      address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      label: 'Ví Lạnh Ledger Hardware',
      isActive: true,
      lastSyncedAt: new Date().toISOString(),
      balanceUsd: 15420.5,
      nativeBalance: 4.5,
      nativeSymbol: 'ETH',
      tokensCount: 6,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'w-2',
      chain: 'SOL',
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      label: 'Ví Phantom DeFi Watcher',
      isActive: true,
      lastSyncedAt: new Date().toISOString(),
      balanceUsd: 7368.0,
      nativeBalance: 40.0,
      nativeSymbol: 'SOL',
      tokensCount: 4,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'w-3',
      chain: 'BTC',
      address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      label: 'Ví Bitcoin Cold Vault',
      isActive: true,
      lastSyncedAt: new Date().toISOString(),
      balanceUsd: 77732.5,
      nativeBalance: 0.85,
      nativeSymbol: 'BTC',
      tokensCount: 1,
      createdAt: new Date().toISOString(),
    },
  ];

  const defaultAlerts: PriceAlert[] = [
    {
      id: 'alt-1',
      coinId: 'bitcoin',
      symbol: 'BTC',
      condition: 'ABOVE',
      targetValue: 95000,
      currentValueAtCreation: 91450,
      isActive: true,
      isRecurring: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'alt-2',
      coinId: 'ethereum',
      symbol: 'ETH',
      condition: 'ABOVE',
      targetValue: 3600,
      currentValueAtCreation: 3420.5,
      isActive: true,
      isRecurring: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'alt-3',
      coinId: 'solana',
      symbol: 'SOL',
      condition: 'PCT_UP_24H',
      targetValue: 8.0,
      currentValueAtCreation: 4.12,
      isActive: true,
      isRecurring: true,
      createdAt: new Date().toISOString(),
    },
  ];

  global.__SHUN_DB__ = {
    settings: {
      id: 'shun-admin',
      hasPassword: true,
      // Default master password "shun123" for single-user dev environment
      passwordHash: 'shun123',
      twoFactorSecret: undefined,
      twoFactorEnabled: false,
      telegramChatId: '',
      telegramBotToken: '',
      telegramAlertsEnabled: false,
      baseCurrency: 'USD',
      updatedAt: new Date().toISOString(),
    },
    wallets: defaultWallets,
    transactions: defaultTransactions,
    alerts: defaultAlerts,
    aiAnalyses: [],
    sessionTokens: new Set<string>(['dev-session-token']),
  };

  return global.__SHUN_DB__;
}

import { getLivePriceForSymbol } from '../market-service';

export const db = {
  getSettings(): UserSettings {
    const state = initializeDatabase();
    return { ...state.settings };
  },

  updateSettings(partial: Partial<UserSettings>): UserSettings {
    const state = initializeDatabase();
    state.settings = {
      ...state.settings,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    return { ...state.settings };
  },

  verifySession(token: string): boolean {
    const state = initializeDatabase();
    return state.sessionTokens.has(token);
  },

  createSessionToken(): string {
    const state = initializeDatabase();
    const token = 'shun_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    state.sessionTokens.add(token);
    return token;
  },

  revokeSession(token: string) {
    const state = initializeDatabase();
    state.sessionTokens.delete(token);
  },

  getWallets(): Wallet[] {
    const state = initializeDatabase();
    return [...state.wallets];
  },

  addWallet(wallet: Omit<Wallet, 'id' | 'createdAt' | 'balanceUsd' | 'nativeBalance' | 'nativeSymbol' | 'tokensCount'>): Wallet {
    const state = initializeDatabase();
    const nativeSymbolMap: Record<string, string> = {
      ETH: 'ETH',
      BSC: 'BNB',
      POLYGON: 'POL',
      ARBITRUM: 'ETH',
      SOL: 'SOL',
      BTC: 'BTC',
    };

    const nativeSymbol = nativeSymbolMap[wallet.chain] || 'ETH';
    const mockBalance = Number((Math.random() * 2 + 0.1).toFixed(4));
    const price = DEFAULT_PRICES[wallet.chain.toLowerCase()]?.price || 2500;

    const newWallet: Wallet = {
      id: 'w-' + Date.now().toString(36),
      ...wallet,
      balanceUsd: Number((mockBalance * price).toFixed(2)),
      nativeBalance: mockBalance,
      nativeSymbol,
      tokensCount: 3,
      createdAt: new Date().toISOString(),
    };

    state.wallets.unshift(newWallet);
    return newWallet;
  },

  removeWallet(id: string): boolean {
    const state = initializeDatabase();
    const prevLen = state.wallets.length;
    state.wallets = state.wallets.filter((w) => w.id !== id);
    return state.wallets.length < prevLen;
  },

  getTransactions(): Transaction[] {
    const state = initializeDatabase();
    return [...state.transactions].sort(
      (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
    );
  },

  addTransaction(tx: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
    const state = initializeDatabase();
    const newTx: Transaction = {
      ...tx,
      id: 'tx-' + Date.now().toString(36),
      createdAt: new Date().toISOString(),
    };
    state.transactions.unshift(newTx);
    return newTx;
  },

  deleteTransaction(id: string): boolean {
    const state = initializeDatabase();
    const prev = state.transactions.length;
    state.transactions = state.transactions.filter((t) => t.id !== id);
    return state.transactions.length < prev;
  },

  async getLiveHoldings(): Promise<Holding[]> {
    const state = initializeDatabase();
    const txs = state.transactions;

    // Group by symbol/coinId
    const map = new Map<string, {
      coinId: string;
      symbol: string;
      name: string;
      totalAmount: number;
      totalCost: number;
      latestNotes: string;
    }>();

    for (const tx of txs) {
      const key = tx.symbol.toUpperCase();
      const existing = map.get(key) || {
        coinId: tx.coinId,
        symbol: tx.symbol.toUpperCase(),
        name: tx.name,
        totalAmount: 0,
        totalCost: 0,
        latestNotes: tx.notes || '',
      };

      if (tx.type === 'BUY' || tx.type === 'TRANSFER_IN') {
        existing.totalAmount += tx.amount;
        existing.totalCost += tx.totalAmount;
      } else if (tx.type === 'SELL' || tx.type === 'TRANSFER_OUT') {
        const remaining = Math.max(0, existing.totalAmount - tx.amount);
        if (existing.totalAmount > 0) {
          const costReduction = (tx.amount / existing.totalAmount) * existing.totalCost;
          existing.totalCost = Math.max(0, existing.totalCost - costReduction);
        }
        existing.totalAmount = remaining;
      }

      map.set(key, existing);
    }

    const items = Array.from(map.values()).filter((item) => item.totalAmount > 0);

    // Fetch real live prices in parallel from Binance/market service
    const pricePromises = items.map(async (item) => {
      const live = await getLivePriceForSymbol(item.symbol);
      return { symbol: item.symbol, live };
    });

    const pricesArray = await Promise.all(pricePromises);
    const priceLookup = new Map(pricesArray.map((p) => [p.symbol, p.live]));

    const holdings: Holding[] = [];
    let grandTotalValue = 0;

    for (const item of items) {
      const liveData = priceLookup.get(item.symbol);
      const fallback = DEFAULT_PRICES[item.coinId.toLowerCase()] || {
        price: item.totalCost / item.totalAmount || 1.0,
        change24h: 0,
        symbol: item.symbol,
        name: item.name,
      };

      const currentPrice = liveData ? liveData.priceUsd : fallback.price;
      const change24h = liveData ? liveData.change24h : fallback.change24h;
      const currentValue = item.totalAmount * currentPrice;
      const avgBuyPrice = item.totalCost / item.totalAmount;
      const unrealizedPnL = currentValue - item.totalCost;
      const unrealizedPnLPercentage = item.totalCost > 0 ? (unrealizedPnL / item.totalCost) * 100 : 0;

      grandTotalValue += currentValue;

      holdings.push({
        id: `h-${item.symbol.toLowerCase()}`,
        coinId: item.coinId,
        symbol: item.symbol,
        name: liveData?.name || item.name,
        amount: Number(item.totalAmount.toFixed(6)),
        avgBuyPrice: Number(avgBuyPrice.toFixed(avgBuyPrice < 1 ? 6 : 4)),
        totalInvested: Number(item.totalCost.toFixed(2)),
        currentPrice: Number(currentPrice.toFixed(currentPrice < 1 ? 6 : 2)),
        currentValue: Number(currentValue.toFixed(2)),
        priceChange24h: Number(change24h.toFixed(2)),
        unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
        unrealizedPnLPercentage: Number(unrealizedPnLPercentage.toFixed(2)),
        allocationPercentage: 0,
        sparkline7d: generateSparkline(currentPrice, change24h),
        notes: item.latestNotes,
        updatedAt: new Date().toISOString(),
      });
    }

    return holdings
      .map((h) => ({
        ...h,
        allocationPercentage:
          grandTotalValue > 0 ? Number(((h.currentValue / grandTotalValue) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.currentValue - a.currentValue);
  },

  getHoldings(): Holding[] {
    const state = initializeDatabase();
    const txs = state.transactions;

    const map = new Map<string, {
      coinId: string;
      symbol: string;
      name: string;
      totalAmount: number;
      totalCost: number;
      latestNotes: string;
    }>();

    for (const tx of txs) {
      const key = tx.symbol.toUpperCase();
      const existing = map.get(key) || {
        coinId: tx.coinId,
        symbol: tx.symbol.toUpperCase(),
        name: tx.name,
        totalAmount: 0,
        totalCost: 0,
        latestNotes: tx.notes || '',
      };

      if (tx.type === 'BUY' || tx.type === 'TRANSFER_IN') {
        existing.totalAmount += tx.amount;
        existing.totalCost += tx.totalAmount;
      } else if (tx.type === 'SELL' || tx.type === 'TRANSFER_OUT') {
        const remaining = Math.max(0, existing.totalAmount - tx.amount);
        if (existing.totalAmount > 0) {
          const costReduction = (tx.amount / existing.totalAmount) * existing.totalCost;
          existing.totalCost = Math.max(0, existing.totalCost - costReduction);
        }
        existing.totalAmount = remaining;
      }

      map.set(key, existing);
    }

    const holdings: Holding[] = [];
    let grandTotalValue = 0;

    map.forEach((item) => {
      if (item.totalAmount <= 0) return;

      const priceInfo = DEFAULT_PRICES[item.coinId.toLowerCase()] || {
        price: item.totalCost / item.totalAmount || 1.0,
        change24h: 0,
        change7d: 0,
        symbol: item.symbol,
        name: item.name,
      };

      const currentPrice = priceInfo.price;
      const currentValue = item.totalAmount * currentPrice;
      const avgBuyPrice = item.totalCost / item.totalAmount;
      const unrealizedPnL = currentValue - item.totalCost;
      const unrealizedPnLPercentage = item.totalCost > 0 ? (unrealizedPnL / item.totalCost) * 100 : 0;

      grandTotalValue += currentValue;

      holdings.push({
        id: `h-${item.symbol.toLowerCase()}`,
        coinId: item.coinId,
        symbol: item.symbol,
        name: item.name,
        amount: Number(item.totalAmount.toFixed(6)),
        avgBuyPrice: Number(avgBuyPrice.toFixed(4)),
        totalInvested: Number(item.totalCost.toFixed(2)),
        currentPrice,
        currentValue: Number(currentValue.toFixed(2)),
        priceChange24h: priceInfo.change24h,
        unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
        unrealizedPnLPercentage: Number(unrealizedPnLPercentage.toFixed(2)),
        allocationPercentage: 0,
        sparkline7d: generateSparkline(currentPrice, priceInfo.change24h),
        notes: item.latestNotes,
        updatedAt: new Date().toISOString(),
      });
    });

    return holdings
      .map((h) => ({
        ...h,
        allocationPercentage:
          grandTotalValue > 0 ? Number(((h.currentValue / grandTotalValue) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.currentValue - a.currentValue);
  },

  async getLivePortfolioSummary(): Promise<PortfolioSummary> {
    const holdings = await this.getLiveHoldings();
    let totalValueUsd = 0;
    let totalInvestedUsd = 0;
    let change24hWeighted = 0;

    let bestGain = -Infinity;
    let worstGain = Infinity;
    let bestPerformer: { symbol: string; gainPercentage: number } | undefined;
    let worstPerformer: { symbol: string; gainPercentage: number } | undefined;

    for (const h of holdings) {
      totalValueUsd += h.currentValue;
      totalInvestedUsd += h.totalInvested;
      change24hWeighted += (h.currentValue * h.priceChange24h) / 100;

      if (h.unrealizedPnLPercentage > bestGain) {
        bestGain = h.unrealizedPnLPercentage;
        bestPerformer = { symbol: h.symbol, gainPercentage: h.unrealizedPnLPercentage };
      }
      if (h.unrealizedPnLPercentage < worstGain) {
        worstGain = h.unrealizedPnLPercentage;
        worstPerformer = { symbol: h.symbol, gainPercentage: h.unrealizedPnLPercentage };
      }
    }

    const totalProfitLossUsd = totalValueUsd - totalInvestedUsd;
    const totalProfitLossPercentage =
      totalInvestedUsd > 0 ? (totalProfitLossUsd / totalInvestedUsd) * 100 : 0;
    const change24hPercentage =
      totalValueUsd > 0 ? (change24hWeighted / totalValueUsd) * 100 : 0;

    return {
      totalValueUsd: Number(totalValueUsd.toFixed(2)),
      totalInvestedUsd: Number(totalInvestedUsd.toFixed(2)),
      totalProfitLossUsd: Number(totalProfitLossUsd.toFixed(2)),
      totalProfitLossPercentage: Number(totalProfitLossPercentage.toFixed(2)),
      change24hUsd: Number(change24hWeighted.toFixed(2)),
      change24hPercentage: Number(change24hPercentage.toFixed(2)),
      holdingsCount: holdings.length,
      bestPerformer,
      worstPerformer,
    };
  },

  getPortfolioSummary(): PortfolioSummary {
    const holdings = this.getHoldings();
    let totalValueUsd = 0;
    let totalInvestedUsd = 0;
    let change24hWeighted = 0;

    let bestGain = -Infinity;
    let worstGain = Infinity;
    let bestPerformer: { symbol: string; gainPercentage: number } | undefined;
    let worstPerformer: { symbol: string; gainPercentage: number } | undefined;

    for (const h of holdings) {
      totalValueUsd += h.currentValue;
      totalInvestedUsd += h.totalInvested;
      change24hWeighted += (h.currentValue * h.priceChange24h) / 100;

      if (h.unrealizedPnLPercentage > bestGain) {
        bestGain = h.unrealizedPnLPercentage;
        bestPerformer = { symbol: h.symbol, gainPercentage: h.unrealizedPnLPercentage };
      }
      if (h.unrealizedPnLPercentage < worstGain) {
        worstGain = h.unrealizedPnLPercentage;
        worstPerformer = { symbol: h.symbol, gainPercentage: h.unrealizedPnLPercentage };
      }
    }

    const totalProfitLossUsd = totalValueUsd - totalInvestedUsd;
    const totalProfitLossPercentage =
      totalInvestedUsd > 0 ? (totalProfitLossUsd / totalInvestedUsd) * 100 : 0;
    const change24hPercentage =
      totalValueUsd > 0 ? (change24hWeighted / totalValueUsd) * 100 : 0;

    return {
      totalValueUsd: Number(totalValueUsd.toFixed(2)),
      totalInvestedUsd: Number(totalInvestedUsd.toFixed(2)),
      totalProfitLossUsd: Number(totalProfitLossUsd.toFixed(2)),
      totalProfitLossPercentage: Number(totalProfitLossPercentage.toFixed(2)),
      change24hUsd: Number(change24hWeighted.toFixed(2)),
      change24hPercentage: Number(change24hPercentage.toFixed(2)),
      holdingsCount: holdings.length,
      bestPerformer,
      worstPerformer,
    };
  },

  getAlerts(): PriceAlert[] {
    const state = initializeDatabase();
    return [...state.alerts];
  },

  addAlert(alert: Omit<PriceAlert, 'id' | 'createdAt' | 'currentValueAtCreation'>): PriceAlert {
    const state = initializeDatabase();
    const currentPrice = DEFAULT_PRICES[alert.coinId]?.price || 100;
    const newAlert: PriceAlert = {
      ...alert,
      id: 'alt-' + Date.now().toString(36),
      currentValueAtCreation: currentPrice,
      createdAt: new Date().toISOString(),
    };
    state.alerts.unshift(newAlert);
    return newAlert;
  },

  deleteAlert(id: string): boolean {
    const state = initializeDatabase();
    const prev = state.alerts.length;
    state.alerts = state.alerts.filter((a) => a.id !== id);
    return state.alerts.length < prev;
  },

  toggleAlert(id: string): PriceAlert | null {
    const state = initializeDatabase();
    const alert = state.alerts.find((a) => a.id === id);
    if (!alert) return null;
    alert.isActive = !alert.isActive;
    return { ...alert };
  },

  getMarketTickers(): MarketTicker[] {
    let rank = 1;
    const tickers: MarketTicker[] = [];

    for (const [id, item] of Object.entries(DEFAULT_PRICES)) {
      const high24h = item.price * 1.04;
      const low24h = item.price * 0.96;
      const volume = item.price * (item.symbol === 'BTC' ? 350000 : 1500000);
      const cap = item.price * (item.symbol === 'BTC' ? 19700000 : item.symbol === 'ETH' ? 120000000 : 450000000);

      tickers.push({
        id,
        symbol: item.symbol,
        name: item.name,
        rank: rank++,
        priceUsd: item.price,
        priceChange1h: Number(((Math.random() - 0.48) * 0.8).toFixed(2)),
        priceChange24h: item.change24h,
        priceChange7d: item.change7d,
        marketCapUsd: Math.round(cap),
        volume24hUsd: Math.round(volume),
        circulatingSupply: Math.round(cap / item.price),
        sparkline7d: generateSparkline(item.price, item.change24h),
        high24h: Number(high24h.toFixed(2)),
        low24h: Number(low24h.toFixed(2)),
      });
    }

    return tickers;
  },

  saveAiAnalysis(analysis: AiRecommendation): void {
    const state = initializeDatabase();
    state.aiAnalyses.unshift(analysis);
    if (state.aiAnalyses.length > 20) {
      state.aiAnalyses.pop();
    }
  },

  getLatestAiAnalysis(): AiRecommendation | null {
    const state = initializeDatabase();
    return state.aiAnalyses[0] || null;
  },
};
