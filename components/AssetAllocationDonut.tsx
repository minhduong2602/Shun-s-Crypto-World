'use client';

import React from 'react';
import { PieChart, Layers } from 'lucide-react';
import { Holding } from '@/lib/types';

interface AssetAllocationDonutProps {
  holdings: Holding[];
  baseCurrency: string;
}

const PALETTE = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#3b82f6', // blue
  '#14b8a6', // teal
  '#f97316', // orange
];

export const AssetAllocationDonut: React.FC<AssetAllocationDonutProps> = ({
  holdings,
  baseCurrency,
}) => {
  const totalVal = holdings.reduce((acc, h) => acc + h.currentValue, 0);

  const formatCurrency = (val: number) => {
    if (baseCurrency === 'VND') {
      const vndVal = val * 25450;
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(vndVal);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  // Build SVG Donut arcs
  const radius = 64;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  const { slices } = holdings.reduce<{
    slices: {
      holding: Holding;
      color: string;
      strokeDasharray: string;
      strokeDashoffset: number;
      fraction: number;
    }[];
    cumulative: number;
  }>(
    (acc, h, i) => {
      const fraction = totalVal > 0 ? h.currentValue / totalVal : 0;
      const strokeDasharray = `${fraction * circumference} ${circumference}`;
      const strokeDashoffset = -acc.cumulative * circumference;
      acc.slices.push({
        holding: h,
        color: PALETTE[i % PALETTE.length],
        strokeDasharray,
        strokeDashoffset,
        fraction,
      });
      acc.cumulative += fraction;
      return acc;
    },
    { slices: [], cumulative: 0 }
  );

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-xl mb-8">
      <div className="flex items-center justify-between pb-4 border-b border-[#21262d]">
        <h3 className="font-bold text-white text-base flex items-center space-x-2">
          <PieChart className="w-4 h-4 text-emerald-400" />
          <span>Phân Bổ Tỷ Trọng Tài Sản (Asset Allocation)</span>
        </h3>
        <span className="text-xs text-slate-400 font-mono">
          Tổng: <strong className="text-white">{formatCurrency(totalVal)}</strong>
        </span>
      </div>

      <div className="mt-6 flex flex-col md:flex-row items-center justify-around gap-6">
        {/* Donut graphic */}
        <div className="relative w-44 h-44 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#21262d"
              strokeWidth={strokeWidth}
            />
            {slices.map((slice, i) => (
              <circle
                key={i}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            ))}
          </svg>
          <div className="absolute text-center">
            <span className="text-[11px] text-slate-400 block">Tài sản</span>
            <span className="text-lg font-extrabold text-white font-mono">{holdings.length}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1 text-xs w-full">
          {slices.map((slice, i) => (
            <div
              key={i}
              className="p-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: slice.color }}
                ></span>
                <div>
                  <div className="font-bold text-white">{slice.holding.symbol}</div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[80px]">
                    {slice.holding.name}
                  </div>
                </div>
              </div>
              <div className="text-right font-mono">
                <div className="text-emerald-400 font-bold">{slice.holding.allocationPercentage}%</div>
                <div className="text-[10px] text-slate-400">
                  {formatCurrency(slice.holding.currentValue)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
