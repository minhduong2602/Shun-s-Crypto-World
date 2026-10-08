'use client';

import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  X,
  Coins,
  DollarSign,
  Calendar,
  FileText,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import { TransactionType, Holding } from '@/lib/types';

export interface PreselectedCoinInfo {
  symbol: string;
  name?: string;
  currentPrice?: number;
  price?: number;
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedCoin?: PreselectedCoinInfo | null;
}

interface TransactionFormProps {
  onClose: () => void;
  onSuccess: () => void;
  preselectedCoin?: PreselectedCoinInfo | null;
}

const POPULAR_TICKERS = ['BTC', 'ETH', 'SOL', 'BNB', 'SUI', 'DOGE', 'PEPE', 'TAO', 'RENDER', 'NEAR', 'XRP', 'AVAX'];

const TransactionForm: React.FC<TransactionFormProps> = ({
  onClose,
  onSuccess,
  preselectedCoin,
}) => {
  const [symbol, setSymbol] = useState(() => (preselectedCoin ? preselectedCoin.symbol : 'BTC'));
  const [coinName, setCoinName] = useState(() => (preselectedCoin?.name || 'Bitcoin'));
  const [type, setType] = useState<TransactionType>('BUY');
  const [amount, setAmount] = useState('');
  const [pricePerCoin, setPricePerCoin] = useState(() => {
    if (preselectedCoin) {
      const p = preselectedCoin.currentPrice ?? preselectedCoin.price;
      if (p) return String(p);
    }
    return '91450';
  });
  const [fee, setFee] = useState('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Live search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ symbol: string; name: string; priceUsd: number; change24h: number }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  // Live price fetcher for any selected symbol
  const fetchLivePrice = async (ticker: string) => {
    setFetchingPrice(true);
    try {
      const res = await fetch(`/api/market/search?q=${ticker}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const match = data.results.find((r: any) => r.symbol === ticker) || data.results[0];
        setPricePerCoin(String(match.priceUsd));
        setCoinName(match.name);
      }
    } catch (e) {
      console.warn('Lỗi fetch live price:', e);
    } finally {
      setFetchingPrice(false);
    }
  };

  // Search autocomplete debounced
  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/market/search?q=${searchQuery.trim()}`);
        const data = await res.json();
        if (data.results) {
          setSearchResults(data.results);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const visibleResults = searchQuery.trim() ? searchResults : [];

  const handleSelectTicker = (selectedSymbol: string, selectedName: string, price?: number) => {
    const sym = selectedSymbol.toUpperCase();
    setSymbol(sym);
    setCoinName(selectedName);
    setSearchQuery('');
    setSearchResults([]);
    if (price && price > 0) {
      setPricePerCoin(String(price));
    } else {
      fetchLivePrice(sym);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !pricePerCoin || !symbol) {
      setErrorMsg('Vui lòng nhập đầy đủ mã Ticker, số lượng và đơn giá');
      return;
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const cleanCoinId = cleanSymbol.toLowerCase();

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/portfolio/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinId: cleanCoinId,
          symbol: cleanSymbol,
          name: coinName || `${cleanSymbol} Token`,
          type,
          amount: Number(amount),
          pricePerCoin: Number(pricePerCoin),
          fee: Number(fee || 0),
          notes,
          executedAt: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(data.error || 'Lỗi thêm giao dịch');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const totalCalculated =
    Number(amount || 0) * Number(pricePerCoin || 0) + Number(fee || 0);

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative my-8 text-xs">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-center space-x-3 pb-4 border-b border-[#21262d]">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <PlusCircle className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <span>Thêm Giao Dịch Mới</span>
            <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded-md font-mono border border-emerald-500/30">
              Live Binance Feed
            </span>
          </h2>
          <p className="text-slate-400">
            Hỗ trợ <strong>bất kỳ Ticker tiền mã hóa nào</strong> với giá thị trường thời gian thực
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-4 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Transaction Type Buttons */}
        <div>
          <label className="block text-slate-400 font-medium mb-1.5">Loại giao dịch</label>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                { id: 'BUY', label: 'Mua (Buy)', color: 'emerald' },
                { id: 'SELL', label: 'Bán (Sell)', color: 'rose' },
                { id: 'TRANSFER_IN', label: 'Nạp (In)', color: 'blue' },
                { id: 'TRANSFER_OUT', label: 'Rút (Out)', color: 'slate' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={`py-2 rounded-xl font-bold transition-all border ${
                  type === t.id
                    ? t.color === 'emerald'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                      : t.color === 'rose'
                      ? 'bg-rose-500 text-white border-rose-400 shadow-sm'
                      : 'bg-blue-500 text-white border-blue-400 shadow-sm'
                    : 'bg-[#0d1117] text-slate-400 border-[#30363d] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ticker Selector & Search Any Coin */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-slate-400 font-medium">Tìm hoặc nhập bất kỳ Ticker nào</label>
            <div className="flex items-center space-x-1.5">
              <span className="font-mono text-emerald-400 font-bold text-xs">{symbol}</span>
              <span className="text-slate-400 text-[11px]">({coinName})</span>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Gõ mã Ticker (VD: PEPE, TAO, DOGE, SUI, KAS, WIF...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              className="w-full pl-9 pr-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
            {isSearching && (
              <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {visibleResults.length > 0 && (
            <div className="mt-1 max-h-44 overflow-y-auto bg-[#0d1117] border border-[#30363d] rounded-xl divide-y divide-[#21262d] shadow-2xl z-20 relative">
              {visibleResults.map((item) => (
                <div
                  key={item.symbol}
                  onClick={() => handleSelectTicker(item.symbol, item.name, item.priceUsd)}
                  className="px-3 py-2 flex items-center justify-between hover:bg-[#1c2128] cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-emerald-400">{item.symbol}</span>
                    <span className="text-slate-300 text-[11px] truncate max-w-[140px]">{item.name}</span>
                  </div>
                  <div className="font-mono text-right">
                    <div className="text-white font-semibold">${item.priceUsd < 1 ? item.priceUsd.toFixed(6) : item.priceUsd.toLocaleString()}</div>
                    <div className={`text-[10px] ${item.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {item.change24h >= 0 ? '+' : ''}{item.change24h}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Popular Ticker Tags */}
          <div className="mt-2 flex items-center space-x-1.5 flex-wrap gap-y-1.5">
            <span className="text-[10px] text-slate-500 mr-1">Phổ biến:</span>
            {POPULAR_TICKERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleSelectTicker(t, t)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-colors border ${
                  symbol === t
                    ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                    : 'bg-[#0d1117] text-slate-400 hover:text-white border-[#30363d]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Amount & Price per coin */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Số lượng ({symbol})</label>
            <input
              type="number"
              step="any"
              placeholder="VD: 1.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 font-medium">Đơn giá USD</label>
              <button
                type="button"
                onClick={() => fetchLivePrice(symbol)}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center space-x-0.5"
                title="Cập nhật giá Binance tức thì"
              >
                {fetchingPrice ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5" />}
                <span>Giá live</span>
              </button>
            </div>
            <input
              type="number"
              step="any"
              placeholder="VD: 91450"
              value={pricePerCoin}
              onChange={(e) => setPricePerCoin(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Fee & Notes */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Phí giao dịch ($)</label>
            <input
              type="number"
              step="any"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Ghi chú (Tùy chọn)</label>
            <input
              type="text"
              placeholder="VD: DCA đợt điều chỉnh"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Total Preview */}
        <div className="p-3 bg-[#0d1117] rounded-xl border border-[#21262d] flex items-center justify-between">
          <span className="text-slate-400">Tổng giá trị giao dịch:</span>
          <span className="font-mono text-emerald-400 font-bold text-sm">
            ${totalCalculated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#21262d] text-slate-300 hover:text-white font-medium text-xs transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-emerald-500/20 flex items-center space-x-1.5"
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Thêm {symbol} vào danh mục</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedCoin,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <TransactionForm
        key={preselectedCoin?.symbol || 'dynamic-form'}
        onClose={onClose}
        onSuccess={onSuccess}
        preselectedCoin={preselectedCoin}
      />
    </div>
  );
};
