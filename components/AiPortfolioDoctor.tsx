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

interface AiPortfolioDoctorProps {
  initialAnalysis: AiRecommendation | null;
}

export const AiPortfolioDoctor: React.FC<AiPortfolioDoctorProps> = ({ initialAnalysis }) => {
  const [analysis, setAnalysis] = useState<AiRecommendation | null>(initialAnalysis);
  const [loading, setLoading] = useState(false);

  const handleRunAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/analyze', { method: 'POST' });
      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
      }
    } catch (e) {
      console.error(e);
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
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">MUA TÍCH LŨY</span>;
      case 'TAKE_PROFIT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">CHỐT LỜI TỪNG PHẦN</span>;
      case 'REDUCE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">HẠ TỶ TRỌNG</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">NẮM GIỮ (HOLD)</span>;
    }
  };

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-xl space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#21262d]">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-white">Gemini AI Portfolio Doctor</h2>
              <span className="px-2 py-0.5 text-[10px] bg-cyan-500/15 text-cyan-300 font-mono font-semibold rounded-md border border-cyan-500/30">
                gemini-3.8-flash
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Phân tích định lượng cấu trúc rủi ro, tâm lý chu kỳ và đề xuất tái cân bằng (Rebalancing)
            </p>
          </div>
        </div>

        <button
          onClick={handleRunAnalysis}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
        </button>
      </div>

      {/* Main Analysis Results */}
      {analysis ? (
        <div className="space-y-6">
          {/* Executive Summary Card */}
          <div className="p-4 sm:p-5 bg-[#0d1117] rounded-xl border border-[#21262d] relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
              <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                <Compass className="w-4 h-4 text-cyan-400" />
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

            <p className="text-xs text-slate-300 leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Strengths & Warnings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Strengths */}
            <div className="p-4 bg-[#0d1117] rounded-xl border border-[#21262d] space-y-2.5">
              <h4 className="font-bold text-emerald-400 flex items-center space-x-1.5 text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Điểm Mạnh Của Danh Mục</span>
              </h4>
              <ul className="space-y-2 text-slate-300">
                {analysis.portfolioStrengths.map((str, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Warnings */}
            <div className="p-4 bg-[#0d1117] rounded-xl border border-[#21262d] space-y-2.5">
              <h4 className="font-bold text-amber-400 flex items-center space-x-1.5 text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>Cảnh Báo &amp; Điểm Cần Lưu Ý</span>
              </h4>
              <ul className="space-y-2 text-slate-300">
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
          <div className="p-4 bg-[#0d1117] rounded-xl border border-[#21262d]">
            <h4 className="font-bold text-white text-xs mb-3 flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Đề Xuất Tái Cân Bằng Tỷ Trọng (Strategic Rebalancing)</span>
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#21262d] text-slate-400">
                    <th className="py-2 px-3">Tài sản</th>
                    <th className="py-2 px-3">Tỷ trọng hiện tại</th>
                    <th className="py-2 px-3">Tỷ trọng đề xuất</th>
                    <th className="py-2 px-3">Hành động gợi ý</th>
                    <th className="py-2 px-3">Lý do chiến lược</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21262d] text-slate-300">
                  {analysis.rebalanceSuggestions.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#161b22]">
                      <td className="py-3 px-3 font-mono font-bold text-white">{item.symbol}</td>
                      <td className="py-3 px-3 font-mono">{item.currentAllocationPct}%</td>
                      <td className="py-3 px-3 font-mono text-emerald-400 font-semibold">
                        {item.targetAllocationPct}%
                      </td>
                      <td className="py-3 px-3">{getActionBadge(item.action)}</td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">{item.reasoning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Macro Insight */}
          {analysis.macroInsight && (
            <div className="p-4 bg-gradient-to-r from-blue-950/30 to-indigo-950/30 border border-blue-500/20 rounded-xl text-xs text-blue-200">
              <span className="font-bold block mb-1">Góc nhìn vĩ mô &amp; Dòng tiền:</span>
              <p className="leading-relaxed">{analysis.macroInsight}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="py-12 text-center text-slate-400 space-y-3">
          <Sparkles className="w-10 h-10 text-cyan-400 mx-auto animate-pulse" />
          <h3 className="text-base font-bold text-white">Chưa có phân tích danh mục nào</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Bấm nút &ldquo;Khởi chạy phân tích ngay&rdquo; để Gemini AI đọc toàn bộ số dư và giao dịch của bạn, sau đó đưa ra lời khuyên tối ưu hóa lợi nhuận và giảm thiểu rủi ro.
          </p>
        </div>
      )}
    </div>
  );
};
