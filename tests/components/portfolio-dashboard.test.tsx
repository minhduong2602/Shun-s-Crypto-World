import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortfolioDashboard } from '@/components/dashboard/portfolio-dashboard';

describe('PortfolioDashboard', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => Response.json({ snapshots: [] }))));
  it('renders a semantic holdings table and wallet empty state', () => {
    render(<PortfolioDashboard summary={{ totalValueUsd: 0, totalInvestedUsd: 0, totalProfitLossUsd: 0, realizedProfitLossUsd: 0, totalProfitLossPercentage: 0, change24hUsd: 0, change24hPercentage: 0, holdingsCount: 0 }} holdings={[]} wallets={[]} loading={false} />);
    expect(screen.getAllByRole('table').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Chưa có ví theo dõi')).toBeInTheDocument();
  });

  it('labels incomplete market valuation and avoids showing a zero price for an unpriced asset', () => {
    render(<PortfolioDashboard
      summary={{ totalValueUsd: 0, totalInvestedUsd: 50, totalProfitLossUsd: null, realizedProfitLossUsd: 0, totalProfitLossPercentage: null, change24hUsd: null, change24hPercentage: null, holdingsCount: 1, unpricedHoldingsCount: 1, isValuationComplete: false }}
      holdings={[{ id: 'h-unknown', coinId: 'unknown', symbol: 'UNKNOWN', name: 'Unknown Token', amount: 1, avgBuyPrice: 50, totalInvested: 50, currentPrice: null, currentValue: null, priceChange24h: null, unrealizedPnL: null, unrealizedPnLPercentage: null, allocationPercentage: 0, sparkline7d: [], updatedAt: '2026-10-09T00:00:00.000Z', priceAvailable: false }]}
      wallets={[]}
      loading={false}
    />);

    expect(screen.getByText(/Chưa định giá được 1 tài sản/)).toBeInTheDocument();
    expect(screen.getAllByText('Chưa định giá').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('renders portfolio and wallet values in the selected VND base currency', () => {
    render(<PortfolioDashboard
      summary={{ totalValueUsd: 2, totalInvestedUsd: 1, totalProfitLossUsd: 1, realizedProfitLossUsd: 0, totalProfitLossPercentage: 100, change24hUsd: 0, change24hPercentage: 0, holdingsCount: 0 }}
      holdings={[]}
      wallets={[{ id: 'wallet-1', chain: 'ETH', address: '0x123', label: 'Cold wallet', isActive: true, balanceUsd: 2, nativeBalance: 0, nativeSymbol: 'ETH', tokensCount: 0, createdAt: '2026-10-01T00:00:00.000Z' }]}
      baseCurrency="VND"
      usdVndRate={26_000}
      loading={false}
    />);

    expect(screen.getAllByText(/52\.000\s*₫/u).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('$2.00')).not.toBeInTheDocument();
  });

  it('shows an aggregate wallet value and flags tokens whose prices are unavailable', () => {
    render(<PortfolioDashboard
      summary={{ totalValueUsd: 20, totalInvestedUsd: 10, totalProfitLossUsd: 10, realizedProfitLossUsd: 0, totalProfitLossPercentage: 100, change24hUsd: 0, change24hPercentage: 0, holdingsCount: 1 }}
      holdings={[]}
      wallets={[
        { id: 'wallet-1', chain: 'ETH', address: '0x123', label: 'Cold wallet', isActive: true, balanceUsd: 2, nativeBalance: 0, nativeSymbol: 'ETH', tokensCount: 2, unpricedAssetsCount: 1, createdAt: '2026-10-01T00:00:00.000Z' },
        { id: 'wallet-2', chain: 'SOL', address: 'sol123', label: 'Solana wallet', isActive: true, balanceUsd: 3, nativeBalance: 0, nativeSymbol: 'SOL', tokensCount: 1, createdAt: '2026-10-01T00:00:00.000Z' },
      ]}
      loading={false}
    />);

    expect(screen.getByText('Giá trị đã định giá trong ví theo dõi')).toBeInTheDocument();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
    expect(screen.getByText('2 ví · 3 token · 1 chưa định giá')).toBeInTheDocument();
    expect(screen.getByText('Giá trị sổ giao dịch')).toBeInTheDocument();
  });

  it('distinguishes unrealized and realized profit or loss when valuation is complete', () => {
    render(<PortfolioDashboard
      summary={{ totalValueUsd: 150, totalInvestedUsd: 100, totalProfitLossUsd: 50, realizedProfitLossUsd: 17, totalProfitLossPercentage: 50, change24hUsd: 5, change24hPercentage: 3.33, holdingsCount: 1, isValuationComplete: true }}
      holdings={[]}
      wallets={[]}
      loading={false}
    />);

    expect(screen.getByText('Vốn vị thế đang mở')).toBeInTheDocument();
    expect(screen.getByText('Lãi/lỗ chưa thực hiện')).toBeInTheDocument();
    expect(screen.getByText('Lãi/lỗ đã chốt')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('+$50.00')).toBeInTheDocument();
    expect(screen.getByText('+$17.00')).toBeInTheDocument();
    expect(screen.getByText('+50.00% trên giá vốn vị thế đang mở')).toBeInTheDocument();
  });
});
