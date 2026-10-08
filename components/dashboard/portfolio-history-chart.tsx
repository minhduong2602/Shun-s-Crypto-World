'use client';

import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPortfolioCurrency } from '@/lib/format-portfolio-currency';
import type { PortfolioSnapshot } from '@/lib/portfolio/history';

type Range = '7d' | '30d' | '90d' | '1y';

function formatCurrency(amount: number, baseCurrency: string, usdVndRate?: number | null) {
  return formatPortfolioCurrency(amount, baseCurrency, usdVndRate);
}

function toLinePoints(snapshots: PortfolioSnapshot[]) {
  if (snapshots.length === 0) return '';
  const values = snapshots.map((snapshot) => snapshot.totalValueUsd);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || Math.max(Math.abs(max) * 0.02, 1);
  const left = 16;
  const right = 984;
  const top = 16;
  const bottom = 204;
  return snapshots.map((snapshot, index) => {
    const x = snapshots.length === 1 ? (left + right) / 2 : left + (index / (snapshots.length - 1)) * (right - left);
    const y = bottom - ((snapshot.totalValueUsd - min) / spread) * (bottom - top);
    return `${x},${y}`;
  }).join(' ');
}

export function PortfolioHistoryChart({ baseCurrency = 'USD', usdVndRate }: { baseCurrency?: string; usdVndRate?: number | null }) {
  const [range, setRange] = useState<Range>('30d');
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [loadedRange, setLoadedRange] = useState<Range | null>(null);
  const [rangeError, setRangeError] = useState<{ range: Range; message: string } | null>(null);
  const loading = loadedRange !== range;
  const error = rangeError?.range === range ? rangeError.message : null;

  useEffect(() => {
    let ignore = false;
    fetch(`/api/portfolio/history?range=${range}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Không tải được lịch sử danh mục.');
        return payload as { snapshots: PortfolioSnapshot[] };
      })
      .then((payload) => {
        if (ignore) return;
        setSnapshots(payload.snapshots);
        setRangeError(null);
        setLoadedRange(range);
      })
      .catch((cause) => {
        if (ignore) return;
        setRangeError({ range, message: cause instanceof Error ? cause.message : 'Không tải được lịch sử danh mục.' });
        setLoadedRange(range);
      });
    return () => { ignore = true; };
  }, [range]);

  const latest = snapshots.at(-1);
  const first = snapshots[0];
  const linePoints = toLinePoints(snapshots);

  return <Card>
    <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1.5">
        <CardTitle>Lịch sử giá trị danh mục</CardTitle>
        <CardDescription>{latest ? `Cập nhật đến ${new Date(`${latest.date}T00:00:00`).toLocaleDateString('vi-VN')}` : 'Giá trị ghi nhận hằng ngày từ sổ giao dịch'}</CardDescription>
      </div>
      <Tabs value={range} onValueChange={(value) => setRange(value as Range)} aria-label="Khoảng thời gian lịch sử">
        <TabsList>
          <TabsTrigger value="7d">7 ngày</TabsTrigger>
          <TabsTrigger value="30d">30 ngày</TabsTrigger>
          <TabsTrigger value="90d">90 ngày</TabsTrigger>
          <TabsTrigger value="1y">1 năm</TabsTrigger>
        </TabsList>
      </Tabs>
    </CardHeader>
    <CardContent>
      {loading ? <Skeleton role="status" aria-label="Đang tải lịch sử danh mục" className="h-56 w-full" /> : error ? (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      ) : snapshots.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Chưa có dữ liệu lịch sử. Snapshot đầu tiên sẽ được ghi sau khi bật lịch chạy hằng ngày.</div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(latest!.totalValueUsd, baseCurrency, usdVndRate)}</p>
            {first && latest && <p className={`text-sm tabular-nums ${latest.totalValueUsd >= first.totalValueUsd ? 'text-emerald-500' : 'text-destructive'}`}>
              {latest.totalValueUsd >= first.totalValueUsd ? '+' : ''}{formatCurrency(latest.totalValueUsd - first.totalValueUsd, baseCurrency, usdVndRate)} trong kỳ
            </p>}
          </div>
          <svg className="h-56 w-full overflow-visible text-emerald-500" viewBox="0 0 1000 220" preserveAspectRatio="none" role="img" aria-label={`Lịch sử giá trị danh mục: ${snapshots.length} điểm dữ liệu`}>
            {[0, 1, 2, 3].map((line) => <line key={line} x1="16" x2="984" y1={16 + line * 62} y2={16 + line * 62} className="stroke-border" strokeDasharray="3 5" />)}
            {snapshots.length === 1 ? <circle cx="500" cy="110" r="5" fill="currentColor" /> : <polyline points={linePoints} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
          </svg>
          <div className="flex justify-between text-xs text-muted-foreground"><span>{first?.date}</span><span>{latest?.date}</span></div>
        </div>
      )}
    </CardContent>
  </Card>;
}
