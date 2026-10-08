import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ViewOnlyWallets } from '@/components/ViewOnlyWallets';
import type { Wallet } from '@/lib/types';

describe('ViewOnlyWallets', () => {
  const wallet: Wallet = {
      id: 'wallet-1',
      chain: 'ETH',
      address: '0x1234567890123456789012345678901234567890',
      label: 'Cold wallet',
      isActive: true,
      balanceUsd: 0,
      nativeBalance: 0,
      nativeSymbol: 'ETH',
      tokensCount: 0,
      tokens: [],
      createdAt: '2026-10-01T00:00:00.000Z',
  };

  function renderWallet() {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ wallet }))));
    render(<ViewOnlyWallets wallets={[wallet]} baseCurrency="USD" onRefresh={vi.fn()} />);
  }

  it('opens wallet details in an accessible shadcn dialog', async () => {
    renderWallet();
    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết ví Cold wallet' }));

    expect(await screen.findByRole('dialog', { name: /Cold wallet/ })).toBeInTheDocument();
  });

  it('labels the token table by the wallet whose assets are displayed', async () => {
    renderWallet();
    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết ví Cold wallet' }));

    expect(await screen.findByRole('table', { name: 'Danh sách token của ví Cold wallet' })).toBeInTheDocument();
  });

  it('warns that Solana token metadata is unverified and keeps the mint address visible', async () => {
    const solanaWallet: Wallet = {
      ...wallet,
      chain: 'SOL',
      nativeSymbol: 'SOL',
      tokensCount: 1,
      tokens: [{
        id: 'SOL:mint-address', symbol: 'BONK', name: 'Bonk Token', balance: 42, balanceUsd: 1,
        priceUsd: 0.0238, priceAvailable: true, isNative: false, decimals: 6, chain: 'SOL', contractAddress: 'mint-address',
      }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ wallet: solanaWallet }))));
    render(<ViewOnlyWallets wallets={[solanaWallet]} baseCurrency="USD" onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết ví Cold wallet' }));

    expect(await screen.findByText('Metadata on-chain · chưa xác minh')).toBeInTheDocument();
    expect(screen.getByTitle('Xem trên Explorer')).toBeInTheDocument();
    expect(screen.getByTitle('Sao chép hợp đồng: mint-address')).toBeInTheDocument();
  });

  it('exposes token filters as an accessible tab list', async () => {
    renderWallet();
    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết ví Cold wallet' }));

    expect(await screen.findByRole('tablist', { name: 'Lọc token' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tất cả/ })).toBeInTheDocument();
  });

  it('opens the edit-label form in an accessible shadcn dialog', async () => {
    renderWallet();
    fireEvent.click(screen.getAllByTitle('Đổi tên nhãn ví')[0]);

    expect(await screen.findByRole('dialog', { name: 'Đổi tên nhãn ví theo dõi' })).toBeInTheDocument();
  });

  it('opens delete confirmation in an accessible shadcn dialog', async () => {
    renderWallet();
    fireEvent.click(screen.getAllByTitle('Xóa ví khỏi danh sách theo dõi')[0]);

    expect(await screen.findByRole('dialog', { name: 'Xác nhận xóa ví theo dõi' })).toBeInTheDocument();
  });

  it('opens a keyboard-accessible network list when adding a tracked wallet', async () => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    renderWallet();
    fireEvent.click(screen.getByRole('button', { name: /Theo dõi địa chỉ mới/ }));
    fireEvent.click(await screen.findByRole('combobox', { name: 'Mạng Blockchain' }));

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Base (ETH)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Solana (SOL / SPL)' }));
    expect(screen.getByLabelText('Địa chỉ Ví công khai (Public Address)')).toHaveAttribute('placeholder', 'Địa chỉ Solana Base58...');
  });
});
