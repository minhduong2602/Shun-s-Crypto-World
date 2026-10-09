import React from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart3, Bell, Plus, RefreshCw, WalletCards } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GlassCard } from '@/components/ui/glass';
import { DashboardHoldingsTable } from '@/components/dashboard/holdings-table';
import { PortfolioHistoryChart } from '@/components/dashboard/portfolio-history-chart';
import type { Holding, PortfolioSummary, Wallet } from '@/lib/types';
import type { Transaction } from '@/lib/types';
import { TransactionHistory } from '@/components/TransactionHistory';
import { formatPortfolioCurrency } from '@/lib/format-portfolio-currency';

export function PortfolioDashboard({ summary, holdings, wallets, transactions = [], baseCurrency = 'USD', usdVndRate, loading, onRefresh = () => {}, onAddTransaction, onOpenAlerts, onViewMarket, onSelectCoinForChart, onAddTransactionForCoin }: { summary: PortfolioSummary; holdings: Holding[]; wallets: Wallet[]; transactions?: Transaction[]; baseCurrency?: string; usdVndRate?: number | null; loading: boolean; onRefresh?: () => void; onAddTransaction?: () => void; onOpenAlerts?: () => void; onViewMarket?: () => void; onSelectCoinForChart?: (coinId: string) => void; onAddTransactionForCoin?: (holding: Holding) => void }) {
  const changeUp = (summary.change24hPercentage ?? 0) >= 0;
  const valuationComplete = summary.isValuationComplete !== false;
  const currency = (amount: number) => formatPortfolioCurrency(amount, baseCurrency, usdVndRate);
  const walletValue = wallets.reduce((sum, wallet) => sum + (Number.isFinite(wallet.balanceUsd) ? wallet.balanceUsd : 0), 0);
  const walletCount = wallets.length;
  const walletTokenCount = wallets.reduce((sum, wallet) => sum + wallet.tokensCount, 0);
  const unpricedWalletAssetCount = wallets.reduce((sum, wallet) => sum + (wallet.unpricedAssetsCount ?? 0), 0);
  const quickActions = [
    { label: 'Giao dịch', hint: 'Mua hoặc bán', icon: Plus, onClick: onAddTransaction, tone: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-300' },
    { label: 'Thị trường', hint: 'Giá trực tiếp', icon: BarChart3, onClick: onViewMarket, tone: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300' },
    { label: 'Cảnh báo', hint: 'Telegram bot', icon: Bell, onClick: onOpenAlerts, tone: 'bg-amber-500/14 text-amber-700 dark:text-amber-300' },
    { label: 'Đồng bộ', hint: 'Làm mới dữ liệu', icon: RefreshCw, onClick: onRefresh, tone: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' },
  ];
  return <div className="grid gap-5 md:gap-6">
    {!valuationComplete && <Alert><AlertDescription>Chưa định giá được {summary.unpricedHoldingsCount ?? 0} tài sản. Tổng bên dưới chỉ gồm tài sản có giá; PnL và biến động 24h bị ẩn để tránh báo sai.</AlertDescription></Alert>}
    <section className="grid gap-4 lg:grid-cols-12">
      <GlassCard className="portfolio-hero lg:col-span-7"><CardHeader className="p-5 pb-3 sm:p-7 sm:pb-3"><div className="flex items-center justify-between gap-4"><CardDescription className="font-medium uppercase tracking-[0.12em]">{valuationComplete ? 'Tổng giá trị danh mục' : 'Danh mục đã định giá'}</CardDescription><Badge variant="secondary" className="rounded-full px-3 py-1">{baseCurrency}</Badge></div><CardTitle className="mt-3 text-4xl font-semibold tracking-[-0.04em] tabular-nums sm:text-5xl">{!valuationComplete && summary.totalValueUsd === 0 ? '—' : currency(summary.totalValueUsd)}</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center gap-2 px-5 pb-6 text-sm sm:px-7 sm:pb-7">{valuationComplete && summary.change24hPercentage !== null ? <><Badge variant={changeUp ? 'secondary' : 'destructive'} className={changeUp ? 'rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-700 dark:text-emerald-300' : 'rounded-full px-2.5 py-1'}>{changeUp ? <ArrowUpRight className="mr-1 size-3.5" /> : <ArrowDownRight className="mr-1 size-3.5" />}{summary.change24hPercentage.toFixed(2)}%</Badge><span className="text-muted-foreground">trong 24 giờ</span></> : <span className="text-muted-foreground">Biến động 24h: chưa đủ dữ liệu định giá</span>}</CardContent></GlassCard>
      <div className="grid grid-cols-2 gap-3 lg:col-span-5">
        <GlassCard className="glass-metric"><CardHeader className="p-4 pb-2"><CardDescription>Vốn đang mở</CardDescription><CardTitle className="text-lg tabular-nums sm:text-xl">{currency(summary.totalInvestedUsd)}</CardTitle></CardHeader><CardContent className="px-4 pb-4 text-xs text-muted-foreground">Giá vốn còn lại</CardContent></GlassCard>
        <GlassCard className="glass-metric"><CardHeader className="p-4 pb-2"><CardDescription>Lãi/lỗ mở</CardDescription><CardTitle className={`text-lg tabular-nums sm:text-xl ${summary.totalProfitLossUsd === null ? 'text-muted-foreground' : summary.totalProfitLossUsd >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-destructive'}`}>{summary.totalProfitLossUsd === null ? '—' : `${summary.totalProfitLossUsd >= 0 ? '+' : ''}${currency(summary.totalProfitLossUsd)}`}</CardTitle></CardHeader><CardContent className="px-4 pb-4 text-xs text-muted-foreground">{summary.totalProfitLossPercentage === null ? 'Chưa đủ dữ liệu' : `${summary.totalProfitLossPercentage >= 0 ? '+' : ''}${summary.totalProfitLossPercentage.toFixed(2)}% trên giá vốn`}</CardContent></GlassCard>
        <GlassCard className="glass-metric"><CardHeader className="p-4 pb-2"><CardDescription>Lãi/lỗ đã chốt</CardDescription><CardTitle className={`text-lg tabular-nums sm:text-xl ${summary.realizedProfitLossUsd >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-destructive'}`}>{summary.realizedProfitLossUsd >= 0 ? '+' : ''}{currency(summary.realizedProfitLossUsd)}</CardTitle></CardHeader><CardContent className="px-4 pb-4 text-xs text-muted-foreground">Sau phí bán</CardContent></GlassCard>
        <GlassCard className="glass-metric"><CardHeader className="p-4 pb-2"><CardDescription>Ví theo dõi</CardDescription><CardTitle className="text-lg tabular-nums sm:text-xl">{walletCount > 0 ? currency(walletValue) : '—'}</CardTitle></CardHeader><CardContent className="px-4 pb-4 text-xs text-muted-foreground">{walletCount} ví · {walletTokenCount} token{unpricedWalletAssetCount > 0 ? ` · ${unpricedWalletAssetCount} chưa giá` : ''}</CardContent></GlassCard>
      </div>
    </section>
    <section aria-label="Thao tác nhanh" className="grid grid-cols-4 gap-2 sm:gap-4">
      {quickActions.map(({ label, hint, icon: Icon, onClick, tone }) => <button key={label} type="button" onClick={onClick} disabled={!onClick} className="soft-action flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-[1.5rem] px-2 py-3 text-center transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-28">
        <span className={`grid size-10 place-items-center rounded-2xl sm:size-11 ${tone}`}><Icon className="size-5" /></span>
        <span><span className="block text-xs font-semibold sm:text-sm">{label}</span><span className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">{hint}</span></span>
      </button>)}
    </section>
    <PortfolioHistoryChart baseCurrency={baseCurrency} usdVndRate={usdVndRate} />
    <DashboardHoldingsTable holdings={holdings} baseCurrency={baseCurrency} usdVndRate={usdVndRate} loading={loading} onRefresh={onRefresh} onSelectCoin={onSelectCoinForChart} onAddTransaction={onAddTransactionForCoin} />
    <Card><CardHeader><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-2xl bg-primary/10 text-primary"><WalletCards className="size-4" /></span><CardTitle>Ví theo dõi</CardTitle></div><CardDescription>Chỉ xem — không bao giờ yêu cầu private key.</CardDescription></CardHeader><CardContent>{wallets.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Chưa có ví theo dõi</div> : <div className="grid gap-3 md:grid-cols-2">{wallets.map((wallet) => <div key={wallet.id} className="soft-list rounded-2xl p-4"><div className="flex items-center justify-between"><span className="font-medium">{wallet.label}</span><Badge variant="outline" className="rounded-full">{wallet.chain}</Badge></div><p className="mt-2 truncate font-mono text-xs text-muted-foreground">{wallet.address}</p><p className="mt-4 font-semibold tabular-nums">{currency(wallet.balanceUsd)}</p></div>)}</div>}</CardContent></Card>
    <TransactionHistory transactions={transactions} baseCurrency={baseCurrency} usdVndRate={usdVndRate} onRefresh={onRefresh} />
  </div>;
}
