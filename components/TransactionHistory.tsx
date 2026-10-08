'use client';

import React, { useState } from 'react';
import {
  Clock,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  CheckCircle,
} from 'lucide-react';
import { Transaction } from '@/lib/types';

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

  const formatCurrency = (val: number) => {
    if (baseCurrency === 'VND') {
      const vndVal = val * 25450;
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(vndVal);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa giao dịch này? Danh mục sẽ được tính toán lại.')) return;
    try {
      const res = await fetch(`/api/portfolio/transactions?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error(e);
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
            Mỗi giao dịch tự động tính toán lại chi phí vốn DCA và lãi lỗ ròng
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
                <tr key={tx.id} className="hover:bg-[#1c2128]">
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
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-[#21262d] transition-colors"
                      title="Xóa giao dịch"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
