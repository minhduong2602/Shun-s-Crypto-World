import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('lightweight-charts', () => {
  const series = { setData: vi.fn(), update: vi.fn(), priceScale: () => ({ applyOptions: vi.fn() }) };
  const chart = {
    addSeries: vi.fn(() => series),
    subscribeCrosshairMove: vi.fn(),
    timeScale: () => ({ fitContent: vi.fn() }),
    remove: vi.fn(),
  };
  return {
    createChart: vi.fn(() => chart),
    CandlestickSeries: {}, HistogramSeries: {}, LineSeries: {},
    ColorType: { Solid: 'solid' }, CrosshairMode: { Normal: 'normal' },
  };
});

import { TechnicalChart } from '@/components/TechnicalChart';

describe('TechnicalChart live quote state', () => {
  beforeEach(() => {
    class MockWebSocket {
      onopen: (() => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: (() => void) | null = null;
      close() {}
      constructor(_url: string) {}
    }
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  it('does not keep the previous coin price and stats when the newly selected market is unavailable', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        isLive: true, currentPrice: 100, priceChange24h: 2,
        high24h: 110, low24h: 90, volume24h: 500,
        dataSource: 'Exchange OHLCV',
        data: [{ time: 1, open: 99, high: 101, low: 98, close: 100, volume: 10 }],
      }))
      .mockResolvedValueOnce(Response.json({
        isLive: false, currentPrice: null, priceChange24h: null,
        high24h: null, low24h: null, volume24h: null,
        error: 'Không có dữ liệu ETH/USDT',
      }, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const props = { selectedCoinId: 'BTC', onSelectCoin: vi.fn(), baseCurrency: 'USD' };
    const view = render(<TechnicalChart {...props} />);
    expect(await screen.findByText('$100.00')).toBeInTheDocument();

    view.rerender(<TechnicalChart {...props} selectedCoinId="ETH" />);

    await waitFor(() => expect(screen.getByText('Không có dữ liệu ETH/USDT')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Dữ liệu biểu đồ tạm thời không khả dụng');
    expect(screen.queryByText('$100.00')).not.toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByLabelText('Biến động 24h')).toHaveTextContent('—');
  });
});
