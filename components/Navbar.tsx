'use client';

import React from 'react';
import {
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Send,
  Sparkles,
  PieChart,
  BarChart2,
  Wallet,
  Bell,
  Lock,
  Flame,
  Zap,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  twoFactorEnabled: boolean;
  onOpen2FA: () => void;
  onOpenTelegram: () => void;
  telegramConfigured: boolean;
  globalMetrics?: {
    totalMarketCapUsd: number;
    totalVolume24hUsd: number;
    btcDominance: number;
    gasGwei: number;
    fearAndGreedIndex: number;
    sentimentText: string;
  };
  baseCurrency: string;
  onToggleCurrency: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  twoFactorEnabled,
  onOpen2FA,
  onOpenTelegram,
  telegramConfigured,
  globalMetrics,
  baseCurrency,
  onToggleCurrency,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0d1117]/95 backdrop-blur-md border-b border-[#21262d] text-slate-200">
      {/* Top mini banner with Global Crypto Metrics (CoinMarketCap style) */}
      <div className="hidden lg:flex items-center justify-between px-6 py-1.5 text-xs text-slate-400 border-b border-[#1f242c] overflow-x-auto">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">Cryptos:</span>
            <span className="text-blue-400 font-medium">14,280+</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">Vốn hóa thị trường:</span>
            <span className="text-slate-200 font-medium">
              ${((globalMetrics?.totalMarketCapUsd || 3150000000000) / 1e12).toFixed(2)}T
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">Volume 24h:</span>
            <span className="text-slate-200 font-medium">
              ${((globalMetrics?.totalVolume24hUsd || 142000000000) / 1e9).toFixed(1)}B
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">BTC Dom:</span>
            <span className="text-amber-400 font-medium">
              {globalMetrics?.btcDominance || 58.4}%
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Flame className="w-3.5 h-3.5 text-emerald-400 inline" />
            <span className="text-slate-500">Fear & Greed:</span>
            <span className="text-emerald-400 font-semibold">
              {globalMetrics?.fearAndGreedIndex || 74} ({globalMetrics?.sentimentText || 'Greed'})
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-300 inline" />
            <span className="text-slate-500">ETH Gas:</span>
            <span className="text-slate-300 font-medium">{globalMetrics?.gasGwei || 12} Gwei</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={onToggleCurrency}
            className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#21262d] text-slate-300 text-xs font-mono transition-colors border border-slate-700/60"
            title="Đổi loại tiền tệ hiển thị"
          >
            Đơn vị: <span className="text-emerald-400 font-bold">{baseCurrency}</span>
          </button>
          <div className="flex items-center space-x-1 text-slate-400 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Real-time Binance & CMC Data</span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('portfolio')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-cyan-500 p-[2px] shadow-lg shadow-emerald-500/10">
            <div className="w-full h-full bg-[#0d1117] rounded-[10px] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                Shun&apos;s Crypto World
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
                Personal
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Quản lý danh mục &amp; Trí tuệ đầu tư AI
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1 bg-[#161b22] p-1 rounded-xl border border-[#30363d]">
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'portfolio'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#21262d]'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Danh mục</span>
          </button>

          <button
            onClick={() => setActiveTab('market')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'market'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#21262d]'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Thị trường CMC</span>
          </button>

          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'chart'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#21262d]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Biểu đồ nến</span>
          </button>

          <button
            onClick={() => setActiveTab('wallets')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'wallets'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#21262d]'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Ví View-Only</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'ai'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold shadow-sm'
                : 'text-cyan-300 hover:text-white hover:bg-[#21262d]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gemini AI</span>
          </button>
        </nav>

        {/* Right Action Tools: 2FA & Telegram */}
        <div className="flex items-center space-x-2.5">
          {/* Telegram Alert Button */}
          <button
            onClick={onOpenTelegram}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              telegramConfigured
                ? 'bg-sky-500/10 border-sky-500/40 text-sky-400 hover:bg-sky-500/20'
                : 'bg-[#161b22] border-[#30363d] text-slate-400 hover:text-sky-400 hover:bg-[#21262d]'
            }`}
            title="Cài đặt thông báo Telegram Bot"
          >
            <Send className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Telegram Bot</span>
            {telegramConfigured && <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>}
          </button>

          {/* 2FA Security status */}
          <button
            onClick={onOpen2FA}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              twoFactorEnabled
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
            }`}
            title="Bảo mật 2FA Authenticator"
          >
            {twoFactorEnabled ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline font-mono">2FA Bật</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline font-mono">Bật 2FA</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile sub navigation */}
      <div className="md:hidden flex items-center justify-around px-2 py-2 bg-[#161b22] border-t border-[#21262d] text-xs">
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`px-2.5 py-1 rounded-md ${
            activeTab === 'portfolio' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'
          }`}
        >
          Danh mục
        </button>
        <button
          onClick={() => setActiveTab('market')}
          className={`px-2.5 py-1 rounded-md ${
            activeTab === 'market' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'
          }`}
        >
          Thị trường
        </button>
        <button
          onClick={() => setActiveTab('chart')}
          className={`px-2.5 py-1 rounded-md ${
            activeTab === 'chart' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'
          }`}
        >
          Biểu đồ
        </button>
        <button
          onClick={() => setActiveTab('wallets')}
          className={`px-2.5 py-1 rounded-md ${
            activeTab === 'wallets' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'
          }`}
        >
          Ví Watch
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-2.5 py-1 rounded-md ${
            activeTab === 'ai' ? 'bg-cyan-500 text-white font-bold' : 'text-cyan-400'
          }`}
        >
          AI
        </button>
      </div>
    </header>
  );
};
