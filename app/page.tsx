'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
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
  const [activeTab, setActiveTab] = useState<'portfolio' | 'market' | 'chart' | 'wallets' | 'ai'>('portfolio');
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

        if (summaryRes.summary) setSummary(summaryRes.summary);
        if (holdingsRes.holdings) setHoldings(holdingsRes.holdings);
        if (txRes.transactions) setTransactions(txRes.transactions);
        if (walletsRes.wallets) setWallets(walletsRes.wallets);
        if (marketRes.tickers) {
          setTickers(marketRes.tickers);
          setGlobalMetrics(marketRes.globalMetrics);
        }
        if (authRes) {
          setTwoFactorEnabled(authRes.twoFactorEnabled);
          setTelegramConfigured(authRes.telegramConfigured);
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
  }, [refreshTrigger]);

  const handleSelectCoinForChart = (coinId: string) => {
    setSelectedCoinId(coinId);
    setActiveTab('chart');
  };

  const handleOpenAddTxWithCoin = (coin: Holding) => {
    setPreselectedCoin(coin);
    setShowAddTxModal(true);
  };

  const handleToggleCurrency = () => {
    setBaseCurrency((prev) => (prev === 'USD' ? 'VND' : 'USD'));
  };

  return (
    <div className="min-h-screen bg-[#090d12] text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* Navbar with CoinMarketCap global ticker bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(t) => setActiveTab(t as any)}
        twoFactorEnabled={twoFactorEnabled}
        onOpen2FA={() => setShow2faModal(true)}
        onOpenTelegram={() => setShowTelegramModal(true)}
        telegramConfigured={telegramConfigured}
        globalMetrics={globalMetrics}
        baseCurrency={baseCurrency}
        onToggleCurrency={handleToggleCurrency}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
      </main>

      {/* Footer */}
      <footer className="border-t border-[#21262d] bg-[#0d1117] py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-300">Shun&apos;s Crypto World</span>
            <span>•</span>
            <span>Bảo mật đơn chủ cá nhân (Single User)</span>
            <span>•</span>
            <span className="text-emerald-400 font-mono">0% Hack Risk (Watch-Only)</span>
          </div>
          <div>
            Powered by Next.js &amp; Gemini AI Intelligence.
          </div>
        </div>
      </footer>

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
    </div>
  );
}
