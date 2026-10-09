'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusCircle,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { TransactionType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export interface PreselectedCoinInfo {
  symbol: string;
  name?: string;
  currentPrice?: number | null;
  price?: number | null;
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

function toLocalDateTimeInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const TransactionForm: React.FC<TransactionFormProps> = ({
  onClose,
  onSuccess,
  preselectedCoin,
}) => {
  const [symbol, setSymbol] = useState(() => (preselectedCoin ? preselectedCoin.symbol : 'BTC'));
  const [coinName, setCoinName] = useState(() => (preselectedCoin?.name || 'Bitcoin'));
  const [type, setType] = useState<TransactionType>('BUY');
  const [amount, setAmount] = useState('');
  const [executedAt, setExecutedAt] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [pricePerCoin, setPricePerCoin] = useState(() => {
    if (preselectedCoin) {
      const p = preselectedCoin.currentPrice ?? preselectedCoin.price;
      if (p) return String(p);
    }
    return '';
  });
  const [fee, setFee] = useState('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Live search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ id?: string; symbol: string; name: string; priceUsd: number | null; change24h: number | null; source?: string }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  // Live price fetcher for any selected symbol
  const fetchLivePrice = useCallback(async (ticker: string) => {
    setFetchingPrice(true);
    try {
      const res = await fetch(`/api/market/search?q=${ticker}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const match = data.results.find((r: any) => r.symbol === ticker) || data.results[0];
        if (typeof match.priceUsd === 'number' && match.priceUsd > 0) setPricePerCoin(String(match.priceUsd));
        setCoinName(match.name);
      }
    } catch (e) {
      console.warn('Lỗi fetch live price:', e);
    } finally {
      setFetchingPrice(false);
    }
  }, []);

  useEffect(() => {
    const selectedPrice = preselectedCoin?.currentPrice ?? preselectedCoin?.price;
    if (selectedPrice && selectedPrice > 0) return;
    const timer = window.setTimeout(() => { void fetchLivePrice(symbol); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchLivePrice, preselectedCoin, symbol]);

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
      setPricePerCoin('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !pricePerCoin || !symbol || !executedAt) {
      setErrorMsg('Vui lòng nhập mã Ticker, số lượng, đơn giá và ngày giao dịch');
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
          executedAt: new Date(executedAt).toISOString(),
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
    <div className="w-full max-w-lg text-sm">
      <DialogHeader className="mb-4 flex-row items-center gap-3 border-b pb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <PlusCircle className="w-5 h-5" />
        </div>
        <div>
          <DialogTitle>Thêm giao dịch</DialogTitle>
          <DialogDescription>Chọn tài sản, nhập số lượng và xác nhận đơn giá giao dịch.</DialogDescription>
        </div>
      </DialogHeader>

      {errorMsg && (
        <Alert variant="destructive"><AlertDescription>{errorMsg}</AlertDescription></Alert>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Transaction Type Buttons */}
        <div>
          <Label className="mb-1.5 block">Loại giao dịch</Label>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                { id: 'BUY', label: 'Mua (Buy)', color: 'emerald' },
                { id: 'SELL', label: 'Bán (Sell)', color: 'rose' },
                { id: 'TRANSFER_IN', label: 'Nạp (In)', color: 'blue' },
                { id: 'TRANSFER_OUT', label: 'Rút (Out)', color: 'slate' },
              ] as const
            ).map((t) => (
              <Button variant={type === t.id ? 'default' : 'outline'}
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className="h-9 text-xs"
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Ticker Selector & Search Any Coin */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Tìm hoặc nhập ticker</Label>
            <div className="flex items-center space-x-1.5">
              <span className="font-mono text-emerald-400 font-bold text-xs">{symbol}</span>
              <span className="text-slate-400 text-[11px]">({coinName})</span>
            </div>
          </div>

          <Command label="Tìm hoặc nhập ticker" shouldFilter={false} className="relative overflow-visible rounded-xl border border-border bg-background">
            <CommandInput
              value={searchQuery}
              onValueChange={(value) => setSearchQuery(value.toUpperCase())}
              placeholder="Gõ mã Ticker (VD: PEPE, TAO, DOGE, SUI, KAS, WIF...)"
              className="font-mono"
            />
            {searchQuery.trim() && (
              <CommandList
                aria-label="Ticker suggestions"
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 rounded-xl border border-border bg-popover shadow-2xl"
              >
                {isSearching ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                    <RefreshCw className="size-4 animate-spin" /> Đang tìm ticker...
                  </div>
                ) : visibleResults.length === 0 ? (
                  <CommandEmpty>Không tìm thấy ticker phù hợp.</CommandEmpty>
                ) : visibleResults.map((item) => (
                  <CommandItem
                    key={`${item.id ?? item.symbol}:${item.name}`}
                    value={`${item.symbol} ${item.name}`}
                    onSelect={() => handleSelectTicker(item.symbol, item.name, item.priceUsd ?? undefined)}
                    className="justify-between gap-4 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-mono font-bold text-primary">{item.symbol}</span>
                      <span className="max-w-[140px] truncate text-[11px] text-muted-foreground">{item.name}</span>
                    </div>
                    <div className="shrink-0 text-right font-mono">
                      <div className="font-semibold text-foreground">{item.priceUsd === null ? 'Chưa có giá' : `$${item.priceUsd < 1 ? item.priceUsd.toFixed(6) : item.priceUsd.toLocaleString()}`}</div>
                      <div className={`text-[10px] ${item.change24h === null ? 'text-muted-foreground' : item.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.change24h === null ? '—' : `${item.change24h >= 0 ? '+' : ''}${item.change24h}%`}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandList>
            )}
          </Command>

          {/* Quick Popular Ticker Tags */}
          <div className="mt-2 flex items-center space-x-1.5 flex-wrap gap-y-1.5">
            <span className="text-[10px] text-slate-500 mr-1">Phổ biến:</span>
            {POPULAR_TICKERS.map((t) => (
              <Button variant={symbol === t ? 'secondary' : 'outline'} size="sm"
                key={t}
                type="button"
                onClick={() => handleSelectTicker(t, t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>

        {/* Amount & Price per coin */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="transaction-amount" className="mb-1 block">Số lượng ({symbol})</Label>
            <Input
              id="transaction-amount"
              type="number"
              step="any"
              placeholder="VD: 1.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="transaction-price">Đơn giá USD</Label>
              <Button variant="ghost" size="sm"
                type="button"
                onClick={() => fetchLivePrice(symbol)}
                title="Cập nhật giá Binance tức thì"
              >
                {fetchingPrice ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5" />}
                <span>Giá live</span>
              </Button>
            </div>
            <Input
              id="transaction-price"
              type="number"
              step="any"
              placeholder="Giá theo đơn khớp lệnh"
              value={pricePerCoin}
              onChange={(e) => setPricePerCoin(e.target.value)}
              className="font-mono"
            />
          </div>

          <div>
            <Label htmlFor="transaction-executed-at" className="mb-1 block">Ngày và giờ giao dịch</Label>
            <Input
              id="transaction-executed-at"
              type="datetime-local"
              value={executedAt}
              onChange={(e) => setExecutedAt(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Fee & Notes */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 block">Phí giao dịch ($)</Label>
            <Input
              type="number"
              step="any"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="font-mono"
            />
          </div>

          <div>
            <Label className="mb-1 block">Ghi chú (Tùy chọn)</Label>
            <Input
              type="text"
              placeholder="VD: DCA đợt điều chỉnh"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Total Preview */}
        <div className="p-3 bg-muted/40 rounded-xl border flex items-center justify-between">
          <span className="text-slate-400">Tổng giá trị giao dịch:</span>
          <span className="font-mono text-emerald-400 font-bold text-sm">
            ${totalCalculated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <Button variant="outline"
            type="button"
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button type="submit" disabled={loading || fetchingPrice || !pricePerCoin}
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Thêm {symbol} vào danh mục</span>
          </Button>
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
      <TransactionForm
        key={preselectedCoin?.symbol || 'dynamic-form'}
        onClose={onClose}
        onSuccess={onSuccess}
        preselectedCoin={preselectedCoin}
      />
      </DialogContent>
    </Dialog>
  );
};
