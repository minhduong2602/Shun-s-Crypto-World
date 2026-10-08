'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Compass,
  ArrowRight,
} from 'lucide-react';
import { AiRecommendation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AiPortfolioDoctorProps {
  initialAnalysis: AiRecommendation | null;
}

export const AiPortfolioDoctor: React.FC<AiPortfolioDoctorProps> = ({ initialAnalysis }) => {
  const [analysis, setAnalysis] = useState<AiRecommendation | null>(initialAnalysis);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRunAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/analyze', { method: 'POST' });
      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
      } else {
        setError(data.error || 'Không thể phân tích danh mục.');
      }
    } catch (e) {
      setError('Không thể kết nối dịch vụ phân tích. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 40) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score < 70) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'ACCUMULATE':
        return <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">MUA TÍCH LŨY</Badge>;
      case 'TAKE_PROFIT':
        return <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400">CHỐT LỜI TỪNG PHẦN</Badge>;
      case 'REDUCE':
        return <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">HẠ TỶ TRỌNG</Badge>;
      default:
        return <Badge variant="secondary">NẮM GIỮ (HOLD)</Badge>;
    }
  };

  return (
    <Card className="space-y-6">
      {/* Top Banner */}
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <CardTitle>Trợ lý AI danh mục</CardTitle>
              <Badge variant="secondary" className="font-mono">
                Gemini Flash
              </Badge>
            </div>
            <CardDescription>Phân tích danh mục của bạn và nêu rõ các giới hạn dữ liệu.</CardDescription>
          </div>
        </div>

        <Button
          onClick={handleRunAnalysis}
          disabled={loading}
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Đang phân tích danh mục...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{analysis ? 'Cập nhật phân tích AI mới' : 'Khởi chạy phân tích ngay'}</span>
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Main Analysis Results */}
      {analysis ? (
        <div className="space-y-6">
          {/* Executive Summary Card */}
          <div className="p-4 sm:p-5 bg-muted/40 rounded-xl border relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
              <h3 className="font-bold text-foreground text-sm flex items-center space-x-2">
                <Compass className="w-4 h-4 text-primary" />
                <span>Đánh Giá Tổng Quan Từ AI</span>
              </h3>

              <div className="flex items-center space-x-3 text-xs">
                {/* Risk Score */}
                <div
                  className={`px-3 py-1 rounded-lg border font-mono font-bold flex items-center space-x-1.5 ${getRiskColor(
                    analysis.riskScore
                  )}`}
                >
                  <span>Chỉ số rủi ro:</span>
                  <span className="text-sm">{analysis.riskScore}/100</span>
                </div>

                {/* Sentiment */}
                <div className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold flex items-center space-x-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>{analysis.marketSentiment}</span>
                </div>
              </div>
            </div>

              <p className="text-xs text-muted-foreground leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Strengths & Warnings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Strengths */}
            <div className="p-4 bg-muted/40 rounded-xl border space-y-2.5">
              <h4 className="font-bold text-emerald-400 flex items-center space-x-1.5 text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Điểm Mạnh Của Danh Mục</span>
              </h4>
              <ul className="space-y-2 text-muted-foreground">
                {analysis.portfolioStrengths.map((str, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Warnings */}
            <div className="p-4 bg-muted/40 rounded-xl border space-y-2.5">
              <h4 className="font-bold text-amber-400 flex items-center space-x-1.5 text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>Cảnh Báo &amp; Điểm Cần Lưu Ý</span>
              </h4>
              <ul className="space-y-2 text-muted-foreground">
                {analysis.riskWarnings.map((warn, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{warn}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Rebalance Recommendations Table */}
            <Card className="p-4">
            <h4 className="font-bold text-foreground text-xs mb-3 flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Đề Xuất Tái Cân Bằng Tỷ Trọng (Strategic Rebalancing)</span>
            </h4>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tài sản</TableHead>
                    <TableHead>Tỷ trọng hiện tại</TableHead>
                    <TableHead>Tỷ trọng đề xuất</TableHead>
                    <TableHead>Hành động gợi ý</TableHead>
                    <TableHead>Lý do chiến lược</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.rebalanceSuggestions.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono font-bold">{item.symbol}</TableCell>
                      <TableCell className="font-mono">{item.currentAllocationPct}%</TableCell>
                      <TableCell className="font-mono text-emerald-400 font-semibold">
                        {item.targetAllocationPct}%
                      </TableCell>
                      <TableCell>{getActionBadge(item.action)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{item.reasoning}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </Card>

          {/* Macro Insight */}
          {analysis.macroInsight && (
            <div className="p-4 bg-gradient-to-r from-blue-950/30 to-indigo-950/30 border border-blue-500/20 rounded-xl text-xs text-blue-200">
              <span className="font-bold block mb-1">Góc nhìn vĩ mô &amp; Dòng tiền:</span>
              <p className="leading-relaxed">{analysis.macroInsight}</p>
            </div>
          )}
        </div>
      ) : (
          <div className="py-12 text-center text-muted-foreground space-y-3">
          <Sparkles className="w-10 h-10 text-primary mx-auto animate-pulse" />
          <h3 className="text-base font-bold text-foreground">Chưa có phân tích danh mục nào</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Bấm nút &ldquo;Khởi chạy phân tích ngay&rdquo; để Gemini AI đọc toàn bộ số dư và giao dịch của bạn, sau đó đưa ra lời khuyên tối ưu hóa lợi nhuận và giảm thiểu rủi ro.
          </p>
        </div>
      )}
      </CardContent>
    </Card>
  );
};
