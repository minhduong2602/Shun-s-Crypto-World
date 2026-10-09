'use client';

import React, { useState } from 'react';
import {
  Clock,
  Trash2,
  Edit2,
  AlertTriangle,
  Save,
  RefreshCw,
  Download,
  FileUp,
} from 'lucide-react';
import { Transaction, TransactionType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildTransactionsCsv, type TransactionImportRow } from '@/lib/portfolio/transactions-csv';
import { formatPortfolioCurrency } from '@/lib/format-portfolio-currency';
import { useIsMobile } from '@/hooks/use-mobile';

interface TransactionImportPreview {
  rows: TransactionImportRow[];
  errors: Array<{ line: number; message: string }>;
  duplicates: Array<{ line: number; symbol: string; message: string }>;
  duplicateCount: number;
  warnings: Array<{ line: number; message: string }>;
  balanceError: string | null;
  canImport: boolean;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  baseCurrency: string;
  usdVndRate?: number | null;
  onRefresh: () => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  baseCurrency,
  usdVndRate,
  onRefresh,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const isMobile = useIsMobile();

  // Delete modal state
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Edit modal state
  const [txToEdit, setTxToEdit] = useState<Transaction | null>(null);
  const [editType, setEditType] = useState<TransactionType>('BUY');
  const [editAmount, setEditAmount] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editFee, setEditFee] = useState('0');
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importCsv, setImportCsv] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<TransactionImportPreview | null>(null);
  const [importError, setImportError] = useState('');
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const formatCurrency = (val: number) => formatPortfolioCurrency(val, baseCurrency, usdVndRate);

  const handleOpenDelete = (tx: Transaction) => {
    setDeleteError('');
    setTxToDelete(tx);
  };

  const handleConfirmDelete = async () => {
    if (!txToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/portfolio/transactions?id=${txToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setTxToDelete(null);
        onRefresh();
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'Không thể xóa giao dịch.');
      }
    } catch {
      setDeleteError('Không thể kết nối máy chủ để xóa giao dịch.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenEdit = (tx: Transaction) => {
    setTxToEdit(tx);
    setEditType(tx.type);
    setEditAmount(String(tx.amount));
    setEditPrice(String(tx.pricePerCoin));
    setEditFee(String(tx.fee || 0));
    setEditNotes(tx.notes || '');
    setEditDate(tx.executedAt ? new Date(tx.executedAt).toISOString().slice(0, 16) : '');
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txToEdit) return;

    const numAmount = Number(editAmount);
    const numPrice = Number(editPrice);
    const numFee = Number(editFee || 0);

    if (numAmount <= 0 || numPrice <= 0) {
      setEditError('Số lượng và đơn giá phải lớn hơn 0');
      return;
    }

    setIsSaving(true);
    setEditError('');

    try {
      const res = await fetch('/api/portfolio/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: txToEdit.id,
          type: editType,
          amount: numAmount,
          pricePerCoin: numPrice,
          fee: numFee,
          notes: editNotes,
          executedAt: editDate ? new Date(editDate).toISOString() : txToEdit.executedAt,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTxToEdit(null);
        onRefresh();
      } else {
        setEditError(data.error || 'Lỗi lưu thay đổi giao dịch');
      }
    } catch {
      setEditError('Lỗi kết nối máy chủ');
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = transactions.filter((t) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'TRANSFER') return t.type === 'TRANSFER_IN' || t.type === 'TRANSFER_OUT';
    return t.type === filterType;
  });

  const downloadCsv = () => {
    const csv = buildTransactionsCsv(transactions);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `crypto-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const resetImport = () => {
    setImportCsv(null);
    setImportPreview(null);
    setImportError('');
    setIsPreviewingImport(false);
    setIsImporting(false);
  };

  const handleCsvFile = async (file?: File) => {
    resetImport();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 1_000_000) {
      setImportError(file.size > 1_000_000 ? 'File CSV vượt quá giới hạn 1 MB.' : 'Vui lòng chọn file có đuôi .csv.');
      return;
    }
    setIsPreviewingImport(true);
    try {
      const csv = await file.text();
      setImportCsv(csv);
      const response = await fetch('/api/portfolio/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, mode: 'preview' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể xem trước file CSV.');
      setImportPreview(data as TransactionImportPreview);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Không thể đọc file CSV.');
    } finally {
      setIsPreviewingImport(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importCsv || !importPreview?.canImport) return;
    setIsImporting(true);
    setImportError('');
    try {
      const response = await fetch('/api/portfolio/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: importCsv, mode: 'import' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể nhập giao dịch.');
      setImportOpen(false);
      resetImport();
      onRefresh();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Không thể nhập giao dịch.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="mt-8 overflow-hidden">
      <CardHeader className="flex flex-col gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Lịch sử giao dịch</span>
          </CardTitle>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={filterType} onValueChange={setFilterType}>
            <TabsList aria-label="Lọc lịch sử giao dịch" className="h-auto flex-wrap justify-start">
              {['ALL', 'BUY', 'SELL', 'TRANSFER'].map((f) => (
                <TabsTrigger value={f} className="text-xs" key={f}>
                  {f === 'ALL' ? 'Tất cả' : f === 'BUY' ? 'Mua' : f === 'SELL' ? 'Bán' : 'Nạp/Rút'}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button type="button" variant="outline" size="sm" onClick={() => { resetImport(); setImportOpen(true); }}>
            <FileUp className="size-3.5" />Nhập CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={downloadCsv} disabled={transactions.length === 0}>
            <Download className="size-3.5" />Xuất CSV
          </Button>
        </div>
      </CardHeader>

      {isMobile ? (
        <div className="divide-y" aria-label="Lịch sử giao dịch dạng lưới">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Không có giao dịch nào phù hợp.</p>
          ) : filtered.map((tx) => (
            <article key={tx.id} className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 text-sm">
              <div className="col-span-2 flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0"><p className="font-mono font-semibold">{tx.symbol}</p><p className="truncate text-xs text-muted-foreground">{tx.name}</p></div>
                <Badge variant={tx.type === 'SELL' ? 'destructive' : 'outline'} className={tx.type === 'BUY' ? 'border-emerald-500/40 text-emerald-500' : ''}>{tx.type}</Badge>
              </div>
              <div><p className="text-xs text-muted-foreground">Số lượng</p><p className="font-mono">{tx.amount} {tx.symbol}</p></div>
              <div><p className="text-xs text-muted-foreground">Tổng tiền</p><p className="font-mono font-semibold">{formatCurrency(tx.totalAmount)}</p></div>
              <div><p className="text-xs text-muted-foreground">Đơn giá</p><p className="font-mono">{formatCurrency(tx.pricePerCoin)}</p></div>
              <div><p className="text-xs text-muted-foreground">Thời gian</p><p className="font-mono text-xs">{new Date(tx.executedAt).toLocaleDateString('vi-VN')} · {new Date(tx.executedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p></div>
              {tx.notes && <p className="col-span-2 truncate text-xs text-muted-foreground">{tx.notes}</p>}
              <div className="col-span-2 flex justify-end gap-1 border-t pt-2">
                <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(tx)} aria-label={`Chỉnh sửa giao dịch ${tx.symbol}`} title="Chỉnh sửa giao dịch"><Edit2 className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleOpenDelete(tx)} aria-label={`Xóa giao dịch ${tx.symbol}`} title="Xóa giao dịch"><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
      <div className="min-w-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thời gian</TableHead><TableHead>Loại</TableHead><TableHead>Tài sản</TableHead><TableHead>Số lượng</TableHead><TableHead>Đơn giá</TableHead><TableHead>Tổng tiền</TableHead><TableHead>Ghi chú</TableHead><TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Không có giao dịch nào phù hợp.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono text-muted-foreground">
                    {new Date(tx.executedAt).toLocaleDateString('vi-VN')} {new Date(tx.executedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </TableCell>

                  <TableCell>
                    <Badge variant={tx.type === 'SELL' ? 'destructive' : 'outline'} className={tx.type === 'BUY' ? 'border-emerald-500/40 text-emerald-500' : ''}>
                      {tx.type}
                    </Badge>
                  </TableCell>

                  <TableCell className="font-bold font-mono">
                    {tx.symbol}
                  </TableCell>

                  <TableCell className="font-mono">
                    {tx.amount} {tx.symbol}
                  </TableCell>

                  <TableCell className="font-mono">
                    {formatCurrency(tx.pricePerCoin)}
                  </TableCell>

                  <TableCell className="font-mono font-bold">
                    {formatCurrency(tx.totalAmount)}
                  </TableCell>

                  <TableCell className="max-w-[180px] truncate text-muted-foreground text-xs">
                    {tx.notes || '—'}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <Button variant="ghost" size="icon"
                        onClick={() => handleOpenEdit(tx)}
                        title="Chỉnh sửa giao dịch"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon"
                        onClick={() => handleOpenDelete(tx)}
                        title="Xóa giao dịch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      )}

      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) resetImport(); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nhập giao dịch từ CSV</DialogTitle>
            <DialogDescription>Chọn bản sao lưu được xuất từ ứng dụng. Các dòng sai sẽ chặn toàn bộ lần nhập; giao dịch trùng được tự động bỏ qua.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="transaction-csv-file">File CSV giao dịch</Label>
            <Input
              id="transaction-csv-file"
              type="file"
              accept=".csv,text/csv"
              disabled={isPreviewingImport || isImporting}
              onChange={(event) => void handleCsvFile(event.target.files?.[0])}
            />
            <p className="text-xs text-muted-foreground">Tối đa 500 giao dịch và 1 MB mỗi lần. File sẽ được kiểm tra trước khi ghi.</p>
          </div>

          {isPreviewingImport && <Alert><AlertDescription>Đang đọc và kiểm tra giao dịch…</AlertDescription></Alert>}
          {importError && <Alert variant="destructive"><AlertDescription>{importError}</AlertDescription></Alert>}
          {importPreview && <div className="grid gap-3">
            {importPreview.errors.length > 0 && <Alert variant="destructive"><AlertDescription>
              <p>Có {importPreview.errors.length} dòng lỗi; chưa thể nhập dữ liệu:</p>
              <ul className="mt-2 list-inside list-disc">{importPreview.errors.slice(0, 10).map((item) => <li key={`${item.line}-${item.message}`}>Dòng {item.line}: {item.message}</li>)}</ul>
            </AlertDescription></Alert>}
            {importPreview.balanceError && <Alert variant="destructive"><AlertDescription>{importPreview.balanceError}</AlertDescription></Alert>}
            {importPreview.duplicateCount > 0 && <Alert><AlertDescription>{importPreview.duplicateCount} giao dịch trùng sẽ được bỏ qua.</AlertDescription></Alert>}
            {importPreview.warnings.length > 0 && <Alert><AlertDescription>
              <p>{importPreview.warnings.length} giao dịch sẽ không gắn với ví đã bị xóa hoặc không thuộc tài khoản này.</p>
            </AlertDescription></Alert>}
            <div className="max-h-64 overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Dòng</TableHead><TableHead>Thời gian</TableHead><TableHead>Loại</TableHead><TableHead>Tài sản</TableHead><TableHead>Số lượng</TableHead><TableHead>Tổng USD</TableHead></TableRow></TableHeader>
                <TableBody>
                  {importPreview.rows.length === 0 ? <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Không có giao dịch mới để nhập.</TableCell></TableRow> : importPreview.rows.slice(0, 100).map((row) => <TableRow key={row.line}>
                    <TableCell className="font-mono text-muted-foreground">{row.line}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(row.executedAt).toLocaleDateString('vi-VN')}</TableCell>
                    <TableCell><Badge variant={row.type === 'SELL' ? 'destructive' : 'outline'}>{row.type}</Badge></TableCell>
                    <TableCell className="font-medium">{row.name} <span className="text-muted-foreground">{row.symbol}</span></TableCell>
                    <TableCell className="font-mono">{row.amount}</TableCell>
                    <TableCell className="font-mono">{formatCurrency(row.totalAmount)}</TableCell>
                  </TableRow>)}
                </TableBody>
              </Table>
              {importPreview.rows.length > 100 && <p className="border-t p-2 text-center text-xs text-muted-foreground">Đang hiển thị 100 trên {importPreview.rows.length} dòng mới.</p>}
            </div>
          </div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)} disabled={isImporting}>Hủy</Button>
            <Button type="button" onClick={handleConfirmImport} disabled={!importPreview?.canImport || isPreviewingImport || isImporting}>
              {isImporting ? <RefreshCw className="size-4 animate-spin" /> : <FileUp className="size-4" />}
              {isImporting ? 'Đang nhập…' : `Nhập ${importPreview?.rows.length ?? 0} giao dịch`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Modal */}
      <Dialog open={!!txToEdit} onOpenChange={(open) => { if (!open) setTxToEdit(null); }}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {txToEdit && <>
            <DialogHeader>
              <DialogTitle>Chỉnh sửa giao dịch {txToEdit!.symbol}</DialogTitle>
              <DialogDescription>Cập nhật số lượng, giá khớp, thời gian hoặc ghi chú của lệnh.</DialogDescription>
            </DialogHeader>

            {editError && (
              <Alert className="mt-4" variant="destructive"><AlertDescription>{editError}</AlertDescription></Alert>
            )}

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4 text-xs">
              {/* Type selector */}
              <div>
                <Label className="mb-1 block">Loại giao dịch</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(['BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT'] as TransactionType[]).map((t) => (
                    <Button variant={editType === t ? 'default' : 'outline'} size="sm"
                      key={t}
                      type="button"
                      onClick={() => setEditType(t)}
                    >
                      {t === 'BUY' ? 'MUA' : t === 'SELL' ? 'BÁN' : t === 'TRANSFER_IN' ? 'NẠP' : 'RÚT'}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Amount & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block">Số lượng ({txToEdit!.symbol})</Label>
                  <Input
                    type="number"
                    step="any"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label className="mb-1 block">Đơn giá ($ USD)</Label>
                  <Input
                    type="number"
                    step="any"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>

              {/* Fee & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block">Phí giao dịch ($ USD)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={editFee}
                    onChange={(e) => setEditFee(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label className="mb-1 block">Thời gian thực hiện</Label>
                  <Input
                    type="datetime-local"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>

              {/* Total preview */}
              <div className="rounded-md border bg-muted/40 p-3 flex items-center justify-between">
                <span className="text-slate-400">Tổng giá trị quy đổi:</span>
                <span className="text-emerald-400 font-mono font-bold text-sm">
                  {formatCurrency(Number(editAmount || 0) * Number(editPrice || 0) + Number(editFee || 0))}
                </span>
              </div>

              {/* Notes */}
              <div>
                <Label className="mb-1 block">Ghi chú / Chiến lược</Label>
                <Textarea
                  placeholder="VD: DCA đợt 2, chốt lời 20%..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t">
                <Button variant="outline"
                  type="button"
                  onClick={() => setTxToEdit(null)}
                >
                  Hủy bỏ
                </Button>
                <Button type="submit" disabled={isSaving}
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Lưu thay đổi</span>
                </Button>
              </div>
            </form>
          </>}
          </DialogContent>
      </Dialog>

      {/* Delete Confirmation In-App Modal */}
      <Dialog open={!!txToDelete} onOpenChange={(open) => { if (!open) setTxToDelete(null); }}>
          <DialogContent className="max-w-md">
          {txToDelete && <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" />Xác nhận xóa giao dịch?</DialogTitle>
              <DialogDescription>Việc xóa sẽ tính lại số dư, giá vốn và lãi lỗ.</DialogDescription>
            </DialogHeader>

            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tài sản</span>
                <span className="font-medium font-mono">{txToDelete!.name} ({txToDelete!.symbol})</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Loại lệnh</span>
                <span className="font-medium">{txToDelete!.type}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Khối lượng</span>
                <span className="font-mono">{txToDelete!.amount} {txToDelete!.symbol}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tổng tiền</span>
                <span className="font-mono font-semibold">{formatCurrency(txToDelete!.totalAmount)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <Button variant="outline"
                type="button"
                onClick={() => setTxToDelete(null)}
                disabled={isDeleting}
              >
                Hủy
              </Button>
              <Button variant="destructive"
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Xác nhận xóa</span>
              </Button>
            </div>
            {deleteError && <Alert className="mt-4" variant="destructive"><AlertDescription>{deleteError}</AlertDescription></Alert>}
          </>}
          </DialogContent>
      </Dialog>
    </Card>
  );
};
