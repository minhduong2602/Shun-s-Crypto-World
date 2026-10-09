'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChartNoAxesCombined, Coins, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { formatPortfolioCurrency } from '@/lib/format-portfolio-currency';
import type { Holding } from '@/lib/types';

type SortField = 'value' | 'change24h' | 'amount' | 'pnl';

export function DashboardHoldingsTable({
  holdings,
  baseCurrency,
  usdVndRate,
  loading = false,
  onRefresh,
  onSelectCoin,
  onAddTransaction,
}: {
  holdings: Holding[];
  baseCurrency: string;
  usdVndRate?: number | null;
  loading?: boolean;
  onRefresh?: () => void;
  onSelectCoin?: (coinId: string) => void;
  onAddTransaction?: (holding: Holding) => void;
}) {
  const [query, setQuery] = useState('');
  const isMobile = useIsMobile();
  const [sort, setSort] = useState<{ field: SortField; direction: 'asc' | 'desc' }>({ field: 'value', direction: 'desc' });
  const [noteTarget, setNoteTarget] = useState<Holding | null>(null);
  const [note, setNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Holding | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = (value: number) => formatPortfolioCurrency(value, baseCurrency, usdVndRate);

  const visibleHoldings = useMemo(() => holdings
    .filter((holding) => `${holding.name} ${holding.symbol}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((left, right) => {
      const a = sort.field === 'value' ? left.currentValue : sort.field === 'change24h' ? left.priceChange24h : sort.field === 'amount' ? left.amount : left.unrealizedPnLPercentage;
      const b = sort.field === 'value' ? right.currentValue : sort.field === 'change24h' ? right.priceChange24h : sort.field === 'amount' ? right.amount : right.unrealizedPnLPercentage;
      const difference = (a ?? Number.NEGATIVE_INFINITY) - (b ?? Number.NEGATIVE_INFINITY);
      return sort.direction === 'desc' ? -difference : difference;
    }), [holdings, query, sort]);

  const sortButton = (field: SortField, label: string) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={`Sắp xếp theo ${label}`}
      className="-ml-3 h-8 gap-1 px-3 font-medium text-muted-foreground hover:text-foreground"
      onClick={() => setSort((current) => ({ field, direction: current.field === field && current.direction === 'desc' ? 'asc' : 'desc' }))}
    >
      {label}
      {sort.field === field ? sort.direction === 'desc' ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" /> : <ArrowUpDown className="size-3.5" />}
    </Button>
  );

  async function saveNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteTarget) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/portfolio/holdings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
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
      onRefresh?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không xóa được lịch sử giao dịch.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Danh mục tài sản</CardTitle>
          <CardDescription>{visibleHoldings.length} tài sản · giá trị từ dữ liệu thị trường trực tiếp</CardDescription>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Tìm tài sản" type="search" placeholder="Tìm theo tên hoặc mã…" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" />
        </div>
      </CardHeader>
      {error && <div className="px-6 pb-4"><Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert></div>}
      <CardContent className="p-0">
        {isMobile ? (
          <div className="divide-y" aria-label="Danh mục tài sản dạng lưới">
            {loading ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">Đang tải danh mục…</p>
              : visibleHoldings.length === 0 ? <div className="px-4 py-10 text-center"><Coins className="mx-auto mb-2 size-5 text-muted-foreground" /><p className="text-sm text-muted-foreground">{query ? 'Không tìm thấy tài sản phù hợp.' : 'Chưa có tài sản. Hãy thêm ví hoặc giao dịch đầu tiên.'}</p></div>
              : visibleHoldings.map((holding) => {
                const positive = (holding.priceChange24h ?? 0) >= 0;
                const pnlPositive = (holding.unrealizedPnL ?? 0) >= 0;
                return <article key={holding.id} className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 text-sm">
                  <div className="col-span-2 flex min-w-0 items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted font-mono text-[10px] font-semibold">{holding.symbol.slice(0, 4)}</div><div className="min-w-0"><p className="truncate font-medium">{holding.name}</p><p className="text-xs text-muted-foreground">{holding.symbol}</p></div></div>{holding.priceChange24h !== null && <Badge variant="outline" className={positive ? 'border-emerald-500/30 text-emerald-500' : 'border-destructive/40 text-destructive'}>{positive ? '+' : ''}{holding.priceChange24h.toFixed(2)}%</Badge>}</div>
                  <div><p className="text-xs text-muted-foreground">Giá trị</p><p className="font-medium tabular-nums">{holding.currentValue === null ? 'Chưa định giá' : currency(holding.currentValue)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Số lượng</p><p className="font-mono tabular-nums">{holding.amount.toLocaleString('en-US', { maximumFractionDigits: 8 })} {holding.symbol}</p></div>
                  <div><p className="text-xs text-muted-foreground">Lãi / lỗ</p><p className={`font-mono tabular-nums ${pnlPositive ? 'text-emerald-500' : 'text-destructive'}`}>{holding.unrealizedPnL === null || holding.unrealizedPnLPercentage === null ? 'Chưa định giá' : `${pnlPositive ? '+' : ''}${currency(holding.unrealizedPnL)}`}</p></div>
                  <div><p className="text-xs text-muted-foreground">Giá vốn TB</p><p className="font-mono tabular-nums">{currency(holding.avgBuyPrice)}</p></div>
                  <div className="col-span-2 flex justify-end gap-1 border-t pt-2">{onSelectCoin && <Button type="button" variant="ghost" size="icon" aria-label={`Xem biểu đồ ${holding.symbol}`} onClick={() => onSelectCoin(holding.coinId)}><ChartNoAxesCombined className="size-4" /></Button>}{onAddTransaction && <Button type="button" variant="outline" size="sm" aria-label={`Thêm giao dịch ${holding.symbol}`} onClick={() => onAddTransaction(holding)}><Plus className="size-3.5" />Giao dịch</Button>}<Button type="button" variant="ghost" size="icon" aria-label={`Sửa ghi chú ${holding.symbol}`} onClick={() => { setNoteTarget(holding); setNote(holding.notes ?? ''); setError(null); }}><Pencil className="size-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Xóa lịch sử ${holding.symbol}`} className="text-muted-foreground hover:text-destructive" onClick={() => { setDeleteTarget(holding); setError(null); }}><Trash2 className="size-4" /></Button></div>
                </article>;
              })}
          </div>
        ) : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tài sản</TableHead>
            <TableHead className="text-right">{sortButton('value', 'Giá trị')}</TableHead>
            <TableHead className="text-right">{sortButton('change24h', '24h')}</TableHead>
            <TableHead className="text-right">{sortButton('amount', 'Số lượng')}</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Giá vốn TB</TableHead>
            <TableHead className="text-right">{sortButton('pnl', 'Lãi / lỗ')}</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Đang tải danh mục…</TableCell></TableRow>
              : visibleHoldings.length === 0 ? <TableRow><TableCell colSpan={7} className="h-32 text-center">
                <Coins className="mx-auto mb-2 size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{query ? 'Không tìm thấy tài sản phù hợp.' : 'Chưa có tài sản. Hãy thêm ví hoặc giao dịch đầu tiên.'}</p>
              </TableCell></TableRow>
                : visibleHoldings.map((holding) => {
                  const positive = (holding.priceChange24h ?? 0) >= 0;
                  const pnlPositive = (holding.unrealizedPnL ?? 0) >= 0;
                  return <TableRow key={holding.id}>
                    <TableCell>
                      <div className="flex min-w-36 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted font-mono text-xs font-semibold">{holding.symbol.slice(0, 4)}</div>
                        <div className="min-w-0"><div className="truncate font-medium">{holding.name}</div><div className="text-xs text-muted-foreground">{holding.symbol}</div></div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{holding.currentValue === null ? <span className="text-amber-500">Chưa định giá</span> : currency(holding.currentValue)}</TableCell>
                    <TableCell className="text-right">{holding.priceChange24h === null ? <span className="text-muted-foreground">—</span> : <Badge variant="outline" className={positive ? 'border-emerald-500/30 text-emerald-500' : 'border-destructive/40 text-destructive'}>{positive ? '+' : ''}{holding.priceChange24h.toFixed(2)}%</Badge>}</TableCell>
                    <TableCell className="text-right tabular-nums"><div>{holding.amount.toLocaleString('en-US', { maximumFractionDigits: 8 })}</div><div className="text-xs text-muted-foreground">{holding.symbol}</div></TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">{currency(holding.avgBuyPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">{holding.unrealizedPnL === null || holding.unrealizedPnLPercentage === null ? <span className="text-muted-foreground">Chưa định giá</span> : <><div className={pnlPositive ? 'text-emerald-500' : 'text-destructive'}>{pnlPositive ? '+' : ''}{currency(holding.unrealizedPnL)}</div><div className="text-xs text-muted-foreground">{pnlPositive ? '+' : ''}{holding.unrealizedPnLPercentage.toFixed(2)}%</div></>}</TableCell>
                    <TableCell><div className="flex justify-end gap-1">
                      {onSelectCoin && <Button type="button" variant="ghost" size="icon" aria-label={`Xem biểu đồ ${holding.symbol}`} onClick={() => onSelectCoin(holding.coinId)}><ChartNoAxesCombined className="size-4" /></Button>}
                      {onAddTransaction && <Button type="button" variant="outline" size="sm" aria-label={`Thêm giao dịch ${holding.symbol}`} onClick={() => onAddTransaction(holding)}><Plus className="size-3.5" /><span className="hidden xl:inline">Giao dịch</span></Button>}
                      <Button type="button" variant="ghost" size="icon" aria-label={`Sửa ghi chú ${holding.symbol}`} onClick={() => { setNoteTarget(holding); setNote(holding.notes ?? ''); setError(null); }}><Pencil className="size-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Xóa lịch sử ${holding.symbol}`} className="text-muted-foreground hover:text-destructive" onClick={() => { setDeleteTarget(holding); setError(null); }}><Trash2 className="size-4" /></Button>
                    </div></TableCell>
                  </TableRow>;
                })}
          </TableBody>
        </Table>
        )}
      </CardContent>
    </Card>

    <Dialog open={Boolean(noteTarget)} onOpenChange={(open) => { if (!open && !busy) setNoteTarget(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi chú {noteTarget?.name} ({noteTarget?.symbol})</DialogTitle>
          <DialogDescription>Lưu mục tiêu, kế hoạch DCA hoặc ghi chú cho vị thế này.</DialogDescription>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <form onSubmit={saveNote} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="holding-note">Ghi chú cho {noteTarget?.name}</Label><Textarea id="holding-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: DCA theo quý, mục tiêu chốt lời…" /></div>
          <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setNoteTarget(null)}>Hủy</Button><Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu ghi chú'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !busy) setDeleteTarget(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xóa toàn bộ lịch sử {deleteTarget?.symbol}?</DialogTitle>
          <DialogDescription>Thao tác này xóa các giao dịch {deleteTarget?.symbol} khỏi danh mục và không thể hoàn tác.</DialogDescription>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {deleteTarget && <div className="rounded-md border bg-muted/40 p-4 text-sm"><div className="flex justify-between gap-4"><span className="text-muted-foreground">Số lượng đang nắm giữ</span><span className="font-mono">{deleteTarget.amount} {deleteTarget.symbol}</span></div><div className="mt-2 flex justify-between gap-4"><span className="text-muted-foreground">Giá trị đã định giá</span><span className="font-mono">{deleteTarget.currentValue === null ? 'Chưa định giá' : currency(deleteTarget.currentValue)}</span></div></div>}
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setDeleteTarget(null)}>Hủy</Button><Button type="button" variant="destructive" disabled={busy} onClick={() => void deletePosition()}>{busy ? 'Đang xóa…' : 'Xóa lịch sử giao dịch'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
