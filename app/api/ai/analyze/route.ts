import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerSupabase } from '@/lib/supabase/server';
import { getLiveHoldings, summarizeHoldings } from '@/lib/portfolio/repository';
import type { AiRecommendation } from '@/lib/types';

export async function POST() {
  try {
    const user = await requireUser();
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Chưa cấu hình GEMINI_API_KEY trên môi trường triển khai.' }, { status: 503 });
    }

    const holdings = await getLiveHoldings(await getServerSupabase(), user.id);
    const summary = summarizeHoldings(holdings);
    if (!holdings.length) {
      return NextResponse.json({ error: 'Danh mục chưa có giao dịch để phân tích.' }, { status: 400 });
    }
    const portfolioContext = {
      totalValueUsd: summary.totalValueUsd,
      totalInvestedUsd: summary.totalInvestedUsd,
      totalProfitLossUsd: summary.totalProfitLossUsd,
      totalProfitLossPercentage: summary.totalProfitLossPercentage,
      isValuationComplete: summary.isValuationComplete,
      unpricedHoldingsCount: summary.unpricedHoldingsCount,
      holdings: holdings.map(({ symbol, name, allocationPercentage, currentValue, avgBuyPrice, currentPrice, unrealizedPnLPercentage, priceAvailable }) => ({
        symbol, name, allocationPercentage, currentValue, avgBuyPrice, currentPrice, unrealizedPnLPercentage, priceAvailable,
      })),
    };
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Phân tích danh mục crypto cá nhân sau. Đây không phải tư vấn đầu tư; nêu rõ bất định và không khẳng định dữ liệu vĩ mô không được cung cấp. Nếu isValuationComplete là false hoặc priceAvailable là false, tuyệt đối không xem giá trị 0 là giá thật, không tính PnL/tỷ trọng của vị thế đó và nêu rõ định giá chưa đầy đủ. Trả về JSON tiếng Việt theo schema: {"summary":string,"riskScore":number 1-100,"marketSentiment":"EXTREME_GREED|GREED|NEUTRAL|FEAR|EXTREME_FEAR","rebalanceSuggestions":[{"symbol":string,"action":"ACCUMULATE|TAKE_PROFIT|HOLD|REDUCE","targetAllocationPct":number,"currentAllocationPct":number,"reasoning":string}],"portfolioStrengths":string[],"riskWarnings":string[],"macroInsight":string}. Dữ liệu: ${JSON.stringify(portfolioContext)}`,
      config: { responseMimeType: 'application/json', temperature: 0.2 },
    });
    if (!response.text) throw new Error('Gemini không trả về nội dung phân tích.');
    const parsed = JSON.parse(response.text);
    const analysis: AiRecommendation = {
      id: crypto.randomUUID(),
      summary: String(parsed.summary ?? ''),
      riskScore: Math.max(1, Math.min(100, Number(parsed.riskScore) || 50)),
      marketSentiment: parsed.marketSentiment ?? 'NEUTRAL',
      rebalanceSuggestions: Array.isArray(parsed.rebalanceSuggestions) ? parsed.rebalanceSuggestions : [],
      portfolioStrengths: Array.isArray(parsed.portfolioStrengths) ? parsed.portfolioStrengths : [],
      riskWarnings: Array.isArray(parsed.riskWarnings) ? parsed.riskWarnings : [],
      macroInsight: String(parsed.macroInsight ?? ''),
      createdAt: new Date().toISOString(),
    };
    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('AI portfolio analysis failed:', error);
    return NextResponse.json({ error: 'Không thể phân tích danh mục lúc này.' }, { status: 502 });
  }
}
