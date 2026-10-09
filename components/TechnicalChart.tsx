'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart2,
  RefreshCw,
  Search,
  Radio,
  Maximize2,
  Minimize2,
  Layers,
  Sparkles,
  Sliders,
  Check,
  ChevronDown,
  Globe,
  Flame,
} from 'lucide-react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  UTCTimestamp,
  IChartApi,
  ISeriesApi,
} from 'lightweight-charts';
import { OHLCVPoint } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { normalizeChartSymbol } from '@/lib/market/chart-symbol';
import { formatPortfolioCurrency } from '@/lib/format-portfolio-currency';
import { connectWithReconnect } from '@/lib/market/reconnecting-websocket';

interface TechnicalChartProps {
  selectedCoinId: string;
  onSelectCoin: (coinId: string) => void;
  baseCurrency: string;
  usdVndRate?: number | null;
}

const POPULAR_CHART_COINS = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'SUI', name: 'Sui' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'PEPE', name: 'Pepe' },
  { symbol: 'TON', name: 'Toncoin' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'NEAR', name: 'NEAR' },
  { symbol: 'TAO', name: 'Bittensor' },
  { symbol: 'RENDER', name: 'Render' },
];

const TIMEFRAMES = [
  { id: '1m', label: '1m', tvInterval: '1' },
  { id: '5m', label: '5m', tvInterval: '5' },
  { id: '15m', label: '15m', tvInterval: '15' },
  { id: '1H', label: '1H', tvInterval: '60' },
  { id: '4H', label: '4H', tvInterval: '240' },
  { id: '1D', label: '1D', tvInterval: 'D' },
  { id: '1W', label: '1W', tvInterval: 'W' },
];
const EMPTY_CHART_DATA: OHLCVPoint[] = [];

function calculateSMA(data: OHLCVPoint[], period: number) {
  const result: { time: UTCTimestamp; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].time as UTCTimestamp,
      value: Number((sum / period).toFixed(data[i].close < 1 ? 6 : 2)),
    });
  }
  return result;
}

function calculateEMA(data: OHLCVPoint[], period: number) {
  const result: { time: UTCTimestamp; value: number }[] = [];
  if (data.length < period) return result;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((acc, c) => acc + c.close, 0) / period;
  result.push({
    time: data[period - 1].time as UTCTimestamp,
    value: Number(ema.toFixed(data[period - 1].close < 1 ? 6 : 2)),
  });

  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    result.push({
      time: data[i].time as UTCTimestamp,
      value: Number(ema.toFixed(data[i].close < 1 ? 6 : 2)),
    });
  }
  return result;
}

export const TechnicalChart: React.FC<TechnicalChartProps> = ({
  selectedCoinId,
  onSelectCoin,
  baseCurrency,
  usdVndRate,
}) => {
  const [timeframe, setTimeframe] = useState<string>('15m');
  const [chartData, setChartData] = useState<OHLCVPoint[]>([]);
  const [chartDataKey, setChartDataKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [dataErrorKey, setDataErrorKey] = useState<string | null>(null);
  const [liveQuoteKey, setLiveQuoteKey] = useState<string | null>(null);
  const [livePrice, setLivePrice] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [high24h, setHigh24h] = useState<number>(0);
  const [low24h, setLow24h] = useState<number>(0);
  const [volume24h, setVolume24h] = useState<number>(0);
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const [dataSource, setDataSource] = useState<string>('Binance / MEXC Live');
  const [wsStatus, setWsStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'FALLBACK_REST'>('DISCONNECTED');
  const [searchTicker, setSearchTicker] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Indicators toggle (for lightweight engine)
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showEMA200, setShowEMA200] = useState(false);
  const [showVolume, setShowVolume] = useState(true);

  // Crosshair HUD state
  const [crosshairPoint, setCrosshairPoint] = useState<OHLCVPoint | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartElementRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const sma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const prevPriceRef = useRef<number>(0);
  const dailyReferencePriceRef = useRef<number>(0);

  const activeSymbol = normalizeChartSymbol(selectedCoinId || 'BTC');
  const requestKey = `${activeSymbol}:${timeframe.toLowerCase()}`;
  const hasCurrentQuote = liveQuoteKey === requestKey;
  const visibleLivePrice = hasCurrentQuote ? livePrice : 0;
  const visiblePriceChange24h = hasCurrentQuote ? priceChange24h : null;
  const visibleHigh24h = hasCurrentQuote ? high24h : 0;
  const visibleLow24h = hasCurrentQuote ? low24h : 0;
  const visibleVolume24h = hasCurrentQuote ? volume24h : 0;
  const visibleChartData = chartDataKey === requestKey ? chartData : EMPTY_CHART_DATA;
  const visibleDataError = dataErrorKey === requestKey ? dataError : null;

  // Format currency
  const formatCurrency = (val: number) => formatPortfolioCurrency(val, baseCurrency, usdVndRate);

  // 1. Fetch Historical Klines from API
  useEffect(() => {
    let isMounted = true;
    prevPriceRef.current = 0;
    dailyReferencePriceRef.current = 0;

    async function loadHistoricalData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/market/chart?coinId=${activeSymbol}&timeframe=${timeframe}`);
        const json = await res.json();
        if (!res.ok || !json.isLive || !Array.isArray(json.data) || json.data.length === 0) {
          if (isMounted) {
            setChartData([]);
            setChartDataKey(requestKey);
            setDataError(json.error || 'Nguồn giá trực tiếp hiện không phản hồi.');
            setDataErrorKey(requestKey);
            setDataSource(json.dataSource || 'Dữ liệu thị trường không khả dụng');
            if (Number.isFinite(json.currentPrice) && json.currentPrice > 0) {
              setLiveQuoteKey(requestKey);
              setLivePrice(json.currentPrice);
              prevPriceRef.current = json.currentPrice;
              if (Number.isFinite(json.priceChange24h) && json.priceChange24h > -100) {
                setPriceChange24h(json.priceChange24h);
                dailyReferencePriceRef.current = json.currentPrice / (1 + json.priceChange24h / 100);
              }
              if (Number.isFinite(json.high24h)) setHigh24h(json.high24h);
              if (Number.isFinite(json.low24h)) setLow24h(json.low24h);
              if (Number.isFinite(json.volume24h)) setVolume24h(json.volume24h);
            } else {
              setLiveQuoteKey(null);
            }
          }
          return;
        }

        if (isMounted) {
          setDataError(null);
          setDataErrorKey(null);
          const rawData: OHLCVPoint[] = json.data;
          // Ensure strictly ascending timestamps
          const cleanData: OHLCVPoint[] = [];
          let lastTime = 0;
          for (const pt of rawData) {
            if (pt.time > lastTime) {
              cleanData.push(pt);
              lastTime = pt.time;
            }
          }

          setChartData(cleanData);
          setChartDataKey(requestKey);
          setDataSource(json.dataSource || 'Binance / MEXC Live');

          const latestClose = Number.isFinite(json.currentPrice) && json.currentPrice > 0
            ? json.currentPrice
            : cleanData[cleanData.length - 1].close;
          if (prevPriceRef.current && prevPriceRef.current !== latestClose) {
            setPriceFlash(latestClose > prevPriceRef.current ? 'up' : 'down');
            setTimeout(() => setPriceFlash(null), 800);
          }
          prevPriceRef.current = latestClose;
          setLiveQuoteKey(requestKey);
          setLivePrice(latestClose);

          // Calculate 24h stats
          const highs = cleanData.map((d) => d.high);
          const lows = cleanData.map((d) => d.low);
          const vols = cleanData.map((d) => d.volume);
          setHigh24h(Number.isFinite(json.high24h) ? json.high24h : Math.max(...highs));
          setLow24h(Number.isFinite(json.low24h) ? json.low24h : Math.min(...lows));
          setVolume24h(Number.isFinite(json.volume24h) ? json.volume24h : vols.reduce((a, b) => a + b, 0));

          const firstOpen = cleanData[0].open;
          const change24h = Number.isFinite(json.priceChange24h)
            ? json.priceChange24h
            : firstOpen > 0 ? Number((((latestClose - firstOpen) / firstOpen) * 100).toFixed(2)) : 0;
          setPriceChange24h(change24h);
          if (change24h > -100) dailyReferencePriceRef.current = latestClose / (1 + change24h / 100);
        }
      } catch (err) {
        if (isMounted) {
          setDataError('Không thể kết nối nguồn dữ liệu biểu đồ. Đang thử lại tự động.');
          setDataErrorKey(requestKey);
          setChartData([]);
          setChartDataKey(requestKey);
          setLiveQuoteKey(null);
          setDataSource('Dữ liệu thị trường không khả dụng');
        }
        console.error('Lỗi nạp dữ liệu nến:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHistoricalData();
    // 10s auto-refresh fallback polling
    const interval = setInterval(loadHistoricalData, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeSymbol, timeframe, requestKey]);

  // 2. Setup Lightweight Charts Canvas
  useEffect(() => {
    if (!chartElementRef.current) return;

    // Clean up previous instance
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const chart = createChart(chartElementRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#090d12' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#38bdf8',
          width: 1,
          style: 3,
          labelBackgroundColor: '#0284c7',
        },
        horzLine: {
          color: '#38bdf8',
          width: 1,
          style: 3,
          labelBackgroundColor: '#0284c7',
        },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      autoSize: true,
    });

    chartInstanceRef.current = chart;

    // 1. Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: true,
      borderUpColor: '#10b981',
      borderDownColor: '#f43f5e',
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });
    candleSeriesRef.current = candleSeries;

    // 2. Volume Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#10b981',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // Overlay at bottom
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // 3. Technical Indicator Series
    const sma20 = chart.addSeries(LineSeries, {
      color: '#eab308',
      lineWidth: 1,
      title: 'SMA 20',
      lastPriceAnimation: 0,
    });
    sma20SeriesRef.current = sma20;

    const sma50 = chart.addSeries(LineSeries, {
      color: '#06b6d4',
      lineWidth: 1,
      title: 'SMA 50',
      lastPriceAnimation: 0,
    });
    sma50SeriesRef.current = sma50;

    const ema200 = chart.addSeries(LineSeries, {
      color: '#c084fc',
      lineWidth: 2,
      title: 'EMA 200',
      lastPriceAnimation: 0,
    });
    ema200SeriesRef.current = ema200;

    // Crosshair move handler for real-time HUD
    chart.subscribeCrosshairMove((param) => {
      if (
        !param.point ||
        !param.time ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        setCrosshairPoint(null);
        return;
      }

      const candleData = param.seriesData.get(candleSeries) as any;
      if (candleData && typeof candleData.open === 'number') {
        const volData = param.seriesData.get(volumeSeries) as any;
        setCrosshairPoint({
          time: Number(param.time),
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volData?.value || 0,
        });
      }
    });

    return () => {
      chart.remove();
      chartInstanceRef.current = null;
    };
  }, []);

  // 3. Update Chart Series when Data or Indicators change
  useEffect(() => {
    if (!chartInstanceRef.current || !candleSeriesRef.current) return;
    const candleFormatted = visibleChartData.map((d) => ({
      time: d.time as UTCTimestamp,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candleSeriesRef.current.setData(candleFormatted);

    if (volumeSeriesRef.current) {
      if (showVolume) {
        const volumeFormatted = visibleChartData.map((d) => ({
          time: d.time as UTCTimestamp,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)',
        }));
        volumeSeriesRef.current.setData(volumeFormatted);
      } else {
        volumeSeriesRef.current.setData([]);
      }
    }

    if (sma20SeriesRef.current) {
      sma20SeriesRef.current.setData(showSMA20 ? calculateSMA(visibleChartData, 20) : []);
    }
    if (sma50SeriesRef.current) {
      sma50SeriesRef.current.setData(showSMA50 ? calculateSMA(visibleChartData, 50) : []);
    }
    if (ema200SeriesRef.current) {
      ema200SeriesRef.current.setData(showEMA200 ? calculateEMA(visibleChartData, 200) : []);
    }

    chartInstanceRef.current.timeScale().fitContent();
  }, [visibleChartData, chartData, chartDataKey, requestKey, showSMA20, showSMA50, showEMA200, showVolume]);

  // 4. Real-time Live Binance WebSocket Stream (Sub-second tick updates)
  useEffect(() => {
    const pair = `${activeSymbol.toLowerCase()}usdt`;

    let wsInterval = '15m';
    const tfLower = timeframe.toLowerCase();
    if (tfLower === '1m') wsInterval = '1m';
    else if (tfLower === '5m') wsInterval = '5m';
    else if (tfLower === '15m') wsInterval = '15m';
    else if (tfLower === '1h') wsInterval = '1h';
    else if (tfLower === '4h') wsInterval = '4h';
    else if (tfLower === '1d') wsInterval = '1d';
    else if (tfLower === '1w') wsInterval = '1w';

    let isMounted = true;
    const connection = connectWithReconnect(`wss://stream.binance.com:9443/ws/${pair}@kline_${wsInterval}`, {
      onStatus: (status) => { if (isMounted) setWsStatus(status); },
      onMessage: (event) => {
        if (!isMounted) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg && msg.k) {
            const k = msg.k;
            const currentClose = parseFloat(k.c);
            const currentOpen = parseFloat(k.o);
            const currentHigh = parseFloat(k.h);
            const currentLow = parseFloat(k.l);
            const currentVol = parseFloat(k.v);
            const timeSec = Math.floor(k.t / 1000) as UTCTimestamp;

            // Flash effect
            if (prevPriceRef.current && prevPriceRef.current !== currentClose) {
              setPriceFlash(currentClose > prevPriceRef.current ? 'up' : 'down');
              setTimeout(() => setPriceFlash(null), 500);
            }
            prevPriceRef.current = currentClose;
            setLiveQuoteKey(requestKey);
            setLivePrice(currentClose);
            if (dailyReferencePriceRef.current > 0) {
              setPriceChange24h(Number((((currentClose - dailyReferencePriceRef.current) / dailyReferencePriceRef.current) * 100).toFixed(2)));
            }
            setHigh24h((current) => Math.max(current, currentHigh));
            setLow24h((current) => current > 0 ? Math.min(current, currentLow) : currentLow);

            // Update Candlestick in lightweight-charts
            if (candleSeriesRef.current) {
              candleSeriesRef.current.update({
                time: timeSec,
                open: currentOpen,
                high: currentHigh,
                low: currentLow,
                close: currentClose,
              });
            }

            // Update Volume
            if (volumeSeriesRef.current && showVolume) {
              volumeSeriesRef.current.update({
                time: timeSec,
                value: currentVol,
                color: currentClose >= currentOpen ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)',
              });
            }
          }
        } catch {
          // ignore parsing error
        }
      },
    });

    return () => {
      isMounted = false;
      connection.close();
    };
  }, [activeSymbol, timeframe, requestKey, showVolume]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTicker.trim()) {
      onSelectCoin(searchTicker.trim().toUpperCase());
      setSearchTicker('');
    }
  };

  const handleFitContent = () => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.timeScale().fitContent();
    }
  };

  const currentDisplayPoint = crosshairPoint || (visibleChartData.length > 0 ? visibleChartData[visibleChartData.length - 1] : null);

  return (
    <Card
      ref={containerRef}
      className={`mb-8 flex flex-col overflow-hidden shadow-xl transition-all duration-200 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : 'relative'
      }`}
    >
      {/* ======================================================== */}
      {/* 1. TOP BAR: PAIR SELECTOR, POPULAR ASSETS, SEARCH & ENGINE SWITCH */}
      {/* ======================================================== */}
      <div className="min-w-0 border-b bg-card p-3 sm:p-4">
        <div className="flex min-w-0 w-full flex-col gap-3">
          {/* Quick Select Popular Assets */}
          <div className="flex w-full min-w-0 items-center gap-1 overflow-x-auto rounded-xl border bg-muted/40 p-1 scrollbar-none" aria-label="Chọn nhanh cặp giao dịch">
            {POPULAR_CHART_COINS.map((c) => {
              const isSelected = activeSymbol === c.symbol;
              return (
                <Button
                  key={c.symbol}
                  onClick={() => onSelectCoin(c.symbol)}
                  variant={isSelected ? 'default' : 'ghost'}
                  size="sm"
                  className={`h-9 shrink-0 px-3 font-mono text-xs font-bold ${
                    isSelected
                      ? 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
                      : ''
                  }`}
                >
                  <span>{c.symbol}</span>
                </Button>
              );
            })}
          </div>

          <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_2.75rem] gap-2">
            {/* Search any coin */}
            <form onSubmit={handleSearchSubmit} className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                aria-label="Tìm mã giao dịch"
                placeholder="Tìm mã (VD: INJ, SUI)..."
                value={searchTicker}
                onChange={(e) => setSearchTicker(e.target.value)}
                className="h-11 w-full min-w-0 pl-9 font-mono text-sm"
              />
            </form>

            {/* Fullscreen Button */}
            <Button
              onClick={() => setIsFullscreen(!isFullscreen)}
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
              aria-label={isFullscreen ? 'Thu nhỏ biểu đồ' : 'Mở biểu đồ toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. REAL-TIME MARKET STATS RIBBON & TIMEFRAME SELECTOR */}
      {/* ======================================================== */}
      <div className="flex min-w-0 flex-col gap-3 border-b bg-muted/20 px-3 py-3 text-xs sm:px-4">
        {/* Price & 24h Stats */}
        <div className="grid min-w-0 gap-2">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-base font-extrabold tracking-tight text-foreground sm:text-lg">{activeSymbol}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">/USDT</span>
              <span className="size-2 shrink-0 rounded-full bg-emerald-400 motion-safe:animate-pulse" aria-hidden="true" />
            </div>
            <div
              className={`max-w-full whitespace-nowrap rounded-lg px-2.5 py-1 text-right font-mono text-base font-black tabular-nums transition-colors sm:text-lg ${
                priceFlash === 'up'
                  ? 'bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-400'
                  : priceFlash === 'down'
                  ? 'bg-rose-500/30 text-rose-300 ring-1 ring-rose-400'
                  : 'bg-muted text-foreground'
              }`}
            >
              {visibleLivePrice > 0 ? formatCurrency(visibleLivePrice) : '—'}
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* 24h Change */}
            <div className="flex items-center gap-1.5" aria-label="Biến động 24h">
              <span className="text-[11px] text-muted-foreground">24h:</span>
              <span
                className={`font-mono font-bold flex items-center space-x-0.5 px-2 py-0.5 rounded ${
                  visiblePriceChange24h === null
                    ? 'bg-muted text-muted-foreground border border-border'
                    : visiblePriceChange24h >= 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                {visiblePriceChange24h === null ? (
                  <span>—</span>
                ) : (
                  <>
                    {visiblePriceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{visiblePriceChange24h >= 0 ? `+${visiblePriceChange24h}%` : `${visiblePriceChange24h}%`}</span>
                  </>
                )}
              </span>
            </div>

            {/* Connection status badge */}
            <div className="flex min-w-0 items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 font-mono text-[10px]">
              {wsStatus === 'CONNECTED' ? (
                <>
                  <span className="size-2 shrink-0 rounded-full bg-emerald-400 motion-safe:animate-pulse" aria-hidden="true" />
                  <span className="truncate font-medium text-emerald-600 dark:text-emerald-300">Binance Live · từng tick</span>
                </>
              ) : (
                <>
                  <span className="size-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                  <span className="min-w-0 truncate font-medium text-amber-700 dark:text-amber-300">{hasCurrentQuote ? dataSource : visibleDataError ? 'Dữ liệu thị trường không khả dụng' : 'Đang tải dữ liệu thị trường…'}</span>
                </>
              )}
            </div>
          </div>

          {/* 24h High & Low */}
          {visibleHigh24h > 0 && (
            <div className="hidden md:flex items-center space-x-3 text-slate-400 font-mono text-[11px]">
              <div>
                <span>24h Cao: </span>
                <span className="text-slate-200 font-semibold">{formatCurrency(visibleHigh24h)}</span>
              </div>
              <div>
                <span>24h Thấp: </span>
                <span className="text-slate-200 font-semibold">{formatCurrency(visibleLow24h)}</span>
              </div>
              {visibleVolume24h > 0 && (
                <div>
                  <span>24h Vol: </span>
                  <span className="text-slate-200 font-semibold">{visibleVolume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })} {activeSymbol}</span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Timeframe Buttons & Indicator Controls */}
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Timeframe Selector */}
          <Tabs value={timeframe} onValueChange={setTimeframe} className="min-w-0 max-w-full overflow-x-auto scrollbar-none">
            <TabsList className="h-10 min-w-max gap-0.5 border bg-muted/40 p-0.5">
            {TIMEFRAMES.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="h-9 min-w-10 px-2 font-mono text-xs font-bold"
              >
                {t.label}
              </TabsTrigger>
            ))}
            </TabsList>
          </Tabs>

          <div className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto pb-0.5 text-[11px] scrollbar-none">
              <Button
                onClick={() => setShowSMA20(!showSMA20)}
                variant={showSMA20 ? 'outline' : 'ghost'}
                size="sm"
                className={`h-10 shrink-0 px-2 font-mono text-xs font-semibold ${
                  showSMA20
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-muted-foreground'
                }`}
              >
                MA20
              </Button>
              <Button
                onClick={() => setShowSMA50(!showSMA50)}
                variant={showSMA50 ? 'outline' : 'ghost'}
                size="sm"
                className={`h-10 shrink-0 px-2 font-mono text-xs font-semibold ${
                  showSMA50
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-muted-foreground'
                }`}
              >
                MA50
              </Button>
              <Button
                onClick={() => setShowEMA200(!showEMA200)}
                variant={showEMA200 ? 'outline' : 'ghost'}
                size="sm"
                className={`h-10 shrink-0 px-2 font-mono text-xs font-semibold ${
                  showEMA200
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'text-muted-foreground'
                }`}
              >
                EMA200
              </Button>
              <Button
                onClick={() => setShowVolume(!showVolume)}
                variant={showVolume ? 'outline' : 'ghost'}
                size="sm"
                className={`h-10 shrink-0 px-2 font-mono text-xs font-semibold ${
                  showVolume
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-muted-foreground'
                }`}
              >
                VOL
              </Button>
              <Button
                onClick={handleFitContent}
                variant="outline"
                size="sm"
                className="h-10 shrink-0 px-3 text-xs"
                title="Khôi phục góc nhìn"
              >
                Fit
              </Button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. CHART CANVAS & HUD OVERLAY */}
      {/* ======================================================== */}
      <div className="relative min-h-[460px] flex-1 bg-background sm:min-h-[540px]">
        {/* HUD Toolbar (crosshair information) */}
        {currentDisplayPoint && (
          <div className="pointer-events-none absolute left-3 right-3 top-2 z-20 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 overflow-hidden rounded-lg border bg-card/90 px-3 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur-md">
            <span className="text-foreground font-bold">{activeSymbol}/USDT</span>
            <span>
              O: <strong className="text-foreground">{currentDisplayPoint.open}</strong>
            </span>
            <span>
              H: <strong className="text-emerald-400">{currentDisplayPoint.high}</strong>
            </span>
            <span>
              L: <strong className="text-rose-400">{currentDisplayPoint.low}</strong>
            </span>
            <span>
              C:{' '}
              <strong
                className={
                  currentDisplayPoint.close >= currentDisplayPoint.open ? 'text-emerald-400' : 'text-rose-400'
                }
              >
                {currentDisplayPoint.close}
              </strong>
            </span>
            {currentDisplayPoint.volume > 0 && (
              <span>
                V: <strong className="text-slate-300">{currentDisplayPoint.volume.toLocaleString()}</strong>
              </span>
            )}
            {showSMA20 && <span className="text-amber-400">MA20</span>}
            {showSMA50 && <span className="text-cyan-400">MA50</span>}
            {showEMA200 && <span className="text-purple-400">EMA200</span>}
          </div>
        )}

        {/* LOADING SPINNER */}
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/70 backdrop-blur-xs">
            <div className="flex flex-col items-center space-y-2">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
              <span className="text-xs text-slate-400 font-mono">Đang kết nối luồng nến trực tiếp {activeSymbol}...</span>
            </div>
          </div>
        )}

        {visibleDataError && !loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/85 px-6 text-center">
            <Alert className="max-w-md bg-card text-left shadow-sm">
              <AlertTitle>Dữ liệu biểu đồ tạm thời không khả dụng</AlertTitle>
              <AlertDescription className="mt-2 break-words">{visibleDataError}</AlertDescription>
            </Alert>
          </div>
        )}

        <div ref={chartElementRef} className="w-full h-full min-h-[480px] sm:min-h-[560px]" />
      </div>

      {/* ======================================================== */}
      {/* 4. BOTTOM FOOTER TOOLBAR */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-300">Nguồn cấp dữ liệu:</span>
          <span className="text-emerald-400 font-mono font-medium">Binance/MEXC/OKX OHLCV, một nguồn dữ liệu duy nhất</span>
          <span>•</span>
          <span className="text-slate-400">Múi giờ: Asia/Ho_Chi_Minh (UTC+7)</span>
        </div>

        <span className="text-slate-400">Giá hiển thị luôn là giá đóng cửa của cây nến mới nhất.</span>
      </div>
    </Card>
  );
};
