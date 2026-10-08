import {
  UserSettings,
  Wallet,
  WalletToken,
  Transaction,
  Holding,
  PortfolioSummary,
  PriceAlert,
  MarketTicker,
  AiRecommendation,
  ChainType,
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
      nativeBalance: 3.5,
      nativeSymbol: 'ETH',
      tokensCount: 5,
      tokens: [
        {
          id: 'eth-native',
          symbol: 'ETH',
          name: 'Ethereum',
          balance: 3.5,
          balanceUsd: 11970.0,
          priceUsd: 3420.0,
          change24h: 3.2,
          isNative: true,
          decimals: 18,
          chain: 'ETH',
          allocationPercentage: 77.6,
        },
        {
          id: 'eth-usdc',
          symbol: 'USDC',
          name: 'USD Coin',
          balance: 2150.0,
          balanceUsd: 2150.0,
          priceUsd: 1.0,
          change24h: 0.01,
          contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          isNative: false,
          decimals: 6,
          chain: 'ETH',
          allocationPercentage: 13.9,
        },
        {
          id: 'eth-link',
          symbol: 'LINK',
          name: 'Chainlink',
          balance: 55.0,
          balanceUsd: 825.0,
          priceUsd: 15.0,
          change24h: 4.8,
          contractAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
          isNative: false,
          decimals: 18,
          chain: 'ETH',
          allocationPercentage: 5.4,
        },
        {
          id: 'eth-uni',
          symbol: 'UNI',
          name: 'Uniswap',
          balance: 35.0,
          balanceUsd: 315.0,
          priceUsd: 9.0,
          change24h: -1.2,
          contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
          isNative: false,
          decimals: 18,
          chain: 'ETH',
          allocationPercentage: 2.0,
        },
        {
          id: 'eth-pepe',
          symbol: 'PEPE',
          name: 'Pepe',
          balance: 16500000,
          balanceUsd: 160.5,
          priceUsd: 0.0000097,
          change24h: 8.5,
          contractAddress: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
          isNative: false,
          decimals: 18,
          chain: 'ETH',
          allocationPercentage: 1.1,
        },
      ],
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
      nativeBalance: 32.0,
      nativeSymbol: 'SOL',
      tokensCount: 4,
      tokens: [
        {
          id: 'sol-native',
          symbol: 'SOL',
          name: 'Solana',
          balance: 32.0,
          balanceUsd: 5920.0,
          priceUsd: 185.0,
          change24h: 4.5,
          isNative: true,
          decimals: 9,
          chain: 'SOL',
          allocationPercentage: 80.3,
        },
        {
          id: 'sol-jup',
          symbol: 'JUP',
          name: 'Jupiter',
          balance: 850.0,
          balanceUsd: 807.5,
          priceUsd: 0.95,
          change24h: 6.2,
          contractAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
          isNative: false,
          decimals: 6,
          chain: 'SOL',
          allocationPercentage: 11.0,
        },
        {
          id: 'sol-ray',
          symbol: 'RAY',
          name: 'Raydium',
          balance: 240.0,
          balanceUsd: 480.0,
          priceUsd: 2.0,
          change24h: 3.1,
          contractAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
          isNative: false,
          decimals: 6,
          chain: 'SOL',
          allocationPercentage: 6.5,
        },
        {
          id: 'sol-usdc',
          symbol: 'USDC',
          name: 'USD Coin SPL',
          balance: 160.5,
          balanceUsd: 160.5,
          priceUsd: 1.0,
          change24h: 0.0,
          contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          isNative: false,
          decimals: 6,
          chain: 'SOL',
          allocationPercentage: 2.2,
        },
      ],
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
      tokens: [
        {
          id: 'btc-native',
          symbol: 'BTC',
          name: 'Bitcoin Native',
          balance: 0.85,
          balanceUsd: 77732.5,
          priceUsd: 91450.0,
          change24h: 1.8,
          isNative: true,
          decimals: 8,
          chain: 'BTC',
          allocationPercentage: 100.0,
        },
      ],
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

  getWalletById(id: string): Wallet | undefined {
    const state = initializeDatabase();
    return state.wallets.find((w) => w.id === id);
  },

  updateWallet(id: string, updates: Partial<Wallet>): Wallet | null {
    const state = initializeDatabase();
    const index = state.wallets.findIndex((w) => w.id === id);
    if (index === -1) return null;
    state.wallets[index] = {
      ...state.wallets[index],
      ...updates,
      lastSyncedAt: updates.lastSyncedAt || new Date().toISOString(),
    };
    return { ...state.wallets[index] };
  },

  removeWalletToken(walletId: string, tokenIdOrContract: string): boolean {
    const state = initializeDatabase();
    const wallet = state.wallets.find((w) => w.id === walletId);
    if (!wallet || !wallet.tokens) return false;

    const clean = (tokenIdOrContract || '').toLowerCase().trim();
    const prevLen = wallet.tokens.length;
    wallet.tokens = wallet.tokens.filter(
      (t) =>
        t.id.toLowerCase() !== clean &&
        (t.contractAddress ? t.contractAddress.toLowerCase() !== clean : true) &&
        t.symbol.toLowerCase() !== clean
    );

    if (wallet.tokens.length < prevLen) {
      const newTotal = wallet.tokens.reduce((acc, t) => acc + t.balanceUsd, 0);
      wallet.balanceUsd = Number(newTotal.toFixed(2));
      wallet.tokensCount = wallet.tokens.length;
      for (const t of wallet.tokens) {
        t.allocationPercentage =
          newTotal > 0 ? Number(((t.balanceUsd / newTotal) * 100).toFixed(1)) : 0;
      }
      return true;
    }
    return false;
  },

  addWallet(wallet: {
    chain: ChainType;
    address: string;
    label: string;
    isActive?: boolean;
    nativeBalance?: number;
    nativeSymbol?: string;
    balanceUsd?: number;
    tokensCount?: number;
    tokens?: WalletToken[];
  }): Wallet {
    const state = initializeDatabase();
    const nativeSymbolMap: Record<string, string> = {
      ETH: 'ETH',
      BSC: 'BNB',
      POLYGON: 'POL',
      ARBITRUM: 'ETH',
      SOL: 'SOL',
      BTC: 'BTC',
    };

    const nativeSymbol = wallet.nativeSymbol || nativeSymbolMap[wallet.chain] || 'ETH';
    const nativeBalance = wallet.nativeBalance !== undefined ? wallet.nativeBalance : 0;
    const balanceUsd = wallet.balanceUsd !== undefined ? wallet.balanceUsd : 0;

    const newWallet: Wallet = {
      id: 'w-' + Date.now().toString(36),
      chain: wallet.chain,
      address: wallet.address,
      label: wallet.label,
      isActive: wallet.isActive ?? true,
      balanceUsd,
      nativeBalance,
      nativeSymbol,
      tokensCount: wallet.tokens?.length || wallet.tokensCount || (nativeBalance > 0 ? 1 : 0),
      tokens: wallet.tokens || [],
      lastSyncedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    state.wallets.unshift(newWallet);
    return newWallet;
  },

  removeWallet(id: string): boolean {
    const state = initializeDatabase();
    const initialLen = state.wallets.length;
    const clean = (id || '').trim().toLowerCase();
    state.wallets = state.wallets.filter((w) => {
      const matchId = (w.id || '').trim().toLowerCase() === clean;
      const matchAddr = (w.address || '').trim().toLowerCase() === clean;
      return !matchId && !matchAddr;
    });
    return state.wallets.length < initialLen;
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

  updateTransaction(id: string, updates: Partial<Transaction>): Transaction | null {
    const state = initializeDatabase();
    const idx = state.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return null;

    const current = state.transactions[idx];
    const amount = updates.amount !== undefined ? updates.amount : current.amount;
    const pricePerCoin = updates.pricePerCoin !== undefined ? updates.pricePerCoin : current.pricePerCoin;
    const fee = updates.fee !== undefined ? updates.fee : current.fee;
    const totalAmount = Number((amount * pricePerCoin + fee).toFixed(2));

    state.transactions[idx] = {
      ...current,
      ...updates,
      amount,
      pricePerCoin,
      fee,
      totalAmount,
    };
    return { ...state.transactions[idx] };
  },

  updateHoldingNotes(coinIdOrSymbol: string, notes: string): boolean {
    const state = initializeDatabase();
    const clean = (coinIdOrSymbol || '').trim().toLowerCase();
    let updated = false;
    for (const tx of state.transactions) {
      if (tx.coinId.toLowerCase() === clean || tx.symbol.toLowerCase() === clean) {
        tx.notes = notes;
        updated = true;
      }
    }
    return updated;
  },

  removeHolding(coinIdOrSymbol: string): boolean {
    const state = initializeDatabase();
    const clean = (coinIdOrSymbol || '').trim().toLowerCase();
    const prevLen = state.transactions.length;
    state.transactions = state.transactions.filter(
      (tx) => tx.coinId.toLowerCase() !== clean && tx.symbol.toLowerCase() !== clean
    );
    return state.transactions.length < prevLen;
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

  updateAlert(id: string, updates: Partial<PriceAlert>): PriceAlert | null {
    const state = initializeDatabase();
    const alert = state.alerts.find((a) => a.id === id);
    if (!alert) return null;

    if (updates.condition) alert.condition = updates.condition;
    if (updates.targetValue !== undefined) alert.targetValue = updates.targetValue;
    if (updates.isRecurring !== undefined) alert.isRecurring = updates.isRecurring;
    if (updates.isActive !== undefined) alert.isActive = updates.isActive;

    return { ...alert };
  },

  addCustomTicker(coin: { symbol: string; name: string; price: number; change24h?: number; change7d?: number }) {
    const sym = coin.symbol.toUpperCase();
    const id = sym.toLowerCase();
    DEFAULT_PRICES[id] = {
      price: coin.price || 1.0,
      change24h: coin.change24h ?? 0,
      change7d: coin.change7d ?? 0,
      symbol: sym,
      name: coin.name || sym,
    };
  },

  removeCustomTicker(symbol: string): boolean {
    const id = symbol.toLowerCase();
    if (DEFAULT_PRICES[id]) {
      delete DEFAULT_PRICES[id];
      return true;
    }
    return false;
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
