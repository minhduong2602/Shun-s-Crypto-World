import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddTransactionModal } from '@/components/AddTransactionModal';

describe('AddTransactionModal', () => {
  it('saves the user-selected historical execution time', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(Response.json({ success: true }, { status: 201 }));
      return Promise.resolve(Response.json({ results: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AddTransactionModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Ngày và giờ giao dịch'), { target: { value: '2025-03-01T12:30' } });
    fireEvent.change(screen.getByPlaceholderText('VD: 1.5'), { target: { value: '2' } });
    fireEvent.change(screen.getByPlaceholderText('Giá theo đơn khớp lệnh'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm BTC vào danh mục' }));

    await waitFor(() => {
      const createCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST');
      expect(createCall).toBeDefined();
      expect(JSON.parse(String(createCall?.[1]?.body)).executedAt).toBe(new Date('2025-03-01T12:30').toISOString());
    });
  });

  it('selects a ticker suggestion with arrow keys and Enter', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes('q=DOGE')) {
        return Promise.resolve(Response.json({ results: [{ symbol: 'DOGE', name: 'Dogecoin', priceUsd: 0.12, change24h: 1.5 }] }));
      }
      return Promise.resolve(Response.json({ results: [] }));
    }));

    render(<AddTransactionModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    const search = await screen.findByRole('combobox', { name: 'Tìm hoặc nhập ticker' });
    fireEvent.change(search, { target: { value: 'DOGE' } });

    const suggestion = await screen.findByRole('option', { name: /DOGE Dogecoin/ });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(suggestion).toBeInTheDocument();
    fireEvent.keyDown(search, { key: 'Enter' });

    await waitFor(() => expect(screen.getByText('(Dogecoin)')).toBeInTheDocument());
    expect(screen.queryByRole('listbox', { name: 'Ticker suggestions' })).not.toBeInTheDocument();
  });
});
