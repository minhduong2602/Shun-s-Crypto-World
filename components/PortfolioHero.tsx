'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  PlusCircle,
  Sparkles,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Activity,
  Shield,
  Layers,
} from 'lucide-react';
import { PortfolioSummary } from '@/lib/types';

interface PortfolioHeroProps {
  summary: PortfolioSummary;
  baseCurrency: string;
  onOpenAddTransaction: () => void;
  onOpenWallets: () => void;
  onOpenAi: () => void;
  onOpenAlerts: () => void;
}

export const PortfolioHero: React.FC<PortfolioHeroProps> = ({
  summary,
  baseCurrency,
  onOpenAddTransaction,
  onOpenWallets,
  onOpenAi,
  onOpenAlerts,
}) => {
  const isPositivePnL = summary.totalProfitLossUsd >= 0;
  const isPositive24h = summary.change24hUsd >= 0;

  const formatCurrency = (val: number) => {
    if (baseCurrency === 'VND') {
      const vndVal = val * 25450;
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(vndVal);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  return (
    <div className="bg-gradient-to-b from-[#161b22] to-[#0d1117] border border-[#30363d] rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden mb-8">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
      <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left: Balance & PnL */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Tổng giá trị tài sản ròng
            </span>
            <span className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-300 rounded-full font-mono border border-slate-700">
              {summary.holdingsCount} Token đang nắm giữ
            </span>
          </div>

          <div className="flex items-baseline space-x-4 flex-wrap">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white font-mono">
              {formatCurrency(summary.totalValueUsd)}
            </h1>

            {/* 24h Change Badge */}
            <div
              className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold font-mono ${
                isPositive24h
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              {isPositive24h ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              <span>
                {isPositive24h ? '+' : ''}
                {formatCurrency(summary.change24hUsd)} ({isPositive24h ? '+' : ''}
                {summary.change24hPercentage.toFixed(2)}%) 24h
              </span>
            </div>
          </div>

          {/* All time PnL & Invested Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 text-xs">
            <div className="bg-[#0d1117]/80 p-3 rounded-xl border border-[#21262d]">
              <span className="text-slate-400 block mb-0.5">Tổng vốn đầu tư (DCA):</span>
              <span className="font-semibold text-slate-200 font-mono text-sm">
                {formatCurrency(summary.totalInvestedUsd)}
              </span>
            </div>

            <div className="bg-[#0d1117]/80 p-3 rounded-xl border border-[#21262d]">
              <span className="text-slate-400 block mb-0.5">Lợi nhuận ròng (PnL):</span>
              <div className="flex items-center space-x-1">
                {isPositivePnL ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span
                  className={`font-bold font-mono text-sm ${
                    isPositivePnL ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isPositivePnL ? '+' : ''}
                  {formatCurrency(summary.totalProfitLossUsd)} (
                  {isPositivePnL ? '+' : ''}
                  {summary.totalProfitLossPercentage.toFixed(2)}%)
                </span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-[#0d1117]/80 p-3 rounded-xl border border-[#21262d]">
              <span className="text-slate-400 block mb-0.5">Hiệu suất cao nhất:</span>
              <span className="font-semibold text-emerald-400 font-mono text-sm">
                {summary.bestPerformer?.symbol || 'BTC'}: +
                {summary.bestPerformer?.gainPercentage.toFixed(1) || '0.0'}%
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex flex-wrap lg:flex-col gap-2.5 w-full lg:w-auto">
          <button
            onClick={onOpenAddTransaction}
            className="flex-1 lg:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Thêm giao dịch</span>
          </button>

          <button
            onClick={onOpenWallets}
            className="flex-1 lg:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-slate-200 hover:text-white font-medium text-sm border border-slate-700/60 transition-all"
          >
            <Wallet className="w-4 h-4 text-cyan-400" />
            <span>Ví View-Only</span>
          </button>

          <button
            onClick={onOpenAi}
            className="flex-1 lg:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-900/40 to-blue-900/40 hover:from-cyan-800/50 hover:to-blue-800/50 text-cyan-300 font-medium text-sm border border-cyan-500/30 transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Khám bệnh AI</span>
          </button>

          <button
            onClick={onOpenAlerts}
            className="flex-1 lg:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-[#21262d]/60 hover:bg-[#30363d] text-slate-300 hover:text-white font-medium text-sm border border-slate-700/40 transition-all"
          >
            <Activity className="w-4 h-4 text-amber-400" />
            <span>Cảnh báo giá</span>
          </button>
        </div>
      </div>
    </div>
  );
};
