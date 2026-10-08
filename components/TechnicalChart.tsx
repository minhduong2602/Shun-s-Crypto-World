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

interface TechnicalChartProps {
  selectedCoinId: string;
  onSelectCoin: (coinId: string) => void;
  baseCurrency: string;
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
}) => {
  const [timeframe, setTimeframe] = useState<string>('15m');
  const [chartData, setChartData] = useState<OHLCVPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
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

  const activeSymbol = (selectedCoinId || 'BTC').toUpperCase();

  // Format currency
  const formatCurrency = (val: number) => {
    if (baseCurrency === 'VND') {
      const vndVal = val * 25450;
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(vndVal);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: val < 1 ? 4 : 2,
      maximumFractionDigits: val < 1 ? 6 : 2,
    }).format(val);
  };

  // 1. Fetch Historical Klines from API
  useEffect(() => {
    let isMounted = true;
    async function loadHistoricalData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/market/chart?coinId=${activeSymbol}&timeframe=${timeframe}`);
        const json = await res.json();
        if (!res.ok || !json.isLive || !Array.isArray(json.data) || json.data.length === 0) {
          if (isMounted) {
            setChartData([]);
            setDataError(json.error || 'Nguồn giá trực tiếp hiện không phản hồi.');
            setLivePrice(0);
          }
          return;
        }

        if (isMounted) {
          setDataError(null);
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
          setDataSource(json.dataSource || 'Binance / MEXC Live');

          const latestClose = json.currentPrice || cleanData[cleanData.length - 1].close;
          if (prevPriceRef.current && prevPriceRef.current !== latestClose) {
            setPriceFlash(latestClose > prevPriceRef.current ? 'up' : 'down');
            setTimeout(() => setPriceFlash(null), 800);
          }
          prevPriceRef.current = latestClose;
          setLivePrice(latestClose);

          // Calculate 24h stats
          const highs = cleanData.map((d) => d.high);
          const lows = cleanData.map((d) => d.low);
          const vols = cleanData.map((d) => d.volume);
          setHigh24h(Math.max(...highs));
          setLow24h(Math.min(...lows));
          setVolume24h(vols.reduce((a, b) => a + b, 0));

          const firstOpen = cleanData[0].open;
          if (firstOpen > 0) {
            const chg = ((latestClose - firstOpen) / firstOpen) * 100;
            setPriceChange24h(Number(chg.toFixed(2)));
          }
        }
      } catch (err) {
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
  }, [activeSymbol, timeframe]);

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
    if (chartData.length === 0) return;

    const candleFormatted = chartData.map((d) => ({
      time: d.time as UTCTimestamp,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candleSeriesRef.current.setData(candleFormatted);

    if (volumeSeriesRef.current) {
      if (showVolume) {
        const volumeFormatted = chartData.map((d) => ({
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
      sma20SeriesRef.current.setData(showSMA20 ? calculateSMA(chartData, 20) : []);
    }
    if (sma50SeriesRef.current) {
      sma50SeriesRef.current.setData(showSMA50 ? calculateSMA(chartData, 50) : []);
    }
    if (ema200SeriesRef.current) {
      ema200SeriesRef.current.setData(showEMA200 ? calculateEMA(chartData, 200) : []);
    }

    chartInstanceRef.current.timeScale().fitContent();
  }, [chartData, showSMA20, showSMA50, showEMA200, showVolume]);

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

    let ws: WebSocket | null = null;
    let isMounted = true;

    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${pair}@kline_${wsInterval}`);

      ws.onopen = () => {
        if (isMounted) setWsStatus('CONNECTED');
      };

      ws.onmessage = (event) => {
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
            setLivePrice(currentClose);

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
      };

      ws.onerror = () => {
        if (isMounted) setWsStatus('FALLBACK_REST');
      };

      ws.onclose = () => {
        if (isMounted) setWsStatus('DISCONNECTED');
      };
    } catch {
      setTimeout(() => {
        if (isMounted) setWsStatus('FALLBACK_REST');
      }, 0);
    }

    return () => {
      isMounted = false;
      if (ws) {
        ws.close();
      }
    };
  }, [activeSymbol, timeframe, showVolume]);

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

  const currentDisplayPoint = crosshairPoint || (chartData.length > 0 ? chartData[chartData.length - 1] : null);

  return (
    <div
      ref={containerRef}
      className={`bg-[#0d1117] border border-[#21262d] rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 mb-8 flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : 'relative'
      }`}
    >
      {/* ======================================================== */}
      {/* 1. TOP BAR: PAIR SELECTOR, POPULAR ASSETS, SEARCH & ENGINE SWITCH */}
      {/* ======================================================== */}
      <div className="bg-[#161b22] border-b border-[#21262d] p-3 sm:p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3">
        {/* Left: Active Coin & Quick Coin Pills */}
        <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap gap-y-2">
          {/* Active Symbol Display */}
          <div className="flex items-center space-x-2 bg-[#090d12] px-3 py-1.5 rounded-xl border border-[#30363d]">
            <span className="font-extrabold text-xl text-white font-mono tracking-tight">{activeSymbol}</span>
            <span className="text-slate-400 text-xs font-mono">/USDT</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          </div>

          {/* Quick Select Popular Assets */}
          <div className="flex items-center space-x-1 bg-[#090d12] p-1 rounded-xl border border-[#30363d] overflow-x-auto max-w-[320px] sm:max-w-[420px] scrollbar-none">
            {POPULAR_CHART_COINS.map((c) => {
              const isSelected = activeSymbol === c.symbol;
              return (
                <button
                  key={c.symbol}
                  onClick={() => onSelectCoin(c.symbol)}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-all flex items-center space-x-1 ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-[#161b22]'
                  }`}
                >
                  <span>{c.symbol}</span>
                </button>
              );
            })}
          </div>

          {/* Search any coin */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm mã (VD: INJ, SUI)..."
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value)}
              className="w-36 sm:w-44 pl-7 pr-3 py-1.5 bg-[#090d12] border border-[#30363d] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </form>
        </div>

        {/* Right: fullscreen */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {/* Fullscreen Button */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-[#090d12] border border-[#30363d] text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. REAL-TIME MARKET STATS RIBBON & TIMEFRAME SELECTOR */}
      {/* ======================================================== */}
      <div className="bg-[#11161d] border-b border-[#21262d] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Price & 24h Stats */}
        <div className="flex items-center space-x-4 flex-wrap gap-y-2">
          {/* Live Price */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[11px]">Giá Live:</span>
            <div
              className={`px-2.5 py-1 rounded-lg font-mono font-black text-base sm:text-lg transition-colors ${
                priceFlash === 'up'
                  ? 'bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-400'
                  : priceFlash === 'down'
                  ? 'bg-rose-500/30 text-rose-300 ring-1 ring-rose-400'
                  : 'bg-[#161b22] text-white'
              }`}
            >
              {formatCurrency(livePrice)}
            </div>
          </div>

          {/* 24h Change */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 text-[11px]">Biến động:</span>
            <span
              className={`font-mono font-bold flex items-center space-x-0.5 px-2 py-0.5 rounded ${
                priceChange24h >= 0
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}
            >
              {priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{priceChange24h >= 0 ? `+${priceChange24h}%` : `${priceChange24h}%`}</span>
            </span>
          </div>

          {/* 24h High & Low */}
          {high24h > 0 && (
            <div className="hidden md:flex items-center space-x-3 text-slate-400 font-mono text-[11px]">
              <div>
                <span>24h Cao: </span>
                <span className="text-slate-200 font-semibold">{formatCurrency(high24h)}</span>
              </div>
              <div>
                <span>24h Thấp: </span>
                <span className="text-slate-200 font-semibold">{formatCurrency(low24h)}</span>
              </div>
              {volume24h > 0 && (
                <div>
                  <span>24h Vol: </span>
                  <span className="text-slate-200 font-semibold">{volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })} {activeSymbol}</span>
                </div>
              )}
            </div>
          )}

          {/* Connection status badge */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#161b22] border border-[#30363d] text-[10px] font-mono">
            {wsStatus === 'CONNECTED' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-emerald-400 font-medium">Binance WS Stream (Từng tick)</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="text-amber-300 font-medium">{dataSource}</span>
              </>
            )}
          </div>
        </div>

        {/* Timeframe Buttons & Indicator Controls */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          {/* Timeframe Selector */}
          <div className="flex items-center space-x-0.5 bg-[#090d12] p-0.5 rounded-lg border border-[#30363d]">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeframe(t.id)}
                className={`px-2 py-0.5 text-xs font-mono font-bold rounded transition-colors ${
                  timeframe === t.id
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-1 text-[11px]">
              <button
                onClick={() => setShowSMA20(!showSMA20)}
                className={`px-2 py-0.5 rounded font-mono font-semibold transition-colors ${
                  showSMA20
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-[#161b22] text-slate-500 border border-transparent'
                }`}
              >
                MA20
              </button>
              <button
                onClick={() => setShowSMA50(!showSMA50)}
                className={`px-2 py-0.5 rounded font-mono font-semibold transition-colors ${
                  showSMA50
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-[#161b22] text-slate-500 border border-transparent'
                }`}
              >
                MA50
              </button>
              <button
                onClick={() => setShowEMA200(!showEMA200)}
                className={`px-2 py-0.5 rounded font-mono font-semibold transition-colors ${
                  showEMA200
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'bg-[#161b22] text-slate-500 border border-transparent'
                }`}
              >
                EMA200
              </button>
              <button
                onClick={() => setShowVolume(!showVolume)}
                className={`px-2 py-0.5 rounded font-mono font-semibold transition-colors ${
                  showVolume
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-[#161b22] text-slate-500 border border-transparent'
                }`}
              >
                VOL
              </button>
              <button
                onClick={handleFitContent}
                className="px-2 py-0.5 rounded bg-[#161b22] text-slate-300 hover:text-white border border-[#30363d]"
                title="Khôi phục góc nhìn"
              >
                Fit
              </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. CHART CANVAS & HUD OVERLAY */}
      {/* ======================================================== */}
      <div className="relative flex-1 min-h-[460px] sm:min-h-[540px] bg-[#090d12]">
        {/* HUD Toolbar (crosshair information) */}
        {currentDisplayPoint && (
          <div className="absolute top-2 left-3 z-20 flex items-center space-x-3 text-[11px] font-mono bg-[#161b22]/90 backdrop-blur-md px-3 py-1 rounded-lg border border-[#30363d]/80 pointer-events-none text-slate-300 flex-wrap gap-y-1">
            <span className="text-white font-bold">{activeSymbol}/USDT</span>
            <span>
              O: <strong className="text-white">{currentDisplayPoint.open}</strong>
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
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#090d12]/70 backdrop-blur-xs">
            <div className="flex flex-col items-center space-y-2">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
              <span className="text-xs text-slate-400 font-mono">Đang kết nối luồng nến trực tiếp {activeSymbol}...</span>
            </div>
          </div>
        )}

        {dataError && !loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#090d12]/85 px-6 text-center">
            <div className="max-w-md rounded-xl border border-amber-500/30 bg-[#161b22] p-5 text-sm text-amber-200">
              <p className="font-semibold">Không hiển thị dữ liệu mô phỏng</p>
              <p className="mt-2 text-slate-300">{dataError}</p>
            </div>
          </div>
        )}

        <div ref={chartElementRef} className="w-full h-full min-h-[480px] sm:min-h-[560px]" />
      </div>

      {/* ======================================================== */}
      {/* 4. BOTTOM FOOTER TOOLBAR */}
      {/* ======================================================== */}
      <div className="bg-[#161b22] border-t border-[#21262d] px-4 py-2 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-300">Nguồn cấp dữ liệu:</span>
          <span className="text-emerald-400 font-mono font-medium">Binance/MEXC/OKX OHLCV, một nguồn dữ liệu duy nhất</span>
          <span>•</span>
          <span className="text-slate-400">Múi giờ: Asia/Ho_Chi_Minh (UTC+7)</span>
        </div>

        <span className="text-slate-400">Giá hiển thị luôn là giá đóng cửa của cây nến mới nhất.</span>
      </div>
    </div>
  );
};
