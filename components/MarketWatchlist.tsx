'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Star,
  ExternalLink,
  Plus,
  Trash2,
  RefreshCw,
  X,
  Sparkles,
  Check,
} from 'lucide-react';
import { MarketTicker } from '@/lib/types';

interface MarketWatchlistProps {
  tickers: MarketTicker[];
  baseCurrency: string;
  onSelectCoinForChart: (coinId: string) => void;
  onOpenAddTransaction: (coin?: { symbol: string; name: string; price: number }) => void;
  onRefresh?: () => void;
}

export const MarketWatchlist: React.FC<MarketWatchlistProps> = ({
  tickers,
  baseCurrency,
  onSelectCoinForChart,
  onOpenAddTransaction,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [filterView, setFilterView] = useState<'ALL' | 'FAVORITES'>('ALL');
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(['BTC', 'ETH', 'SOL']));

  // Add custom coin modal state
  const [showAddCoinModal, setShowAddCoinModal] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ symbol: string; name: string; priceUsd: number; change24h: number }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addSuccessMsg, setAddSuccessMsg] = useState('');

  // Debounced search for adding new coin
  useEffect(() => {
    if (!addSearchQuery.trim()) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(addSearchQuery.trim())}`);
        const data = await res.json();
        if (data.results) {
          setSearchResults(data.results);
        }
      } catch (err) {
        console.error('Lỗi tìm kiếm coin:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [addSearchQuery]);

  const toggleFavorite = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  const handleAddCoinToWatchlist = async (coin: { symbol: string; name: string; priceUsd: number; change24h: number }) => {
    setIsAdding(true);
    setAddSuccessMsg('');
    try {
      const res = await fetch('/api/market/tickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: coin.symbol,
          name: coin.name,
          price: coin.priceUsd,
          change24h: coin.change24h,
        }),
      });
      if (res.ok) {
        setFavorites((prev) => new Set(prev).add(coin.symbol.toUpperCase()));
        setAddSuccessMsg(`Đã thêm ${coin.symbol.toUpperCase()} vào danh sách theo dõi!`);
        setTimeout(() => {
          setShowAddCoinModal(false);
          setAddSearchQuery('');
          setSearchResults([]);
          setAddSuccessMsg('');
        }, 1200);
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteTicker = async (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/market/tickers?symbol=${encodeURIComponent(symbol)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (val: number) => {
    if (baseCurrency === 'VND') {
      const vndVal = val * 25450;
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(vndVal);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const filtered = tickers
    .filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.symbol.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (filterView === 'FAVORITES') return favorites.has(t.symbol);
      return true;
    });

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
            Dữ liệu giá theo thời gian thực được cập nhật từ Binance &amp; CoinGecko — Hỗ trợ thêm token theo dõi, gắn sao yêu thích
          </p>
        </div>

        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          {/* Favorites toggle tabs */}
          <div className="flex items-center space-x-1 bg-[#0d1117] p-1 rounded-xl border border-[#30363d] text-xs">
            <button
              onClick={() => setFilterView('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filterView === 'ALL'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tất cả ({tickers.length})
            </button>
            <button
              onClick={() => setFilterView('FAVORITES')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center space-x-1 transition-colors ${
                filterView === 'FAVORITES'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              <Star className="w-3 h-3 fill-current" />
              <span>Yêu thích ({Array.from(favorites).length})</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm coin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Add custom coin button */}
          <button
            onClick={() => setShowAddCoinModal(true)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-sm whitespace-nowrap"
            title="Thêm đồng coin mới vào danh sách theo dõi"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm coin</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#0d1117] text-slate-400 font-semibold border-b border-[#21262d]">
              <th className="py-3.5 px-3 w-10 text-center">★</th>
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-10 text-center text-slate-500">
                  Không tìm thấy đồng tiền nào trong danh sách.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const is24hUp = item.priceChange24h >= 0;
                const is7dUp = item.priceChange7d >= 0;
                const is1hUp = item.priceChange1h >= 0;
                const isFav = favorites.has(item.symbol);

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-[#1c2128] transition-colors cursor-pointer group"
                    onClick={() => onSelectCoinForChart(item.symbol)}
                  >
                    {/* Star favorite */}
                    <td className="py-4 px-3 text-center" onClick={(e) => toggleFavorite(item.symbol, e)}>
                      <Star
                        className={`w-4 h-4 mx-auto transition-colors ${
                          isFav ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-amber-300'
                        }`}
                      />
                    </td>

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
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() =>
                            onOpenAddTransaction({
                              symbol: item.symbol,
                              name: item.name,
                              price: item.priceUsd,
                            })
                          }
                          className="px-2 py-1 rounded bg-[#21262d] hover:bg-emerald-500 hover:text-slate-950 text-slate-200 transition-colors inline-flex items-center space-x-1"
                          title={`Mua ${item.symbol} và ghi vào danh mục`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>Mua</span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteTicker(item.symbol, e)}
                          className="p-1 rounded text-slate-600 hover:text-rose-400 hover:bg-[#21262d] transition-colors"
                          title="Xóa coin khỏi danh sách theo dõi"
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

      {/* Add Custom Coin Modal */}
      {showAddCoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddCoinModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 pb-3 border-b border-[#21262d]">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Thêm đồng coin vào theo dõi thị trường</h4>
                <p className="text-xs text-slate-400">Tìm kiếm theo tên hoặc mã ticker (VD: TON, KAS, TIA, OP...)</p>
              </div>
            </div>

            {addSuccessMsg && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{addSuccessMsg}</span>
              </div>
            )}

            <div className="mt-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Nhập mã token (VD: TON, INJ, AVAX, ARB...)..."
                  value={addSearchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAddSearchQuery(val);
                    if (!val.trim()) setSearchResults([]);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  autoFocus
                />
                {isSearching && (
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>

              {/* Autocomplete list */}
              <div className="mt-3 max-h-56 overflow-y-auto space-y-1.5">
                {searchResults.length === 0 ? (
                  addSearchQuery.trim() && !isSearching ? (
                    <p className="text-center text-slate-500 text-xs py-4">Không tìm thấy coin phù hợp.</p>
                  ) : null
                ) : (
                  searchResults.map((coin) => (
                    <div
                      key={coin.symbol}
                      onClick={() => handleAddCoinToWatchlist(coin)}
                      className="p-2.5 bg-[#0d1117] hover:bg-[#21262d] border border-[#21262d] rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="font-bold text-white font-mono">{coin.symbol}</span>
                        <span className="text-xs text-slate-400">{coin.name}</span>
                      </div>
                      <div className="flex items-center space-x-3 text-right">
                        <div>
                          <div className="font-mono text-xs font-semibold text-white">
                            ${coin.priceUsd.toLocaleString()}
                          </div>
                          <div
                            className={`text-[10px] font-mono ${
                              coin.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {coin.change24h >= 0 ? '+' : ''}
                            {coin.change24h.toFixed(2)}%
                          </div>
                        </div>
                        <button
                          type="button"
                          className="px-2 py-1 rounded bg-emerald-500 text-slate-950 font-bold text-[11px]"
                        >
                          Thêm
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
