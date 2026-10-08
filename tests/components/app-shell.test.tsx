import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/app-shell';

describe('AppShell', () => {
  it('renders the portfolio navigation and mobile navigation trigger', () => {
    render(
      <AppShell activeTab="portfolio" onTabChange={() => {}} title="Danh mục">
        <p>Nội dung</p>
      </AppShell>
    );

    expect(screen.getAllByRole('button', { name: 'Danh mục' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Thị trường' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Biểu đồ' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Ví' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Mở điều hướng' })).toBeInTheDocument();
  });

  it('exposes a base currency switch and reports changes', () => {
    const onCurrencyChange = vi.fn();
    function Harness() {
      const [currency, setCurrency] = React.useState<'USD' | 'VND'>('USD');
      return <AppShell activeTab="portfolio" onTabChange={() => {}} title="Danh mục" baseCurrency={currency} onBaseCurrencyChange={(nextCurrency) => { onCurrencyChange(nextCurrency); setCurrency(nextCurrency); }}><p>Nội dung</p></AppShell>;
    }
    render(
      <Harness />
    );

    const vndTab = screen.getByRole('tab', { name: 'VND' });
    fireEvent.mouseDown(vndTab, { button: 0 });

    expect(onCurrencyChange).toHaveBeenCalledWith('VND');
    expect(vndTab).toHaveAttribute('aria-selected', 'true');
  });

  it('shows linked CoinGecko attribution in the shared application shell', () => {
    render(<AppShell activeTab="portfolio" onTabChange={() => {}} title="Danh mục" baseCurrency="VND">
      <p>Nội dung</p>
    </AppShell>);

    expect(screen.getByRole('link', { name: 'Data provided by CoinGecko' }))
      .toHaveAttribute('href', 'https://www.coingecko.com/en/api');
  });

  it('keeps compact mobile header actions accessible by name', () => {
    render(<AppShell
      activeTab="portfolio"
      onTabChange={() => {}}
      title="Danh mục"
      baseCurrency="USD"
      onBaseCurrencyChange={() => {}}
      onOpenAlerts={() => {}}
      onAddTransaction={() => {}}
      onRefresh={() => {}}
      onLogout={() => {}}
    >Nội dung</AppShell>);

    expect(screen.getByRole('button', { name: 'Cảnh báo Telegram' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giao dịch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đồng bộ dữ liệu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
  });
});
