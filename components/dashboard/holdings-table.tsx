'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CandlestickChart,
  Coins,
  History,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { formatPortfolioCurrency } from '@/lib/format-portfolio-currency';
import type { Holding, Transaction } from '@/lib/types';

type SortField = 'value' | 'change24h' | 'amount' | 'price';

function CryptoIcon({ symbol, name }: { symbol: string; name: string }) {
  const [hasError, setHasError] = useState(false);
  const cleanSymbol = symbol.toLowerCase();
  const iconUrl = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${cleanSymbol}.png`;

  if (hasError) {
    return (
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
        {symbol.slice(0, 3).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-border/40 bg-muted/60">
      <img
        src={iconUrl}
        alt={name}
        className="size-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export function DashboardHoldingsTable({
  holdings,
  transactions = [],
  baseCurrency,
  usdVndRate,
  loading = false,
  onRefresh,
  onSelectCoin,
  onAddTransaction,
}: {
  holdings: Holding[];
  transactions?: Transaction[];
  baseCurrency: string;
  usdVndRate?: number | null;
  loading?: boolean;
  onRefresh?: () => void;
  onSelectCoin?: (coinId: string) => void;
  onAddTransaction?: (holding: Holding) => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ field: SortField; direction: 'asc' | 'desc' }>({ field: 'value', direction: 'desc' });
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [noteTarget, setNoteTarget] = useState<Holding | null>(null);
  const [note, setNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Holding | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = (value: number) => formatPortfolioCurrency(value, baseCurrency, usdVndRate);

  const visibleHoldings = useMemo(() => holdings
    .filter((holding) => `${holding.name} ${holding.symbol}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((left, right) => {
      const a = sort.field === 'value' ? left.currentValue : sort.field === 'change24h' ? left.priceChange24h : sort.field === 'amount' ? left.amount : left.currentPrice;
      const b = sort.field === 'value' ? right.currentValue : sort.field === 'change24h' ? right.priceChange24h : sort.field === 'amount' ? right.amount : right.currentPrice;
      const difference = (a ?? Number.NEGATIVE_INFINITY) - (b ?? Number.NEGATIVE_INFINITY);
      return sort.direction === 'desc' ? -difference : difference;
    }), [holdings, query, sort]);

  // Lọc lịch sử giao dịch riêng của tài sản đang được chọn
  const holdingTransactions = useMemo(() => {
    if (!selectedHolding) return [];
    return transactions
      .filter((tx) => tx.symbol.toLowerCase() === selectedHolding.symbol.toLowerCase() || tx.coinId === selectedHolding.coinId)
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
  }, [transactions, selectedHolding]);

  const sortButton = (field: SortField, label: string) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={`Sắp xếp theo ${label}`}
      className="-mr-2 h-7 gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      onClick={(e) => {
        e.stopPropagation();
        setSort((current) => ({ field, direction: current.field === field && current.direction === 'desc' ? 'asc' : 'desc' }));
      }}
    >
      {label}
      {sort.field === field ? sort.direction === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" /> : <ArrowUpDown className="size-3" />}
    </Button>
  );

  async function saveNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteTarget) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/portfolio/holdings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coinId: noteTarget.coinId, symbol: noteTarget.symbol, notes: note.trim() }),
      });
      if (!response.ok) throw new Error('Không lưu được ghi chú. Vui lòng thử lại.');
      setNoteTarget(null);
      onRefresh?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được ghi chú.');
    } finally {
      setBusy(false);
    }
  }

  async function deletePosition() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/portfolio/holdings?symbol=${encodeURIComponent(deleteTarget.symbol)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Không xóa được lịch sử giao dịch. Vui lòng thử lại.');
      setDeleteTarget(null);
      if (selectedHolding?.symbol === deleteTarget.symbol) setSelectedHolding(null);
      onRefresh?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không xóa được lịch sử giao dịch.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSingleTransaction() {
    if (!txToDelete) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/portfolio/transactions?id=${txToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setTxToDelete(null);
        onRefresh?.();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold tracking-tight">Danh mục tài sản</CardTitle>
            <CardDescription className="text-xs">{visibleHoldings.length} tài sản đang theo dõi</CardDescription>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Tìm tài sản"
              type="search"
              placeholder="Tìm theo tên hoặc mã…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 rounded-xl pl-9 text-xs sm:text-sm"
            />
          </div>
        </CardHeader>

        {error && (
          <div className="px-5 pb-3">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-2.5 text-xs">Tài sản</TableHead>
                <TableHead className="py-2.5 text-right">{sortButton('price', 'Giá thị trường')}</TableHead>
                <TableHead className="py-2.5 text-right">{sortButton('value', 'Số lượng')}</TableHead>
                <TableHead className="w-12 p-0 text-center sm:w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-28 text-center text-sm text-muted-foreground">
                    Đang tải danh mục…
                  </TableCell>
                </TableRow>
              ) : visibleHoldings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center">
                    <Coins className="mx-auto mb-2 size-5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {query ? 'Không tìm thấy tài sản phù hợp.' : 'Chưa có tài sản. Hãy thêm ví hoặc giao dịch đầu tiên.'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                visibleHoldings.map((holding) => {
                  const pnl = holding.unrealizedPnLPercentage;
                  const pnlPositive = pnl !== null ? pnl >= 0 : (holding.priceChange24h ?? 0) >= 0;
                  const priceStr = holding.currentPrice === null ? 'Chưa định giá' : currency(holding.currentPrice);
                  const valueStr = holding.currentValue === null ? 'Chưa định giá' : currency(holding.currentValue);

                  return (
                    <TableRow
                      key={holding.id}
                      onClick={() => setSelectedHolding(holding)}
                      className="group cursor-pointer transition-colors hover:bg-accent/40 active:bg-accent/60"
                      title="Bấm để xem lịch sử giao dịch và chi tiết"
                    >
                      {/* Cột 1: Ticker Icon - Ticker (hàng 1) - Tên coin (hàng 2) */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <CryptoIcon symbol={holding.symbol} name={holding.name} />
                          <div className="min-w-0 leading-tight">
                            <span className="block truncate font-bold text-sm sm:text-base uppercase">
                              {holding.symbol}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground mt-0.5">
                              {holding.name}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Cột 2: Giá thị trường (hàng 1) - Lãi/lỗ (hàng 2) */}
                      <TableCell className="py-3 text-right">
                        <div className="leading-tight">
                          <span className="block font-medium tabular-nums text-sm sm:text-base">
                            {priceStr}
                          </span>
                          <span
                            className={`block font-medium tabular-nums text-xs mt-0.5 ${
                              pnl === null && holding.priceChange24h === null
                                ? 'text-muted-foreground'
                                : pnlPositive
                                ? 'text-emerald-500 dark:text-emerald-400'
                                : 'text-destructive'
                            }`}
                          >
                            {pnl !== null ? (
                              `${pnlPositive ? '▲ ' : '▼ '}${Math.abs(pnl).toFixed(2)}%`
                            ) : holding.priceChange24h !== null ? (
                              `${(holding.priceChange24h ?? 0) >= 0 ? '▲ ' : '▼ '}${Math.abs(holding.priceChange24h).toFixed(2)}%`
                            ) : (
                              '—'
                            )}
                          </span>
                        </div>
                      </TableCell>

                      {/* Cột 3: Thành tiền (hàng 1) - Số lượng (hàng 2) */}
                      <TableCell className="py-3 text-right">
                        <div className="leading-tight">
                          <span className="block font-semibold tabular-nums text-sm sm:text-base">
                            {valueStr}
                          </span>
                          <span className="block font-mono tabular-nums text-xs text-muted-foreground mt-0.5">
                            {holding.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })} {holding.symbol}
                          </span>
                        </div>
                      </TableCell>

                      {/* Cột 4: Nút thao tác nhanh (hỗ trợ accessibility & desktop hover) */}
                      <TableCell className="py-3 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                          {onSelectCoin && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-lg"
                              aria-label={`Xem biểu đồ ${holding.symbol}`}
                              title={`Xem biểu đồ ${holding.symbol}`}
                              onClick={() => onSelectCoin(holding.coinId)}
                            >
                              <CandlestickChart className="size-3.5" />
                            </Button>
                          )}
                          {onAddTransaction && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg px-2 text-xs"
                              aria-label={`Thêm giao dịch ${holding.symbol}`}
                              title={`Thêm giao dịch ${holding.symbol}`}
                              onClick={() => onAddTransaction(holding)}
                            >
                              <Plus className="size-3" />
                              <span className="hidden xl:inline ml-1">Giao dịch</span>
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="hidden sm:inline-flex size-8 rounded-lg"
                            aria-label={`Sửa ghi chú ${holding.symbol}`}
                            title={`Sửa ghi chú ${holding.symbol}`}
                            onClick={() => {
                              setNoteTarget(holding);
                              setNote(holding.notes ?? '');
                              setError(null);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="hidden sm:inline-flex size-8 rounded-lg text-muted-foreground hover:text-destructive"
                            aria-label={`Xóa lịch sử ${holding.symbol}`}
                            title={`Xóa lịch sử ${holding.symbol}`}
                            onClick={() => {
                              setDeleteTarget(holding);
                              setError(null);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL: LỊCH SỬ GIAO DỊCH KHI BẤM VÀO TÀI SẢN */}
      <Dialog open={Boolean(selectedHolding)} onOpenChange={(open) => !open && setSelectedHolding(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto p-4 sm:p-6">
          {selectedHolding && (
            <>
              <DialogHeader className="border-b pb-4 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CryptoIcon symbol={selectedHolding.symbol} name={selectedHolding.name} />
                    <div>
                      <DialogTitle className="text-lg font-bold">
                        {selectedHolding.name} ({selectedHolding.symbol})
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground">
                        Lịch sử giao dịch & thông tin vị thế
                      </DialogDescription>
                    </div>
                  </div>
                  {selectedHolding.currentValue !== null && (
                    <div className="text-right">
                      <p className="text-base font-bold tabular-nums">
                        {currency(selectedHolding.currentValue)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {selectedHolding.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })} {selectedHolding.symbol}
                      </p>
                    </div>
                  )}
                </div>
              </DialogHeader>

              {/* Tóm tắt vị thế tài sản */}
              <div className="grid grid-cols-2 gap-2 rounded-2xl border bg-card/60 p-3 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Giá hiện tại</span>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {selectedHolding.currentPrice === null ? '—' : currency(selectedHolding.currentPrice)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Giá vốn TB</span>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {currency(selectedHolding.avgBuyPrice)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Lãi/lỗ chưa chốt</span>
                  <p
                    className={`mt-0.5 font-semibold tabular-nums ${
                      (selectedHolding.unrealizedPnL ?? 0) >= 0 ? 'text-emerald-500' : 'text-destructive'
                    }`}
                  >
                    {selectedHolding.unrealizedPnL === null ? '—' : `${(selectedHolding.unrealizedPnL ?? 0) >= 0 ? '+' : ''}${currency(selectedHolding.unrealizedPnL)}`}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tỷ lệ PnL</span>
                  <p
                    className={`mt-0.5 font-semibold tabular-nums ${
                      (selectedHolding.unrealizedPnLPercentage ?? 0) >= 0 ? 'text-emerald-500' : 'text-destructive'
                    }`}
                  >
                    {selectedHolding.unrealizedPnLPercentage === null ? '—' : `${(selectedHolding.unrealizedPnLPercentage ?? 0) >= 0 ? '+' : ''}${selectedHolding.unrealizedPnLPercentage.toFixed(2)}%`}
                  </p>
                </div>
              </div>

              {/* Thao tác với tài sản */}
              <div className="flex flex-wrap items-center gap-2 border-b pb-3">
                {onAddTransaction && (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 rounded-xl text-xs gap-1.5"
                    onClick={() => {
                      onAddTransaction(selectedHolding);
                    }}
                  >
                    <Plus className="size-3.5" />
                    <span>Thêm giao dịch</span>
                  </Button>
                )}
                {onSelectCoin && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-xl text-xs gap-1.5"
                    onClick={() => {
                      onSelectCoin(selectedHolding.coinId);
                      setSelectedHolding(null);
                    }}
                  >
                    <CandlestickChart className="size-3.5" />
                    <span>Xem biểu đồ</span>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl text-xs gap-1.5"
                  onClick={() => {
                    setNoteTarget(selectedHolding);
                    setNote(selectedHolding.notes ?? '');
                  }}
                >
                  <Pencil className="size-3.5" />
                  <span>Ghi chú</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-xl text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setDeleteTarget(selectedHolding);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  <span>Xóa vị thế</span>
                </Button>
              </div>

              {/* Lịch sử giao dịch của riêng tài sản này */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <History className="size-3.5" />
                    Lịch sử giao dịch ({holdingTransactions.length})
                  </h4>
                </div>

                {holdingTransactions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Chưa có giao dịch mua/bán nào được ghi nhận cho {selectedHolding.symbol}.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {holdingTransactions.map((tx) => {
                      const typeLabel =
                        tx.type === 'BUY' ? 'Mua' : tx.type === 'SELL' ? 'Bán' : tx.type === 'TRANSFER_IN' ? 'Nạp' : 'Rút';
                      const badgeVariant =
                        tx.type === 'BUY'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : tx.type === 'SELL'
                          ? 'border-destructive/30 bg-destructive/10 text-destructive'
                          : 'border-primary/30 bg-primary/10 text-primary';

                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between rounded-xl border bg-card/60 p-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${badgeVariant}`}>
                                {typeLabel}
                              </Badge>
                              <span className="font-semibold tabular-nums">
                                {tx.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })} {tx.symbol}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(tx.executedAt).toLocaleString('vi-VN', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                              {tx.pricePerCoin > 0 && ` · Đơn giá: ${currency(tx.pricePerCoin)}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 text-right">
                            <div>
                              <p className="font-semibold tabular-nums text-xs sm:text-sm">
                                {currency(tx.totalAmount)}
                              </p>
                              {tx.fee > 0 && (
                                <p className="text-[10px] text-muted-foreground">Phí: {currency(tx.fee)}</p>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 rounded-lg text-muted-foreground hover:text-destructive"
                              onClick={() => setTxToDelete(tx)}
                              title="Xóa giao dịch này"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Sửa ghi chú */}
      <Dialog open={Boolean(noteTarget)} onOpenChange={(open) => { if (!open && !busy) setNoteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ghi chú {noteTarget?.name} ({noteTarget?.symbol})</DialogTitle>
            <DialogDescription>Lưu mục tiêu, kế hoạch DCA hoặc ghi chú cho vị thế này.</DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <form onSubmit={saveNote} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="holding-note">Ghi chú cho {noteTarget?.name}</Label>
              <Textarea
                id="holding-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ví dụ: DCA theo quý, mục tiêu chốt lời…"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setNoteTarget(null)}>
                Hủy
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Đang lưu…' : 'Lưu ghi chú'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Xóa vị thế tài sản */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !busy) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa toàn bộ lịch sử {deleteTarget?.symbol}?</DialogTitle>
            <DialogDescription>
              Thao tác này xóa các giao dịch {deleteTarget?.symbol} khỏi danh mục và không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {deleteTarget && (
            <div className="rounded-md border bg-muted/40 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Số lượng đang nắm giữ</span>
                <span className="font-mono">{deleteTarget.amount} {deleteTarget.symbol}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-muted-foreground">Giá trị đã định giá</span>
                <span className="font-mono">
                  {deleteTarget.currentValue === null ? 'Chưa định giá' : currency(deleteTarget.currentValue)}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setDeleteTarget(null)}>
              Hủy
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void deletePosition()}>
              {busy ? 'Đang xóa…' : 'Xóa lịch sử giao dịch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Xóa từng giao dịch */}
      <Dialog open={Boolean(txToDelete)} onOpenChange={(open) => !open && setTxToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa giao dịch này?</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa giao dịch {txToDelete?.type} {txToDelete?.amount} {txToDelete?.symbol}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setTxToDelete(null)}>
              Hủy
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={handleDeleteSingleTransaction}>
              {busy ? 'Đang xóa…' : 'Xác nhận xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
