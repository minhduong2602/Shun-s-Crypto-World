'use client';

import React, { useState } from 'react';
import {
  Clock,
  Trash2,
  Edit2,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  CheckCircle,
  X,
  AlertTriangle,
  Save,
  RefreshCw,
  Coins,
} from 'lucide-react';
import { Transaction, TransactionType } from '@/lib/types';

interface TransactionHistoryProps {
  transactions: Transaction[];
  baseCurrency: string;
  onRefresh: () => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  baseCurrency,
  onRefresh,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');

  // Delete modal state
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const formatCurrency = (val: number) => {
    if (baseCurrency === 'VND') {
      const vndVal = val * 25450;
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(vndVal);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const handleOpenDelete = (tx: Transaction) => {
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
      }
    } catch (e) {
      console.error('Lỗi xóa giao dịch:', e);
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
    return t.type === filterType;
  });

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-xl mt-8">
      <div className="p-6 border-b border-[#21262d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Lịch Sử Giao Dịch &amp; Sổ Cái (Ledger)</span>
          </h3>
          <p className="text-xs text-slate-400">
            Hỗ trợ xem, sửa và xóa giao dịch — Danh mục tự động tính toán lại chi phí vốn DCA và lãi lỗ ròng
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center space-x-1 bg-[#0d1117] p-1 rounded-xl border border-[#30363d] text-xs">
          {['ALL', 'BUY', 'SELL', 'TRANSFER_IN'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filterType === f
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {f === 'ALL'
                ? 'Tất cả'
                : f === 'BUY'
                ? 'Mua'
                : f === 'SELL'
                ? 'Bán'
                : 'Nạp/Rút'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#0d1117] text-slate-400 font-semibold border-b border-[#21262d]">
              <th className="py-3 px-4">Thời gian</th>
              <th className="py-3 px-4">Loại</th>
              <th className="py-3 px-4">Tài sản</th>
              <th className="py-3 px-4">Số lượng</th>
              <th className="py-3 px-4">Đơn giá</th>
              <th className="py-3 px-4">Tổng tiền</th>
              <th className="py-3 px-4">Ghi chú</th>
              <th className="py-3 px-4 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d] text-slate-300">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  Không có giao dịch nào phù hợp.
                </td>
              </tr>
            ) : (
              filtered.map((tx) => (
                <tr key={tx.id} className="hover:bg-[#1c2128] transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    {new Date(tx.executedAt).toLocaleDateString('vi-VN')} {new Date(tx.executedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.type === 'BUY'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : tx.type === 'SELL'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {tx.type}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-bold text-white font-mono">
                    {tx.symbol}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-slate-200">
                    {tx.amount} {tx.symbol}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-slate-200">
                    {formatCurrency(tx.pricePerCoin)}
                  </td>

                  <td className="py-3.5 px-4 font-mono font-bold text-white">
                    {formatCurrency(tx.totalAmount)}
                  </td>

                  <td className="py-3.5 px-4 text-slate-400 text-[11px] truncate max-w-[180px]">
                    {tx.notes || '—'}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => handleOpenEdit(tx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-[#21262d] transition-colors"
                        title="Chỉnh sửa giao dịch"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(tx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-[#21262d] transition-colors"
                        title="Xóa giao dịch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Transaction Modal */}
      {txToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative my-8">
            <button
              onClick={() => setTxToEdit(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 pb-4 border-b border-[#21262d]">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Edit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Chỉnh sửa giao dịch {txToEdit.symbol}</h3>
                <p className="text-xs text-slate-400">Cập nhật số lượng, giá vốn hoặc ghi chú của lệnh</p>
              </div>
            </div>

            {editError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4 text-xs">
              {/* Type selector */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Loại giao dịch</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['BUY', 'SELL', 'TRANSFER_IN'] as TransactionType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditType(t)}
                      className={`py-2 rounded-xl font-bold transition-all border ${
                        editType === t
                          ? t === 'BUY'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : t === 'SELL'
                            ? 'bg-rose-500 text-white border-rose-400'
                            : 'bg-blue-500 text-white border-blue-400'
                          : 'bg-[#0d1117] text-slate-400 border-[#30363d] hover:text-white'
                      }`}
                    >
                      {t === 'BUY' ? 'MUA' : t === 'SELL' ? 'BÁN' : 'NẠP'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Số lượng ({txToEdit.symbol})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Đơn giá ($ USD)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Fee & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Phí giao dịch ($ USD)</label>
                  <input
                    type="number"
                    step="any"
                    value={editFee}
                    onChange={(e) => setEditFee(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Thời gian thực hiện</label>
                  <input
                    type="datetime-local"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Total preview */}
              <div className="p-3 bg-[#0d1117] rounded-xl border border-[#21262d] flex items-center justify-between">
                <span className="text-slate-400">Tổng giá trị quy đổi:</span>
                <span className="text-emerald-400 font-mono font-bold text-sm">
                  {formatCurrency(Number(editAmount || 0) * Number(editPrice || 0) + Number(editFee || 0))}
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Ghi chú / Chiến lược</label>
                <input
                  type="text"
                  placeholder="VD: DCA đợt 2, chốt lời 20%..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#21262d]">
                <button
                  type="button"
                  onClick={() => setTxToEdit(null)}
                  className="px-4 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-slate-300 font-medium transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center space-x-1.5 transition-colors shadow-md disabled:opacity-50"
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation In-App Modal */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center space-x-3 text-rose-400 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Xác nhận xóa giao dịch?</h4>
                <p className="text-xs text-slate-400">Hành động này sẽ cập nhật lại giá vốn và lãi lỗ</p>
              </div>
            </div>

            <div className="bg-[#0d1117] p-3 rounded-xl border border-[#21262d] text-xs space-y-1.5 my-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Tài sản:</span>
                <span className="font-bold text-white font-mono">{txToDelete.name} ({txToDelete.symbol})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Loại lệnh:</span>
                <span className="font-bold text-white">{txToDelete.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Khối lượng:</span>
                <span className="font-mono text-slate-200">{txToDelete.amount} {txToDelete.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tổng tiền:</span>
                <span className="font-mono font-bold text-emerald-400">{formatCurrency(txToDelete.totalAmount)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-slate-300 text-xs font-medium transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-md disabled:opacity-50"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
