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
} from 'lucide-react';
import { Holding } from '@/lib/types';

interface HoldingsTableProps {
  holdings: Holding[];
  baseCurrency: string;
  onSelectCoinForChart: (coinId: string) => void;
  onAddTransactionForCoin: (coin: Holding) => void;
}

export const HoldingsTable: React.FC<HoldingsTableProps> = ({
  holdings,
  baseCurrency,
  onSelectCoinForChart,
  onAddTransactionForCoin,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'change24h' | 'amount'>('value');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

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
            Dữ liệu định giá theo thời gian thực chuẩn phong cách CoinMarketCap
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
                          {coin.notes && (
                            <span className="text-[10px] text-slate-400 line-clamp-1 max-w-[140px]">
                              {coin.notes}
                            </span>
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
                          title="Ghi thêm giao dịch mua/bán"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Giao dịch</span>
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
    </div>
  );
};
