import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { replaceMock, routerMock } = vi.hoisted(() => {
  const replaceMock = vi.fn();
  return { replaceMock, routerMock: { replace: replaceMock } };
});

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));
vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/dashboard/portfolio-dashboard', () => ({
  PortfolioDashboard: ({ holdings }: { holdings: unknown[] }) => <div>Dashboard holdings: {holdings.length}</div>,
}));
vi.mock('@/components/TechnicalChart', () => ({ TechnicalChart: () => null }));
vi.mock('@/components/MarketWatchlist', () => ({ MarketWatchlist: () => null }));
vi.mock('@/components/ViewOnlyWallets', () => ({ ViewOnlyWallets: () => null }));
vi.mock('@/components/AiPortfolioDoctor', () => ({ AiPortfolioDoctor: () => null }));
vi.mock('@/components/AddTransactionModal', () => ({ AddTransactionModal: () => null }));
vi.mock('@/components/TelegramAlertsModal', () => ({ TelegramAlertsModal: () => null }));

import Home from '@/app/page';

describe('Home dashboard data loading', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('redirects an expired Supabase session to login instead of presenting an empty portfolio', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/auth/status') return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (path === '/api/settings') return Response.json({ baseCurrency: 'USD' });
      return Response.json({});
    }));

    render(<Home />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
  });

  it('shows the server error and retry action when a portfolio data endpoint fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let summaryRequests = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/settings') return Response.json({ baseCurrency: 'USD' });
      if (path === '/api/auth/status') return Response.json({ isAuthenticated: true });
      if (path === '/api/portfolio/summary') {
        summaryRequests += 1;
        return summaryRequests === 1
          ? Response.json({ error: 'Supabase timeout' }, { status: 503 })
          : Response.json({ summary: {}, holdings: [], transactions: [] });
      }
      if (path === '/api/wallets') return Response.json({ wallets: [] });
      return Response.json({ tickers: [], globalMetrics: null });
    }));

    render(<Home />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Supabase timeout');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Dashboard holdings: 0')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(summaryRequests).toBe(2);
  });
});
