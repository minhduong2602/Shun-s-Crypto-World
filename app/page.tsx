'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, type AppTab } from '@/components/app-shell';
import { PortfolioDashboard } from '@/components/dashboard/portfolio-dashboard';
import { TechnicalChart } from '@/components/TechnicalChart';
import { MarketWatchlist } from '@/components/MarketWatchlist';
import { ViewOnlyWallets } from '@/components/ViewOnlyWallets';
import { AiPortfolioDoctor } from '@/components/AiPortfolioDoctor';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { TelegramAlertsModal } from '@/components/TelegramAlertsModal';
import { DataStatus } from '@/components/dashboard/data-status';
import { Skeleton } from '@/components/ui/skeleton';
import { createSingleFlightPoller } from '@/lib/async/single-flight-poller';
import { parseBinanceMiniTickers, mergeLiveMarketTickers } from '@/lib/market/live-market-stream';
import { connectWithReconnect, type WebSocketConnectionStatus } from '@/lib/market/reconnecting-websocket';
import {
  Holding,
  PortfolioSummary,
  MarketTicker,
  Wallet,
  Transaction,
} from '@/lib/types';

function getApiErrorMessage(error: unknown): string | null {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return null;
}

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
    currentPrice?: number | null;
    price?: number | null;
  } | null>(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  // App data state
  const [summary, setSummary] = useState<PortfolioSummary>({
    totalValueUsd: 0,
    totalInvestedUsd: 0,
    totalProfitLossUsd: 0,
    realizedProfitLossUsd: 0,
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
  const [usdVndRate, setUsdVndRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [marketConnectionStatus, setMarketConnectionStatus] = useState<WebSocketConnectionStatus>('DISCONNECTED');
  const [lastMarketUpdateAt, setLastMarketUpdateAt] = useState<number | null>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadData = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch('/api/settings').then(async (response) => {
      if (!response.ok) return null;
      return response.json();
    }).then((settings) => {
      if (!ignore && (settings?.baseCurrency === 'USD' || settings?.baseCurrency === 'VND')) {
        setBaseCurrency(settings.baseCurrency);
      }
    }).catch(() => {
      // Currency display falls back to USD if settings are temporarily unavailable.
    });
    return () => { ignore = true; };
  }, []);

  const handleBaseCurrencyChange = useCallback(async (currency: 'USD' | 'VND') => {
    const previousCurrency = baseCurrency;
    setBaseCurrency(currency);
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseCurrency: currency }),
      });
      if (!response.ok) throw new Error('Không lưu được đơn vị tiền tệ');
    } catch {
      setBaseCurrency(previousCurrency);
    }
  }, [baseCurrency]);

  useEffect(() => {
    let ignore = false;
    const fetchJson = async (path: string) => {
      const response = await fetch(path);
      const data = await response.json().catch(() => ({}));
      return { response, data };
    };

    async function startFetch(): Promise<void> {
      try {
        const authRes = await fetchJson('/api/auth/status');
        if (ignore) return;

        if (authRes.response.status === 401 || (authRes.response.ok && !authRes.data.isAuthenticated)) {
          router.replace('/login');
          return;
        }
        if (!authRes.response.ok) {
          throw new Error(getApiErrorMessage(authRes.data.error) || 'Không thể xác thực phiên đăng nhập.');
        }

        const [summaryRes, walletsRes, marketRes] = await Promise.all([
          fetchJson('/api/portfolio/summary'),
          fetchJson('/api/wallets'),
          fetchJson('/api/market/tickers'),
        ]);

        if (ignore) return;

        const failedRequest = [summaryRes, walletsRes, marketRes]
          .find((result) => !result.response.ok);
        if (failedRequest) {
          throw new Error(getApiErrorMessage(failedRequest.data.error) || 'Máy chủ từ chối yêu cầu tải dữ liệu.');
        }

        if (summaryRes.data.summary) setSummary(summaryRes.data.summary);
        if (summaryRes.data.holdings) setHoldings(summaryRes.data.holdings);
        if (summaryRes.data.transactions) setTransactions(summaryRes.data.transactions);
        if (walletsRes.data.wallets) setWallets(walletsRes.data.wallets);
        if (marketRes.data.tickers) {
          setTickers(marketRes.data.tickers);
          setGlobalMetrics(marketRes.data.globalMetrics);
        }
        setUsdVndRate(Number.isFinite(marketRes.data.usdVndRate) && marketRes.data.usdVndRate > 0 ? marketRes.data.usdVndRate : null);
        setDataError(null);
      } catch (error) {
        if (!ignore) setDataError(error instanceof Error ? error.message : 'Không thể kết nối máy chủ để tải dữ liệu.');
        console.error('Lỗi nạp dữ liệu:', error);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    const poller = createSingleFlightPoller(startFetch, 30_000);
    poller.start();
    return () => {
      ignore = true;
      poller.stop();
    };
  }, [refreshTrigger, router]);

  useEffect(() => {
    let mounted = true;
    const connection = connectWithReconnect('wss://stream.binance.com:9443/ws/!miniTicker@arr', {
      onStatus: (status) => {
        if (mounted) setMarketConnectionStatus(status);
      },
      onMessage: (event) => {
        if (!mounted) return;
        try {
          const quotes = parseBinanceMiniTickers(JSON.parse(String(event.data)));
          if (quotes.size === 0) return;
          setTickers((current) => mergeLiveMarketTickers(current, quotes));
          setLastMarketUpdateAt(Date.now());
        } catch {
          // Keep the latest valid prices if an upstream frame is malformed.
        }
      },
    });
    return () => {
      mounted = false;
      connection.close();
    };
  }, []);

  useEffect(() => {
    if (marketConnectionStatus !== 'FALLBACK_REST') return;
    let cancelled = false;
    let inFlight = false;
    const refreshMarket = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch('/api/market/tickers', { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!cancelled && response.ok && Array.isArray(data.tickers)) {
          setTickers(data.tickers);
          setGlobalMetrics(data.globalMetrics);
          setUsdVndRate(Number.isFinite(data.usdVndRate) && data.usdVndRate > 0 ? data.usdVndRate : null);
          setLastMarketUpdateAt(Date.now());
        }
      } finally {
        inFlight = false;
      }
    };
    void refreshMarket();
    const timer = window.setInterval(refreshMarket, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [marketConnectionStatus]);

  const handleSelectCoinForChart = (coinId: string) => {
    setSelectedCoinId(coinId);
    setActiveTab('chart');
  };

  const handleOpenAddTxWithCoin = (coin: Holding) => {
    setPreselectedCoin(coin);
    setShowAddTxModal(true);
  };

  const handleAddTransaction = () => {
    setPreselectedCoin(null);
    setShowAddTxModal(true);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  const titles: Record<AppTab, string> = { portfolio: 'Danh mục', market: 'Thị trường', chart: 'Biểu đồ', wallets: 'Ví theo dõi', ai: 'Trợ lý AI' };

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab} title={titles[activeTab]} baseCurrency={baseCurrency} onBaseCurrencyChange={handleBaseCurrencyChange} onRefresh={loadData} onAddTransaction={handleAddTransaction} onOpenAlerts={() => setShowTelegramModal(true)} onLogout={handleLogout}>
        <DataStatus error={dataError} onRetry={loadData} />
        {dataError ? null : loading && holdings.length === 0 ? (
          <div role="status" aria-label="Đang tải dữ liệu danh mục" className="space-y-4">
            <span className="sr-only">Đang tải dữ liệu danh mục…</span>
            <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32 md:col-span-2" /><Skeleton className="h-32" /></div>
            <Skeleton className="h-16" />
            <Skeleton className="h-72" />
          </div>
        ) : (
          <>
            {/* Tab: Portfolio Overview */}
            {activeTab === 'portfolio' && (
              <div>
                <PortfolioDashboard summary={summary} holdings={holdings} wallets={wallets} transactions={transactions} baseCurrency={baseCurrency} usdVndRate={usdVndRate} loading={loading} onRefresh={loadData} onSelectCoinForChart={handleSelectCoinForChart} onAddTransactionForCoin={handleOpenAddTxWithCoin} />
              </div>
            )}

            {/* Tab: Market Watchlist */}
            {activeTab === 'market' && (
              <MarketWatchlist
                tickers={tickers}
                baseCurrency={baseCurrency}
                usdVndRate={usdVndRate}
                onSelectCoinForChart={handleSelectCoinForChart}
                onOpenAddTransaction={(coin) => {
                  setPreselectedCoin(coin || null);
                  setShowAddTxModal(true);
                }}
                onRefresh={loadData}
                marketConnectionStatus={marketConnectionStatus}
                lastMarketUpdateAt={lastMarketUpdateAt}
              />
            )}

            {/* Tab: Technical Chart */}
            {activeTab === 'chart' && (
              <TechnicalChart
                selectedCoinId={selectedCoinId}
                onSelectCoin={setSelectedCoinId}
                baseCurrency={baseCurrency}
                usdVndRate={usdVndRate}
              />
            )}

            {/* Tab: Watch-Only Wallets */}
            {activeTab === 'wallets' && (
              <ViewOnlyWallets
                wallets={wallets}
                baseCurrency={baseCurrency}
                usdVndRate={usdVndRate}
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

    </AppShell>
  );
}
