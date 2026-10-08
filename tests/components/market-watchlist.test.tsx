import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MarketTicker } from '@/lib/types';
import { MarketWatchlist } from '@/components/MarketWatchlist';

const ticker: MarketTicker = {
  id: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  rank: 1,
  priceUsd: 60_000,
  priceChange1h: null,
  priceChange24h: 1.5,
  priceChange7d: null,
  marketCapUsd: null,
  volume24hUsd: 1_000_000,
  circulatingSupply: null,
  sparkline7d: [],
  high24h: 61_000,
  low24h: 59_000,
};

describe('MarketWatchlist persistence status', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('explains a watchlist API failure and retries the persisted list', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        error: 'Bảng market_watchlist chưa sẵn sàng. Hãy áp dụng migration 202610090011.',
        code: 'WATCHLIST_SCHEMA_NOT_READY',
      }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ symbols: [] }));
    vi.stubGlobal('fetch', fetchMock);

    render(<MarketWatchlist
      tickers={[ticker]}
      baseCurrency="USD"
      onSelectCoinForChart={vi.fn()}
      onOpenAddTransaction={vi.fn()}
    />);

    expect(await screen.findByRole('alert')).toHaveTextContent('migration 202610090011');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
