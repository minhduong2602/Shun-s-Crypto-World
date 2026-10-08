'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  BarChart2,
  Calendar,
  Layers,
  Maximize2,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Search,
  Radio,
} from 'lucide-react';
import { OHLCVPoint } from '@/lib/types';

interface TechnicalChartProps {
  selectedCoinId: string;
  onSelectCoin: (coinId: string) => void;
  baseCurrency: string;
}

const POPULAR_CHART_COINS = ['BTC', 'ETH', 'SOL', 'SUI', 'BNB', 'DOGE', 'PEPE', 'TAO', 'RENDER', 'NEAR'];

export const TechnicalChart: React.FC<TechnicalChartProps> = ({
  selectedCoinId,
  onSelectCoin,
  baseCurrency,
}) => {
  const [timeframe, setTimeframe] = useState<'1H' | '4H' | '1D' | '1W' | '1Y'>('1D');
  const [chartType, setChartType] = useState<'candlestick' | 'area'>('candlestick');
  const [chartData, setChartData] = useState<OHLCVPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [livePrice, setLivePrice] = useState<number>(0);
  const [searchTicker, setSearchTicker] = useState('');
  const [isLive, setIsLive] = useState(true);

  const activeSymbol = (selectedCoinId || 'BTC').toUpperCase();

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/market/chart?coinId=${activeSymbol}&timeframe=${timeframe}`);
        const json = await res.json();
        if (isMounted) {
          if (json.data && json.data.length > 0) {
            setChartData(json.data);
            setLivePrice(json.currentPrice || json.data[json.data.length - 1].close);
            setIsLive(json.isLive ?? true);
          }
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu biểu đồ:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    const interval = setInterval(loadData, 10000); // 10s auto-refresh for live candles
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeSymbol, timeframe]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTicker.trim()) {
      onSelectCoin(searchTicker.trim().toUpperCase());
      setSearchTicker('');
    }
  };

  const activePoint =
    hoverIndex !== null && chartData[hoverIndex]
      ? chartData[hoverIndex]
      : chartData[chartData.length - 1];

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

  // Dimensions
  const svgWidth = 840;
  const svgHeight = 380;
  const paddingBottom = 40;
  const paddingRight = 60;
  const paddingTop = 20;
  const paddingLeft = 10;

  const chartAreaHeight = svgHeight - paddingTop - paddingBottom;
  const chartAreaWidth = svgWidth - paddingLeft - paddingRight;

  const minPrice = chartData.length ? Math.min(...chartData.map((d) => d.low)) * 0.995 : 0;
  const maxPrice = chartData.length ? Math.max(...chartData.map((d) => d.high)) * 1.005 : 1;
  const priceRange = maxPrice - minPrice || 1;

  const maxVolume = chartData.length ? Math.max(...chartData.map((d) => d.volume)) : 1;

  const getY = (price: number) => {
    return paddingTop + chartAreaHeight * (1 - (price - minPrice) / priceRange);
  };

  const getX = (idx: number) => {
    if (chartData.length <= 1) return paddingLeft;
    return paddingLeft + (idx / (chartData.length - 1)) * chartAreaWidth;
  };

  const areaPath = chartData.length
    ? `M ${getX(0)},${chartAreaHeight + paddingTop} ` +
      chartData.map((d, i) => `L ${getX(i)},${getY(d.close)}`).join(' ') +
      ` L ${getX(chartData.length - 1)},${chartAreaHeight + paddingTop} Z`
    : '';

  const linePath = chartData.length
    ? `M ` + chartData.map((d, i) => `${getX(i)},${getY(d.close)}`).join(' L ')
    : '';

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-xl mb-8">
      {/* Top Controls: Coin selector, ticker search, timeframe, chart mode */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-[#21262d]">
        {/* Coin Selector & Live search */}
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-2xl text-white font-mono">{activeSymbol}</span>
            <span className="text-slate-400 text-xs font-mono">/ USDT</span>
            <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Live Binance Klines</span>
            </div>
          </div>

          {/* Quick Select Buttons */}
          <div className="flex items-center space-x-1 bg-[#0d1117] p-1 rounded-xl border border-[#30363d] overflow-x-auto max-w-[340px]">
            {POPULAR_CHART_COINS.map((sym) => (
              <button
                key={sym}
                onClick={() => onSelectCoin(sym)}
                className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeSymbol === sym
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-[#21262d]'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>

          {/* Custom Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Nhập mã khác (VD: PEPE, WIF...)"
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
              className="pl-8 pr-3 py-1 bg-[#0d1117] border border-[#30363d] rounded-xl text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-36 sm:w-44"
            />
          </form>
        </div>

        {/* Timeframe & Mode */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {/* Timeframes */}
          <div className="flex items-center bg-[#0d1117] p-1 rounded-xl border border-[#30363d]">
            {(['1H', '4H', '1D', '1W', '1Y'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                  timeframe === tf
                    ? 'bg-[#21262d] text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Mode */}
          <div className="flex items-center bg-[#0d1117] p-1 rounded-xl border border-[#30363d]">
            <button
              onClick={() => setChartType('candlestick')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                chartType === 'candlestick'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Nến Nhật
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                chartType === 'area'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Đường vùng
            </button>
          </div>
        </div>
      </div>

      {/* OHLCV Live Inspector Bar */}
      {activePoint && (
        <div className="py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-mono border-b border-[#21262d] text-slate-300">
          <div>
            <span className="text-slate-500 mr-1.5">Giá Live:</span>
            <span className="text-white font-bold text-sm">
              {formatCurrency(activePoint.close)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 mr-1">O:</span>
            <span className="text-slate-200">{formatCurrency(activePoint.open)}</span>
          </div>
          <div>
            <span className="text-slate-500 mr-1">H:</span>
            <span className="text-emerald-400">{formatCurrency(activePoint.high)}</span>
          </div>
          <div>
            <span className="text-slate-500 mr-1">L:</span>
            <span className="text-rose-400">{formatCurrency(activePoint.low)}</span>
          </div>
          <div>
            <span className="text-slate-500 mr-1">C:</span>
            <span
              className={
                activePoint.close >= activePoint.open ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'
              }
            >
              {formatCurrency(activePoint.close)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 mr-1">Vol:</span>
            <span className="text-slate-300">${(activePoint.volume / 1e3).toFixed(1)}k</span>
          </div>
          <div className="text-slate-500 text-[11px] ml-auto">
            {new Date(activePoint.time * 1000).toLocaleString('vi-VN')}
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="relative mt-4 w-full h-[380px] bg-[#0d1117] rounded-xl border border-[#21262d] overflow-hidden select-none">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center space-x-2 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
            <span className="text-xs font-mono">Đang tải nến trực tiếp từ Binance ({activeSymbol}USDT)...</span>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full cursor-crosshair"
            onMouseLeave={() => setHoverIndex(null)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = (e.clientX - rect.left) / rect.width;
              const idx = Math.min(
                chartData.length - 1,
                Math.max(0, Math.round(relX * (chartData.length - 1)))
              );
              setHoverIndex(idx);
            }}
          >
            {/* Grid horizontal lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const y = paddingTop + chartAreaHeight * pct;
              const priceVal = maxPrice - pct * priceRange;
              return (
                <g key={i}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke="#21262d"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={svgWidth - paddingRight + 6}
                    y={y + 4}
                    fill="#6e7681"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    ${priceVal < 1 ? priceVal.toFixed(4) : priceVal > 100 ? priceVal.toFixed(0) : priceVal.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* Volume Histogram Bars at bottom */}
            {chartData.map((d, i) => {
              const barWidth = Math.max(2, (chartAreaWidth / chartData.length) * 0.6);
              const x = getX(i) - barWidth / 2;
              const barHeight = (d.volume / maxVolume) * 45;
              const y = svgHeight - paddingBottom - barHeight;
              const isUp = d.close >= d.open;
              return (
                <rect
                  key={`vol-${i}`}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={isUp ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'}
                />
              );
            })}

            {/* Area or Candlestick mode */}
            {chartType === 'area' ? (
              <>
                <defs>
                  <linearGradient id="chartGradientLive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill="url(#chartGradientLive)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            ) : (
              // Candlesticks
              chartData.map((d, i) => {
                const x = getX(i);
                const candleWidth = Math.max(3, (chartAreaWidth / chartData.length) * 0.65);
                const isGreen = d.close >= d.open;
                const candleColor = isGreen ? '#10b981' : '#f43f5e';

                const wickTop = getY(d.high);
                const wickBottom = getY(d.low);

                const bodyTop = getY(Math.max(d.open, d.close));
                const bodyBottom = getY(Math.min(d.open, d.close));
                const bodyHeight = Math.max(2, bodyBottom - bodyTop);

                return (
                  <g key={`candle-${i}`}>
                    {/* Wick */}
                    <line
                      x1={x}
                      y1={wickTop}
                      x2={x}
                      y2={wickBottom}
                      stroke={candleColor}
                      strokeWidth="1.2"
                    />
                    {/* Candle body */}
                    <rect
                      x={x - candleWidth / 2}
                      y={bodyTop}
                      width={candleWidth}
                      height={bodyHeight}
                      fill={candleColor}
                      rx="1"
                    />
                  </g>
                );
              })
            )}

            {/* Crosshair when hovering */}
            {hoverIndex !== null && (
              <>
                <line
                  x1={getX(hoverIndex)}
                  y1={paddingTop}
                  x2={getX(hoverIndex)}
                  y2={svgHeight - paddingBottom}
                  stroke="#8b949e"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(chartData[hoverIndex].close)}
                  r="4"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </>
            )}
          </svg>
        )}
      </div>
    </div>
  );
};
