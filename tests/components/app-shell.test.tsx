import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/app-shell';

describe('AppShell', () => {
  it('renders desktop and mobile navigation with user profile and settings trigger without hamburger', () => {
    render(
      <AppShell activeTab="portfolio" onTabChange={() => {}} title="Danh mục">
        <p>Nội dung</p>
      </AppShell>
    );

    expect(screen.getAllByRole('button', { name: 'Danh mục' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Thị trường' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Biểu đồ' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Ví' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Cài đặt' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Hồ sơ/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Mở điều hướng' })).not.toBeInTheDocument();
  });

  it('exposes a base currency switch inside settings modal and reports changes', () => {
    const onCurrencyChange = vi.fn();
    function Harness() {
      const [currency, setCurrency] = React.useState<'USD' | 'VND'>('USD');
      return (
        <AppShell
          activeTab="portfolio"
          onTabChange={() => {}}
          title="Danh mục"
          baseCurrency={currency}
          onBaseCurrencyChange={(nextCurrency) => {
            onCurrencyChange(nextCurrency);
            setCurrency(nextCurrency);
          }}
        >
          <p>Nội dung</p>
        </AppShell>
      );
    }
    render(<Harness />);

    // Open settings modal via cog button
    fireEvent.click(screen.getAllByRole('button', { name: 'Cài đặt' })[0]);

    const vndTab = screen.getByRole('tab', { name: 'VND' });
    fireEvent.mouseDown(vndTab, { button: 0 });

    expect(onCurrencyChange).toHaveBeenCalledWith('VND');
    expect(vndTab).toHaveAttribute('aria-selected', 'true');
  });

  it('shows linked CoinGecko attribution in the shared application shell', () => {
    render(
      <AppShell activeTab="portfolio" onTabChange={() => {}} title="Danh mục" baseCurrency="VND">
        <p>Nội dung</p>
      </AppShell>
    );

    expect(screen.getByRole('link', { name: 'Data provided by CoinGecko' }))
      .toHaveAttribute('href', 'https://www.coingecko.com/en/api');
  });

  it('renders floating add transaction button and keeps settings actions accessible inside settings modal', () => {
    render(
      <AppShell
        activeTab="portfolio"
        onTabChange={() => {}}
        title="Danh mục"
        baseCurrency="USD"
        onBaseCurrencyChange={() => {}}
        onOpenAlerts={() => {}}
        onAddTransaction={() => {}}
        onRefresh={() => {}}
        onLogout={() => {}}
      >
        Nội dung
      </AppShell>
    );

    // Floating add transaction button is present
    expect(screen.getByRole('button', { name: 'Giao dịch' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Cài đặt' }).length).toBeGreaterThan(0);

    // Open settings modal
    fireEvent.click(screen.getAllByRole('button', { name: 'Cài đặt' })[0]);

    expect(screen.getByRole('button', { name: 'Cảnh báo Telegram' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đồng bộ dữ liệu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
  });
});
