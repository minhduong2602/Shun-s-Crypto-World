import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransactionHistory } from '@/components/TransactionHistory';
import type { Transaction } from '@/lib/types';

describe('TransactionHistory', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('shows both deposits and withdrawals when the transfer filter is selected', () => {
    const transactions: Transaction[] = [
      {
        id: 'deposit-1', coinId: 'btc', symbol: 'BTC', name: 'Bitcoin', type: 'TRANSFER_IN',
        amount: 1, pricePerCoin: 100, totalAmount: 100, fee: 0,
        executedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', notes: 'deposit note',
      },
      {
        id: 'withdrawal-1', coinId: 'btc', symbol: 'BTC', name: 'Bitcoin', type: 'TRANSFER_OUT',
        amount: 0.5, pricePerCoin: 100, totalAmount: 50, fee: 0,
        executedAt: '2026-01-02T00:00:00.000Z', createdAt: '2026-01-02T00:00:00.000Z', notes: 'withdrawal note',
      },
      {
        id: 'buy-1', coinId: 'eth', symbol: 'ETH', name: 'Ethereum', type: 'BUY',
        amount: 2, pricePerCoin: 50, totalAmount: 100, fee: 0,
        executedAt: '2026-01-03T00:00:00.000Z', createdAt: '2026-01-03T00:00:00.000Z', notes: 'buy note',
      },
    ];

    render(<TransactionHistory transactions={transactions} baseCurrency="USD" onRefresh={vi.fn()} />);
    const transferTab = screen.getByRole('tab', { name: 'Nạp/Rút' });
    fireEvent.mouseDown(transferTab, { button: 0 });

    expect(transferTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('deposit note')).toBeInTheDocument();
    expect(screen.getByText('withdrawal note')).toBeInTheDocument();
    expect(screen.queryByText('buy note')).not.toBeInTheDocument();
  });

  it('opens a shadcn dialog for importing a transaction backup', () => {
    render(<TransactionHistory transactions={[]} baseCurrency="USD" onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Nhập CSV' }));

    expect(screen.getByRole('dialog', { name: 'Nhập giao dịch từ CSV' })).toBeInTheDocument();
    expect(screen.getByLabelText('File CSV giao dịch')).toHaveAttribute('accept', '.csv,text/csv');
  });

  it('previews a selected file and only refreshes after the user confirms import', async () => {
    const onRefresh = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        rows: [{ line: 2, symbol: 'ETH', name: 'Ethereum', type: 'BUY', amount: 0.5, pricePerCoin: 2000, fee: 2, totalAmount: 1002, executedAt: '2026-01-02T03:04:05.000Z' }],
        errors: [], duplicates: [], duplicateCount: 0, warnings: [], balanceError: null, canImport: true,
      }))
      .mockResolvedValueOnce(Response.json({ success: true, importedCount: 1, duplicateCount: 0, warnings: [] }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<TransactionHistory transactions={[]} baseCurrency="USD" onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole('button', { name: 'Nhập CSV' }));
    const file = new File(['csv'], 'backup.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: async () => 'backup-csv-content' });
    fireEvent.change(screen.getByLabelText('File CSV giao dịch'), { target: { files: [file] } });

    expect(await screen.findByText('Ethereum')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/portfolio/transactions/import', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ csv: 'backup-csv-content', mode: 'preview' }),
    }));
    expect(onRefresh).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Nhập 1 giao dịch' }));

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenLastCalledWith('/api/portfolio/transactions/import', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ csv: 'backup-csv-content', mode: 'import' }),
    }));
  });
});
