import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PortfolioDashboard } from '@/components/dashboard/portfolio-dashboard';

describe('PortfolioDashboard', () => {
  it('renders a semantic holdings table and wallet empty state', () => {
    render(<PortfolioDashboard summary={{ totalValueUsd: 0, totalInvestedUsd: 0, totalProfitLossUsd: 0, totalProfitLossPercentage: 0, change24hUsd: 0, change24hPercentage: 0, holdingsCount: 0 }} holdings={[]} wallets={[]} loading={false} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Chưa có ví theo dõi')).toBeInTheDocument();
  });
});
