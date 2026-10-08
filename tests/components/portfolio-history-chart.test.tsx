import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PortfolioHistoryChart } from '@/components/dashboard/portfolio-history-chart';

afterEach(() => vi.unstubAllGlobals());

describe('PortfolioHistoryChart', () => {
  it('renders the history chart and reloads the requested range when a tab changes', async () => {
    const fetchMock = vi.fn(async () => Response.json({ snapshots: [
      { date: '2026-10-08', totalValueUsd: 100, change24hUsd: 0 },
      { date: '2026-10-09', totalValueUsd: 120, change24hUsd: 20 },
    ] }));
    vi.stubGlobal('fetch', fetchMock);

    render(<PortfolioHistoryChart baseCurrency="USD" />);

    expect(await screen.findByRole('img', { name: /lịch sử giá trị danh mục/i })).toBeInTheDocument();
    expect(screen.getByText('$120.00')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: '7 ngày' }), { button: 0 });
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/portfolio/history?range=7d'));
  });

  it('explains when there are no recorded snapshots yet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ snapshots: [] })));

    render(<PortfolioHistoryChart baseCurrency="USD" />);

    expect(await screen.findByText(/chưa có dữ liệu lịch sử/i)).toBeInTheDocument();
  });
});
