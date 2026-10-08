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
  Sparkles,
  Check,
} from 'lucide-react';
import { MarketTicker } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPortfolioCurrency } from '@/lib/format-portfolio-currency';

interface MarketWatchlistProps {
  tickers: MarketTicker[];
  baseCurrency: string;
  usdVndRate?: number | null;
  onSelectCoinForChart: (coinId: string) => void;
  onOpenAddTransaction: (coin?: { symbol: string; name: string; price: number }) => void;
  onRefresh?: () => void;
}

export const MarketWatchlist: React.FC<MarketWatchlistProps> = ({
  tickers,
  baseCurrency,
  usdVndRate,
  onSelectCoinForChart,
  onOpenAddTransaction,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [filterView, setFilterView] = useState<'ALL' | 'FAVORITES'>('ALL');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [watchlistReady, setWatchlistReady] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistRetry, setWatchlistRetry] = useState(0);

  // Add custom coin modal state
  const [showAddCoinModal, setShowAddCoinModal] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ symbol: string; name: string; priceUsd: number; change24h: number }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addSuccessMsg, setAddSuccessMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/market/watchlist').then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Không tải được danh sách theo dõi.');
      return data;
    }).then((data) => {
      if (!cancelled) {
        setFavorites(new Set<string>(data.symbols ?? []));
        setWatchlistError(null);
      }
    }).catch((error) => {
      if (!cancelled) setWatchlistError(error instanceof Error ? error.message : 'Không tải được danh sách theo dõi.');
    }).finally(() => {
      if (!cancelled) setWatchlistReady(true);
    });
    return () => { cancelled = true; };
  }, [watchlistRetry]);

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

  const toggleFavorite = async (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!watchlistReady || watchlistError) return;
    const adding = !favorites.has(symbol);
    const response = await fetch(adding ? '/api/market/watchlist' : `/api/market/watchlist?symbol=${encodeURIComponent(symbol)}`, {
      method: adding ? 'POST' : 'DELETE',
      ...(adding ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol }) } : {}),
    });
    if (!response.ok) return;
    setFavorites((current) => {
      const next = new Set(current);
      if (adding) next.add(symbol); else next.delete(symbol);
      return next;
    });
  };

  const handleAddCoinToWatchlist = async (coin: { symbol: string; name: string; priceUsd: number; change24h: number }) => {
    setIsAdding(true);
    setAddSuccessMsg('');
    try {
      const res = await fetch('/api/market/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: coin.symbol,
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
    await toggleFavorite(symbol, e);
  };

  const formatCurrency = (val: number) => formatPortfolioCurrency(val, baseCurrency, usdVndRate);

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
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Bảng giá thị trường</CardTitle>
          <CardDescription>Giá giao dịch và khối lượng 24h trực tiếp từ sàn. Các chỉ số không có nguồn dữ liệu sẽ để trống.</CardDescription>
        </div>

        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          {/* Favorites toggle tabs */}
          <div className="flex items-center gap-1 rounded-md border bg-muted p-1 text-xs">
            <Button variant={filterView === 'ALL' ? 'default' : 'ghost'} size="sm"
              onClick={() => setFilterView('ALL')}
            >
              Tất cả ({tickers.length})
            </Button>
            <Button variant={filterView === 'FAVORITES' ? 'secondary' : 'ghost'} size="sm"
              onClick={() => setFilterView('FAVORITES')}
            >
              <Star className="w-3 h-3 fill-current" />
              <span>Yêu thích ({Array.from(favorites).length})</span>
            </Button>
          </div>

          {/* Search box */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Tìm coin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Add custom coin button */}
          <Button variant="outline" size="sm"
            onClick={() => setShowAddCoinModal(true)}
            title="Thêm đồng coin mới vào danh sách theo dõi"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm coin</span>
          </Button>
        </div>
      </CardHeader>

      {watchlistError && (
        <Alert variant="destructive" className="m-4">
          <AlertTitle>Danh sách theo dõi chưa khả dụng</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{watchlistError}</span>
            <Button variant="outline" size="sm" onClick={() => { setWatchlistReady(false); setWatchlistRetry((value) => value + 1); }}>
              <RefreshCw className="size-3.5" /> Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">★</TableHead>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Giá</TableHead>
              <TableHead>1h %</TableHead>
              <TableHead>24h %</TableHead>
              <TableHead>7d %</TableHead>
              <TableHead>Vốn hóa thị trường</TableHead>
              <TableHead>Khối lượng 24h</TableHead>
              <TableHead className="hidden md:table-cell">Xu hướng 7 ngày</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                  Không tìm thấy đồng tiền nào trong danh sách.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => {
                const is24hUp = item.priceChange24h >= 0;
                const is7dUp = (item.priceChange7d ?? 0) >= 0;
                const is1hUp = (item.priceChange1h ?? 0) >= 0;
                const isFav = favorites.has(item.symbol);

                return (
                  <TableRow
                    key={item.id}
                    className="hover:bg-accent/50 transition-colors cursor-pointer group"
                    onClick={() => onSelectCoinForChart(item.symbol)}
                  >
                    {/* Star favorite */}
                    <TableCell className="text-center" onClick={(e) => toggleFavorite(item.symbol, e)}>
                      <Star
                        className={`w-4 h-4 mx-auto transition-colors ${
                          isFav ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-amber-300'
                        }`}
                      />
                    </TableCell>

                    <TableCell className="text-center font-mono text-muted-foreground">{item.rank}</TableCell>

                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center font-bold text-foreground text-[10px] border">
                          {item.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-bold text-foreground flex items-center space-x-1.5">
                            <span>{item.name}</span>
                            <span className="text-muted-foreground font-mono text-[11px]">{item.symbol}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="font-mono font-bold">
                      {formatCurrency(item.priceUsd)}
                    </TableCell>

                    <TableCell className="font-mono">
                      {item.priceChange1h == null ? <span className="text-muted-foreground">—</span> : (
                        <span className={is1hUp ? 'text-emerald-400' : 'text-rose-400'}>
                          {is1hUp ? '+' : ''}{item.priceChange1h.toFixed(2)}%
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="font-mono">
                      <Badge
                        variant="outline"
                        className={`inline-flex items-center space-x-0.5 font-mono ${
                          is24hUp ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-destructive/30 bg-destructive/10 text-destructive'
                        }`}
                      >
                        {is24hUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        <span>
                          {is24hUp ? '+' : ''}
                          {item.priceChange24h.toFixed(2)}%
                        </span>
                      </Badge>
                    </TableCell>

                    <TableCell className="font-mono">
                      {item.priceChange7d == null ? <span className="text-muted-foreground">—</span> : (
                        <span className={is7dUp ? 'text-emerald-400' : 'text-rose-400'}>
                          {is7dUp ? '+' : ''}{item.priceChange7d.toFixed(2)}%
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="font-mono">
                      {item.marketCapUsd == null ? '—' : `$${(item.marketCapUsd / 1e9).toFixed(2)}B`}
                    </TableCell>

                    <TableCell className="font-mono">
                      ${(item.volume24hUsd / 1e6).toFixed(2)}M
                    </TableCell>

                    <TableCell className="hidden md:table-cell">
                      {renderSparkline(item.sparkline7d, is7dUp)}
                    </TableCell>

                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1.5">
                        <Button variant="secondary" size="sm"
                          onClick={() =>
                            onOpenAddTransaction({
                              symbol: item.symbol,
                              name: item.name,
                              price: item.priceUsd,
                            })
                          }
                          title={`Mua ${item.symbol} và ghi vào danh mục`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>Mua</span>
                        </Button>
                        <Button variant="ghost" size="icon"
                          onClick={(e) => handleDeleteTicker(item.symbol, e)}
                          title="Xóa coin khỏi danh sách theo dõi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Custom Coin Modal */}
      <Dialog open={showAddCoinModal} onOpenChange={setShowAddCoinModal}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>Thêm coin yêu thích</DialogTitle>
              <DialogDescription>Tìm mã giao dịch để lưu vào danh sách theo dõi của bạn.</DialogDescription>
            </DialogHeader>

            {addSuccessMsg && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{addSuccessMsg}</span>
              </div>
            )}

            <div className="mt-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Nhập mã token (VD: TON, INJ, AVAX, ARB...)..."
                  value={addSearchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAddSearchQuery(val);
                    if (!val.trim()) setSearchResults([]);
                  }}
                  className="pl-9 font-mono"
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
                    className="flex cursor-pointer items-center justify-between rounded-md border bg-card p-2.5 transition-colors hover:bg-accent"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="font-bold text-foreground font-mono">{coin.symbol}</span>
                        <span className="text-xs text-muted-foreground">{coin.name}</span>
                      </div>
                      <div className="flex items-center space-x-3 text-right">
                        <div>
                          <div className="font-mono text-xs font-semibold text-foreground">
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
                        <Button type="button" size="sm" disabled={isAdding} onClick={() => handleAddCoinToWatchlist(coin)}>
                          Thêm
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
