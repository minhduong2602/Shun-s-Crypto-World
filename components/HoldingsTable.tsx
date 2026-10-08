'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  ChevronRight,
  Edit2,
  Trash2,
  Save,
  X,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Holding } from '@/lib/types';

interface HoldingsTableProps {
  holdings: Holding[];
  baseCurrency: string;
  onSelectCoinForChart: (coinId: string) => void;
  onAddTransactionForCoin: (coin: Holding) => void;
  onRefresh?: () => void;
}

export const HoldingsTable: React.FC<HoldingsTableProps> = ({
  holdings,
  baseCurrency,
  onSelectCoinForChart,
  onAddTransactionForCoin,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'change24h' | 'amount'>('value');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // Edit note state
  const [coinToEditNote, setCoinToEditNote] = useState<Holding | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Delete holding state
  const [coinToDelete, setCoinToDelete] = useState<Holding | null>(null);
  const [isDeletingHolding, setIsDeletingHolding] = useState(false);

  const formatCurrency = (val: number) => {
    if (baseCurrency === 'VND') {
      const vndVal = val * 25450;
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(vndVal);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const handleSort = (type: 'value' | 'pnl' | 'change24h' | 'amount') => {
    if (sortBy === type) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(type);
      setSortDirection('desc');
    }
  };

  const handleOpenEditNote = (coin: Holding, e: React.MouseEvent) => {
    e.stopPropagation();
    setCoinToEditNote(coin);
    setEditNoteText(coin.notes || '');
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coinToEditNote) return;
    setIsSavingNote(true);
    try {
      const res = await fetch('/api/portfolio/holdings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinId: coinToEditNote.coinId,
          symbol: coinToEditNote.symbol,
          notes: editNoteText.trim(),
        }),
      });
      if (res.ok) {
        setCoinToEditNote(null);
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleOpenDeleteHolding = (coin: Holding, e: React.MouseEvent) => {
    e.stopPropagation();
    setCoinToDelete(coin);
  };

  const handleConfirmDeleteHolding = async () => {
    if (!coinToDelete) return;
    setIsDeletingHolding(true);
    try {
      const res = await fetch(`/api/portfolio/holdings?coinId=${encodeURIComponent(coinToDelete.coinId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCoinToDelete(null);
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingHolding(false);
    }
  };

  const filteredHoldings = holdings
    .filter(
      (h) =>
        h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'value') comparison = b.currentValue - a.currentValue;
      if (sortBy === 'pnl') comparison = b.unrealizedPnLPercentage - a.unrealizedPnLPercentage;
      if (sortBy === 'change24h') comparison = b.priceChange24h - a.priceChange24h;
      if (sortBy === 'amount') comparison = b.amount - a.amount;
      return sortDirection === 'desc' ? comparison : -comparison;
    });

  // Mini SVG sparkline renderer
  const renderSparkline = (points: number[], isPositive: boolean) => {
    if (!points || points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const width = 120;
    const height = 36;

    const pathData = points
      .map((p, idx) => {
        const x = (idx / (points.length - 1)) * width;
        const y = height - ((p - min) / range) * (height - 6) - 3;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const strokeColor = isPositive ? '#10b981' : '#f43f5e';

    return (
      <svg width={width} height={height} className="overflow-visible">
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-xl">
      {/* Header filter & search */}
      <div className="p-4 sm:p-6 border-b border-[#21262d] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>Danh mục tài sản</span>
            <span className="text-xs font-normal text-slate-400">
              ({filteredHoldings.length} tài sản)
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Dữ liệu định giá theo thời gian thực chuẩn phong cách CoinMarketCap — Cho phép thêm giao dịch, sửa ghi chú và đóng vị thế
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc mã (BTC, SOL...)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Table responsive container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#0d1117] text-slate-400 font-semibold border-b border-[#21262d]">
              <th className="py-3.5 px-4">Tài sản</th>
              <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('value')}>
                <div className="flex items-center space-x-1">
                  <span>Giá hiện tại</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('change24h')}>
                <div className="flex items-center space-x-1">
                  <span>Biến động 24h</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('amount')}>
                <div className="flex items-center space-x-1">
                  <span>Đang nắm giữ</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3.5 px-4">Giá vốn DCA</th>
              <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('pnl')}>
                <div className="flex items-center space-x-1">
                  <span>Lãi / Lỗ (PnL)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3.5 px-4">Tỷ trọng</th>
              <th className="py-3.5 px-4 hidden md:table-cell">Xu hướng 7 ngày</th>
              <th className="py-3.5 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d] text-slate-300">
            {filteredHoldings.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <Coins className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p>Không tìm thấy tài sản nào phù hợp.</p>
                </td>
              </tr>
            ) : (
              filteredHoldings.map((coin) => {
                const is24hUp = coin.priceChange24h >= 0;
                const isPnLUp = coin.unrealizedPnL >= 0;

                return (
                  <tr
                    key={coin.id}
                    className="hover:bg-[#1c2128] transition-colors group cursor-pointer"
                    onClick={() => onSelectCoinForChart(coin.symbol)}
                  >
                    {/* Coin name & symbol */}
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 flex items-center justify-center font-bold text-white text-[11px] border border-slate-600/50 shadow-sm">
                          {coin.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center space-x-1.5">
                            <span>{coin.name}</span>
                            <span className="text-slate-400 font-mono text-[11px]">{coin.symbol}</span>
                          </div>
                          {coin.notes ? (
                            <span className="text-[10px] text-slate-400 line-clamp-1 max-w-[140px]" title={coin.notes}>
                              {coin.notes}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">Chưa có ghi chú</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Current Price */}
                    <td className="py-4 px-4 font-mono font-semibold text-white">
                      {formatCurrency(coin.currentPrice)}
                    </td>

                    {/* 24h Change */}
                    <td className="py-4 px-4 font-mono">
                      <div
                        className={`inline-flex items-center space-x-0.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                          is24hUp ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                        }`}
                      >
                        {is24hUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        <span>
                          {is24hUp ? '+' : ''}
                          {coin.priceChange24h.toFixed(2)}%
                        </span>
                      </div>
                    </td>

                    {/* Holdings amount & value */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-white font-mono">
                        {formatCurrency(coin.currentValue)}
                      </div>
                      <div className="text-slate-400 font-mono text-[11px]">
                        {coin.amount} {coin.symbol}
                      </div>
                    </td>

                    {/* Avg Buy Price */}
                    <td className="py-4 px-4 font-mono">
                      <div className="text-slate-200">{formatCurrency(coin.avgBuyPrice)}</div>
                      <div className="text-[10px] text-slate-400">
                        Vốn: {formatCurrency(coin.totalInvested)}
                      </div>
                    </td>

                    {/* Unrealized PnL */}
                    <td className="py-4 px-4 font-mono">
                      <div className={`font-bold ${isPnLUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPnLUp ? '+' : ''}
                        {formatCurrency(coin.unrealizedPnL)}
                      </div>
                      <div className={`text-[10px] font-semibold ${isPnLUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPnLUp ? '+' : ''}
                        {coin.unrealizedPnLPercentage.toFixed(2)}%
                      </div>
                    </td>

                    {/* Allocation */}
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-white text-xs w-10">
                          {coin.allocationPercentage}%
                        </span>
                        <div className="w-16 h-1.5 bg-[#0d1117] rounded-full overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, coin.allocationPercentage)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* 7d Sparkline */}
                    <td className="py-4 px-4 hidden md:table-cell">
                      {renderSparkline(coin.sparkline7d, is24hUp)}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => onAddTransactionForCoin(coin)}
                          className="px-2 py-1 rounded bg-[#21262d] hover:bg-emerald-500 hover:text-slate-950 text-slate-200 transition-colors flex items-center space-x-1 text-[11px] font-medium"
                          title="Ghi thêm lệnh mua/bán cho coin này"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Giao dịch</span>
                        </button>
                        <button
                          onClick={(e) => handleOpenEditNote(coin, e)}
                          className="p-1.5 rounded text-slate-400 hover:text-cyan-400 hover:bg-[#21262d] transition-colors"
                          title="Sửa ghi chú / Kế hoạch chốt lời"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleOpenDeleteHolding(coin, e)}
                          className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-[#21262d] transition-colors"
                          title="Đóng vị thế / Xóa tài sản này khỏi danh mục"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Note Modal */}
      {coinToEditNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setCoinToEditNote(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 pb-3 border-b border-[#21262d]">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Edit2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Ghi chú &amp; Chiến lược ({coinToEditNote.symbol})</h4>
                <p className="text-xs text-slate-400">Đặt mục tiêu chốt lời, DCA hoặc kế hoạch nắm giữ</p>
              </div>
            </div>

            <form onSubmit={handleSaveNote} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nội dung ghi chú</label>
                <textarea
                  rows={3}
                  value={editNoteText}
                  onChange={(e) => setEditNoteText(e.target.value)}
                  placeholder="VD: Target bán 50% ở $120k, giữ 50% staking..."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl p-3 text-white text-xs focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setCoinToEditNote(null)}
                  className="px-4 py-2 rounded-xl bg-[#21262d] text-slate-300 hover:text-white font-medium text-xs transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingNote}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-md"
                >
                  {isSavingNote ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Lưu ghi chú</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Holding Confirmation Modal */}
      {coinToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center space-x-3 text-rose-400 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Đóng vị thế {coinToDelete.symbol}?</h4>
                <p className="text-xs text-slate-400">Hành động này sẽ xóa các lệnh giao dịch của đồng coin này</p>
              </div>
            </div>

            <div className="bg-[#0d1117] p-3 rounded-xl border border-[#21262d] text-xs space-y-1.5 my-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Tài sản:</span>
                <span className="font-bold text-white font-mono">{coinToDelete.name} ({coinToDelete.symbol})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Số lượng đang có:</span>
                <span className="font-mono text-slate-200">{coinToDelete.amount} {coinToDelete.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Giá trị hiện tại:</span>
                <span className="font-mono font-bold text-emerald-400">{formatCurrency(coinToDelete.currentValue)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setCoinToDelete(null)}
                disabled={isDeletingHolding}
                className="px-4 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-slate-300 text-xs font-medium transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteHolding}
                disabled={isDeletingHolding}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-md disabled:opacity-50"
              >
                {isDeletingHolding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Xóa vị thế</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
