import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardHoldingsTable } from '@/components/dashboard/holdings-table';
import type { Holding } from '@/lib/types';

const holdings: Holding[] = [
  {
    id: 'btc', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', amount: 0.5, avgBuyPrice: 50000,
    totalInvested: 25000, currentPrice: 60000, currentValue: 30000, priceChange24h: 2,
    unrealizedPnL: 5000, unrealizedPnLPercentage: 20, allocationPercentage: 60, sparkline7d: [], updatedAt: '2026-10-09T00:00:00Z',
  },
  {
    id: 'eth', coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', amount: 2, avgBuyPrice: 2000,
    totalInvested: 4000, currentPrice: 2500, currentValue: 5000, priceChange24h: -1,
    unrealizedPnL: 1000, unrealizedPnLPercentage: 25, allocationPercentage: 10, sparkline7d: [], updatedAt: '2026-10-09T00:00:00Z',
  },
];

describe('DashboardHoldingsTable', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders holdings in a semantic table and filters by ticker', () => {
    render(<DashboardHoldingsTable holdings={holdings} baseCurrency="USD" />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm tài sản' }), { target: { value: 'eth' } });

    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
    expect(screen.queryByText('Bitcoin')).not.toBeInTheDocument();
  });

  it('does not round a small but priced token position down to zero', () => {
    const fractionalHolding: Holding = {
      ...holdings[0], id: 'fractional', coinId: 'small-token', symbol: 'SMOL', name: 'Small Token',
      amount: 1234, avgBuyPrice: 0.00000001, totalInvested: 0.00001234, currentPrice: 0.00000001,
      currentValue: 0.00001234, unrealizedPnL: 0, unrealizedPnLPercentage: 0,
    };
    render(<DashboardHoldingsTable holdings={[fractionalHolding]} baseCurrency="USD" />);

    expect(screen.getByText('$0.00001234')).toBeInTheDocument();
  });

  it('routes chart and add-transaction actions to the selected holding', () => {
    const onSelectCoin = vi.fn();
    const onAddTransaction = vi.fn();
    render(<DashboardHoldingsTable holdings={holdings} baseCurrency="USD" onSelectCoin={onSelectCoin} onAddTransaction={onAddTransaction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Xem biểu đồ ETH' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm giao dịch ETH' }));

    expect(onSelectCoin).toHaveBeenCalledWith('ethereum');
    expect(onAddTransaction).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'ETH' }));
  });

  it('uses the accessible shadcn dialog for editing a holding note', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true }));
    vi.stubGlobal('fetch', fetcher);
    render(<DashboardHoldingsTable holdings={holdings} baseCurrency="USD" />);

    fireEvent.click(screen.getByRole('button', { name: 'Sửa ghi chú ETH' }));

    expect(await screen.findByRole('dialog', { name: 'Ghi chú Ethereum (ETH)' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ghi chú cho Ethereum' })).toBeInTheDocument();
  });

  it('saves the selected holding note and refreshes the portfolio', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true }));
    const onRefresh = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<DashboardHoldingsTable holdings={holdings} baseCurrency="USD" onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sửa ghi chú ETH' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Ghi chú cho Ethereum' }), { target: { value: 'DCA mỗi tháng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/portfolio/holdings', expect.objectContaining({ method: 'PATCH' })));
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ symbol: 'ETH', notes: 'DCA mỗi tháng' });
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('explains that deleting a position deletes its full transaction history', () => {
    render(<DashboardHoldingsTable holdings={holdings} baseCurrency="USD" />);

    fireEvent.click(screen.getByRole('button', { name: 'Xóa lịch sử ETH' }));

    expect(screen.getByRole('dialog', { name: 'Xóa toàn bộ lịch sử ETH?' })).toBeInTheDocument();
    expect(screen.getByText(/xóa các giao dịch ETH khỏi danh mục và không thể hoàn tác/)).toBeInTheDocument();
  });
});
