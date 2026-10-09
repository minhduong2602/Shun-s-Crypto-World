import React from 'react';
import { ArrowDownRight, ArrowUpRight, WalletCards } from 'lucide-react';
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

export function PortfolioDashboard({ summary, holdings, wallets, transactions = [], baseCurrency = 'USD', usdVndRate, loading, onRefresh = () => {}, onSelectCoinForChart, onAddTransactionForCoin }: { summary: PortfolioSummary; holdings: Holding[]; wallets: Wallet[]; transactions?: Transaction[]; baseCurrency?: string; usdVndRate?: number | null; loading: boolean; onRefresh?: () => void; onSelectCoinForChart?: (coinId: string) => void; onAddTransactionForCoin?: (holding: Holding) => void }) {
  const changeUp = (summary.change24hPercentage ?? 0) >= 0;
  const valuationComplete = summary.isValuationComplete !== false;
  const currency = (amount: number) => formatPortfolioCurrency(amount, baseCurrency, usdVndRate);
  const walletValue = wallets.reduce((sum, wallet) => sum + (Number.isFinite(wallet.balanceUsd) ? wallet.balanceUsd : 0), 0);
  const walletCount = wallets.length;
  const walletTokenCount = wallets.reduce((sum, wallet) => sum + wallet.tokensCount, 0);
  const unpricedWalletAssetCount = wallets.reduce((sum, wallet) => sum + (wallet.unpricedAssetsCount ?? 0), 0);
  return <div className="grid gap-6">
    {!valuationComplete && <Alert><AlertDescription>Chưa định giá được {summary.unpricedHoldingsCount ?? 0} tài sản. Tổng bên dưới chỉ gồm tài sản có giá; PnL và biến động 24h bị ẩn để tránh báo sai.</AlertDescription></Alert>}
    <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      <GlassCard className="md:col-span-2"><CardHeader><CardDescription>{valuationComplete ? 'Giá trị sổ giao dịch' : 'Sổ giao dịch đã định giá'}</CardDescription><CardTitle className="text-3xl tabular-nums">{!valuationComplete && summary.totalValueUsd === 0 ? '—' : currency(summary.totalValueUsd)}</CardTitle></CardHeader><CardContent className="flex items-center gap-2 text-sm">{valuationComplete && summary.change24hPercentage !== null ? <><Badge variant={changeUp ? 'secondary' : 'destructive'} className={changeUp ? 'bg-emerald-500/15 text-emerald-500' : ''}>{changeUp ? <ArrowUpRight className="mr-1 size-3" /> : <ArrowDownRight className="mr-1 size-3" />}{summary.change24hPercentage.toFixed(2)}%</Badge><span className="text-muted-foreground">trong 24 giờ</span></> : <span className="text-muted-foreground">Biến động 24h: chưa đủ dữ liệu định giá</span>}</CardContent></GlassCard>
      <GlassCard className="glass-metric"><CardHeader><CardDescription>Vốn vị thế đang mở</CardDescription><CardTitle className="tabular-nums">{currency(summary.totalInvestedUsd)}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Giá vốn còn lại trong sổ giao dịch</CardContent></GlassCard>
      <GlassCard className="glass-metric"><CardHeader><CardDescription>Lãi/lỗ chưa thực hiện</CardDescription><CardTitle className={`tabular-nums ${summary.totalProfitLossUsd === null ? 'text-muted-foreground' : summary.totalProfitLossUsd >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>{summary.totalProfitLossUsd === null ? '—' : `${summary.totalProfitLossUsd >= 0 ? '+' : ''}${currency(summary.totalProfitLossUsd)}`}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{summary.totalProfitLossPercentage === null ? 'Chưa đủ dữ liệu định giá' : `${summary.totalProfitLossPercentage >= 0 ? '+' : ''}${summary.totalProfitLossPercentage.toFixed(2)}% trên giá vốn vị thế đang mở`}</CardContent></GlassCard>
      <GlassCard className="glass-metric"><CardHeader><CardDescription>Lãi/lỗ đã chốt</CardDescription><CardTitle className={`tabular-nums ${summary.realizedProfitLossUsd >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>{summary.realizedProfitLossUsd >= 0 ? '+' : ''}{currency(summary.realizedProfitLossUsd)}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Tính theo giá vốn bình quân, đã trừ phí bán</CardContent></GlassCard>
      <GlassCard className="glass-metric"><CardHeader><CardDescription>{unpricedWalletAssetCount > 0 ? 'Giá trị đã định giá trong ví theo dõi' : 'Tổng giá trị ví theo dõi'}</CardDescription><CardTitle className="tabular-nums">{walletCount > 0 ? currency(walletValue) : '—'}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{walletCount} ví · {walletTokenCount} token{unpricedWalletAssetCount > 0 ? ` · ${unpricedWalletAssetCount} chưa định giá` : ''}</CardContent></GlassCard>
    </section>
    <PortfolioHistoryChart baseCurrency={baseCurrency} usdVndRate={usdVndRate} />
    <DashboardHoldingsTable holdings={holdings} baseCurrency={baseCurrency} usdVndRate={usdVndRate} loading={loading} onRefresh={onRefresh} onSelectCoin={onSelectCoinForChart} onAddTransaction={onAddTransactionForCoin} />
    <Card><CardHeader><div className="flex items-center gap-2"><WalletCards className="size-4 text-muted-foreground" /><CardTitle>Ví theo dõi</CardTitle></div><CardDescription>Chỉ xem — không bao giờ yêu cầu private key.</CardDescription></CardHeader><CardContent>{wallets.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Chưa có ví theo dõi</div> : <div className="grid gap-3 md:grid-cols-2">{wallets.map((wallet) => <div key={wallet.id} className="rounded-lg border p-4"><div className="flex items-center justify-between"><span className="font-medium">{wallet.label}</span><Badge variant="outline">{wallet.chain}</Badge></div><p className="mt-2 truncate font-mono text-xs text-muted-foreground">{wallet.address}</p><p className="mt-4 font-semibold tabular-nums">{currency(wallet.balanceUsd)}</p></div>)}</div>}</CardContent></Card>
    <TransactionHistory transactions={transactions} baseCurrency={baseCurrency} usdVndRate={usdVndRate} onRefresh={onRefresh} />
  </div>;
}
