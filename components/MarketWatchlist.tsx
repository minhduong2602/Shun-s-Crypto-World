'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Star,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { MarketTicker } from '@/lib/types';

interface MarketWatchlistProps {
  tickers: MarketTicker[];
  baseCurrency: string;
  onSelectCoinForChart: (coinId: string) => void;
  onOpenAddTransaction: () => void;
}

export const MarketWatchlist: React.FC<MarketWatchlistProps> = ({
  tickers,
  baseCurrency,
  onSelectCoinForChart,
  onOpenAddTransaction,
}) => {
  const [search, setSearch] = useState('');

  const formatCurrency = (val: number) => {
    if (baseCurrency === 'VND') {
      const vndVal = val * 25450;
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(vndVal);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const filtered = tickers.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.symbol.toLowerCase().includes(search.toLowerCase())
  );

  const renderSparkline = (points: number[], isPositive: boolean) => {
    if (!points || points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const width = 110;
    const height = 32;

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
      <div className="p-6 border-b border-[#21262d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>Bảng Giá Thị Trường Toàn Cầu</span>
            <span className="text-xs font-normal text-slate-400">
              (Phong cách CoinMarketCap)
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Dữ liệu giá theo thời gian thực được cập nhật từ Binance &amp; CoinGecko
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm kiếm tiền mã hóa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-60 pl-9 pr-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#0d1117] text-slate-400 font-semibold border-b border-[#21262d]">
              <th className="py-3.5 px-4 w-12 text-center">#</th>
              <th className="py-3.5 px-4">Tên</th>
              <th className="py-3.5 px-4">Giá</th>
              <th className="py-3.5 px-4">1h %</th>
              <th className="py-3.5 px-4">24h %</th>
              <th className="py-3.5 px-4">7d %</th>
              <th className="py-3.5 px-4">Vốn hóa thị trường</th>
              <th className="py-3.5 px-4">Khối lượng 24h</th>
              <th className="py-3.5 px-4 hidden md:table-cell">Xu hướng 7 ngày</th>
              <th className="py-3.5 px-4 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d] text-slate-300">
            {filtered.map((item) => {
              const is24hUp = item.priceChange24h >= 0;
              const is7dUp = item.priceChange7d >= 0;
              const is1hUp = item.priceChange1h >= 0;

              return (
                <tr
                  key={item.id}
                  className="hover:bg-[#1c2128] transition-colors cursor-pointer group"
                  onClick={() => onSelectCoinForChart(item.symbol)}
                >
                  <td className="py-4 px-4 text-center font-mono text-slate-500">{item.rank}</td>

                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white text-[10px] border border-slate-700">
                        {item.symbol.slice(0, 3)}
                      </div>
                      <div>
                        <div className="font-bold text-white flex items-center space-x-1.5">
                          <span>{item.name}</span>
                          <span className="text-slate-400 font-mono text-[11px]">{item.symbol}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-4 font-mono font-bold text-white">
                    {formatCurrency(item.priceUsd)}
                  </td>

                  <td className="py-4 px-4 font-mono">
                    <span className={is1hUp ? 'text-emerald-400' : 'text-rose-400'}>
                      {is1hUp ? '+' : ''}
                      {item.priceChange1h.toFixed(2)}%
                    </span>
                  </td>

                  <td className="py-4 px-4 font-mono">
                    <span
                      className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        is24hUp ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                      }`}
                    >
                      {is24hUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      <span>
                        {is24hUp ? '+' : ''}
                        {item.priceChange24h.toFixed(2)}%
                      </span>
                    </span>
                  </td>

                  <td className="py-4 px-4 font-mono">
                    <span className={is7dUp ? 'text-emerald-400' : 'text-rose-400'}>
                      {is7dUp ? '+' : ''}
                      {item.priceChange7d.toFixed(2)}%
                    </span>
                  </td>

                  <td className="py-4 px-4 font-mono text-slate-200">
                    ${(item.marketCapUsd / 1e9).toFixed(2)}B
                  </td>

                  <td className="py-4 px-4 font-mono text-slate-200">
                    ${(item.volume24hUsd / 1e6).toFixed(2)}M
                  </td>

                  <td className="py-4 px-4 hidden md:table-cell">
                    {renderSparkline(item.sparkline7d, is7dUp)}
                  </td>

                  <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={onOpenAddTransaction}
                      className="px-2 py-1 rounded bg-[#21262d] hover:bg-emerald-500 hover:text-slate-950 text-slate-200 transition-colors inline-flex items-center space-x-1"
                      title="Thêm vào danh mục của tôi"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Mua</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
