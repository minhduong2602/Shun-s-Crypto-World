'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, type AppTab } from '@/components/app-shell';
import { PortfolioHero } from '@/components/PortfolioHero';
import { HoldingsTable } from '@/components/HoldingsTable';
import { AssetAllocationDonut } from '@/components/AssetAllocationDonut';
import { TechnicalChart } from '@/components/TechnicalChart';
import { MarketWatchlist } from '@/components/MarketWatchlist';
import { ViewOnlyWallets } from '@/components/ViewOnlyWallets';
import { AiPortfolioDoctor } from '@/components/AiPortfolioDoctor';
import { TransactionHistory } from '@/components/TransactionHistory';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { TelegramAlertsModal } from '@/components/TelegramAlertsModal';
import { TwoFactorModal } from '@/components/TwoFactorModal';
import {
  Holding,
  PortfolioSummary,
  MarketTicker,
  Wallet,
  Transaction,
  AiRecommendation,
} from '@/lib/types';
import { RefreshCw } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AppTab>('portfolio');
  const [baseCurrency, setBaseCurrency] = useState<'USD' | 'VND'>('USD');
  const [selectedCoinId, setSelectedCoinId] = useState('bitcoin');

  // Modals state
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [preselectedCoin, setPreselectedCoin] = useState<{
    symbol: string;
    name?: string;
    currentPrice?: number;
    price?: number;
  } | null>(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [show2faModal, setShow2faModal] = useState(false);

  // App data state
  const [summary, setSummary] = useState<PortfolioSummary>({
    totalValueUsd: 0,
    totalInvestedUsd: 0,
    totalProfitLossUsd: 0,
    totalProfitLossPercentage: 0,
    change24hUsd: 0,
    change24hPercentage: 0,
    holdingsCount: 0,
  });
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [tickers, setTickers] = useState<MarketTicker[]>([]);
  const [globalMetrics, setGlobalMetrics] = useState<any>(undefined);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadData = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function startFetch() {
      try {
        const [summaryRes, holdingsRes, txRes, walletsRes, marketRes, authRes] = await Promise.all([
          fetch('/api/portfolio/summary').then((r) => r.json()),
          fetch('/api/portfolio/holdings').then((r) => r.json()),
          fetch('/api/portfolio/transactions').then((r) => r.json()),
          fetch('/api/wallets').then((r) => r.json()),
          fetch('/api/market/tickers').then((r) => r.json()),
          fetch('/api/auth/status').then((r) => r.json()),
        ]);

        if (ignore) return;

        if (!authRes.isAuthenticated) {
          router.replace('/login');
          return;
        }

        if (summaryRes.summary) setSummary(summaryRes.summary);
        if (holdingsRes.holdings) setHoldings(holdingsRes.holdings);
        if (txRes.transactions) setTransactions(txRes.transactions);
        if (walletsRes.wallets) setWallets(walletsRes.wallets);
        if (marketRes.tickers) {
          setTickers(marketRes.tickers);
          setGlobalMetrics(marketRes.globalMetrics);
        }
        if (authRes) {
          setTwoFactorEnabled(Boolean(authRes.twoFactorEnabled));
          setTelegramConfigured(Boolean(authRes.telegramConfigured));
        }
      } catch (err) {
        console.error('Lỗi nạp dữ liệu:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void startFetch();
    const interval = setInterval(startFetch, 8000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [refreshTrigger, router]);

  const handleSelectCoinForChart = (coinId: string) => {
    setSelectedCoinId(coinId);
    setActiveTab('chart');
  };

  const handleOpenAddTxWithCoin = (coin: Holding) => {
    setPreselectedCoin(coin);
    setShowAddTxModal(true);
  };

  const titles: Record<AppTab, string> = { portfolio: 'Danh mục', market: 'Thị trường', chart: 'Biểu đồ', wallets: 'Ví theo dõi', ai: 'Trợ lý AI' };

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab} title={titles[activeTab]} onRefresh={loadData}>
        {loading && holdings.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-xs font-mono">Đang kết nối dữ liệu Shun&apos;s Crypto World...</p>
          </div>
        ) : (
          <>
            {/* Tab: Portfolio Overview */}
            {activeTab === 'portfolio' && (
              <div>
                <PortfolioHero
                  summary={summary}
                  baseCurrency={baseCurrency}
                  onOpenAddTransaction={() => {
                    setPreselectedCoin(null);
                    setShowAddTxModal(true);
                  }}
                  onOpenWallets={() => setActiveTab('wallets')}
                  onOpenAi={() => setActiveTab('ai')}
                  onOpenAlerts={() => setShowTelegramModal(true)}
                  onRefresh={loadData}
                />

                {/* Holdings Table */}
                <HoldingsTable
                  holdings={holdings}
                  baseCurrency={baseCurrency}
                  onSelectCoinForChart={handleSelectCoinForChart}
                  onAddTransactionForCoin={handleOpenAddTxWithCoin}
                  onRefresh={loadData}
                />

                {/* Donut Allocation */}
                {holdings.length > 0 && (
                  <div className="mt-8">
                    <AssetAllocationDonut holdings={holdings} baseCurrency={baseCurrency} />
                  </div>
                )}

                {/* Transactions Ledger */}
                <TransactionHistory
                  transactions={transactions}
                  baseCurrency={baseCurrency}
                  onRefresh={loadData}
                />
              </div>
            )}

            {/* Tab: Market Watchlist */}
            {activeTab === 'market' && (
              <MarketWatchlist
                tickers={tickers}
                baseCurrency={baseCurrency}
                onSelectCoinForChart={handleSelectCoinForChart}
                onOpenAddTransaction={(coin) => {
                  setPreselectedCoin(coin || null);
                  setShowAddTxModal(true);
                }}
                onRefresh={loadData}
              />
            )}

            {/* Tab: Technical Chart */}
            {activeTab === 'chart' && (
              <TechnicalChart
                selectedCoinId={selectedCoinId}
                onSelectCoin={setSelectedCoinId}
                baseCurrency={baseCurrency}
              />
            )}

            {/* Tab: Watch-Only Wallets */}
            {activeTab === 'wallets' && (
              <ViewOnlyWallets
                wallets={wallets}
                baseCurrency={baseCurrency}
                onRefresh={loadData}
              />
            )}

            {/* Tab: Gemini AI Doctor */}
            {activeTab === 'ai' && (
              <AiPortfolioDoctor initialAnalysis={null} />
            )}
          </>
        )}
      {/* Modals */}
      <AddTransactionModal
        isOpen={showAddTxModal}
        onClose={() => setShowAddTxModal(false)}
        onSuccess={loadData}
        preselectedCoin={preselectedCoin}
      />

      <TelegramAlertsModal
        isOpen={showTelegramModal}
        onClose={() => {
          setShowTelegramModal(false);
          loadData();
        }}
        baseCurrency={baseCurrency}
      />

      <TwoFactorModal
        isOpen={show2faModal}
        onClose={() => setShow2faModal(false)}
        twoFactorEnabled={twoFactorEnabled}
        onSuccess={loadData}
      />
    </AppShell>
  );
}
