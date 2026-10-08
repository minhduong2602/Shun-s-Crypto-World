import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TelegramAlertsModal } from '@/components/TelegramAlertsModal';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TelegramAlertsModal', () => {
  it('shows recent Telegram delivery status and observed market values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      alerts: [{
        id: 'alert-1', coinId: 'btc', symbol: 'BTC', condition: 'ABOVE', targetValue: 65000,
        currentValueAtCreation: 0, isActive: true, isRecurring: true, createdAt: '2026-10-09T00:00:00.000Z',
      }],
      telegramConfig: { chatId: '12345', hasToken: true, enabled: true },
      deliveries: [{
        id: 'delivery-1', alertId: 'alert-1', observedPriceUsd: 67123.5,
        observedChange24h: 2.4, status: 'sent', createdAt: '2026-10-09T01:00:00.000Z',
        deliveredAt: '2026-10-09T01:00:02.000Z',
      }],
    })));

    render(<TelegramAlertsModal isOpen onClose={vi.fn()} baseCurrency="USD" />);

    expect(await screen.findByText('Lịch sử gửi gần đây')).toBeInTheDocument();
    expect(screen.getByText('Đã gửi')).toBeInTheDocument();
    expect(screen.getByText('$67,123.50')).toBeInTheDocument();
    const historyTable = screen.getByRole('table', { name: 'Lịch sử gửi cảnh báo Telegram' });
    expect(within(historyTable).getByText('BTC')).toBeInTheDocument();
  });

  it('does not present an empty alert list when loading alerts fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Không thể đọc dữ liệu cảnh báo' }, { status: 503 })));
    render(<TelegramAlertsModal isOpen onClose={vi.fn()} baseCurrency="USD" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể đọc dữ liệu cảnh báo');
    expect(screen.queryByText('Chưa có cảnh báo nào được đặt.')).not.toBeInTheDocument();
  });

  it('submits the selected percentage condition when creating an alert', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(Response.json({ success: true }, { status: 201 }));
      return Promise.resolve(Response.json({ alerts: [], telegramConfig: {}, deliveries: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<TelegramAlertsModal isOpen onClose={vi.fn()} baseCurrency="USD" />);

    fireEvent.change(await screen.findByLabelText('Ticker'), { target: { value: 'BTC' } });
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Tăng mạnh 24h (% ≥)' }), { button: 0 });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Tăng mạnh 24h (% ≥)' })).toHaveAttribute('data-state', 'active'));
    expect(screen.getByLabelText('Mục tiêu (%)')).toHaveValue(5);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm cảnh báo' }));

    await waitFor(() => {
      const createCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST');
      expect(createCall).toBeDefined();
      expect(JSON.parse(String(createCall?.[1]?.body)).condition).toBe('PCT_UP_24H');
    });
  });

  it('shows the server error when creating a price alert fails', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return Promise.resolve(Response.json({ error: 'Không hỗ trợ ticker này' }, { status: 400 }));
      }
      return Promise.resolve(Response.json({ alerts: [], telegramConfig: {}, deliveries: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<TelegramAlertsModal isOpen onClose={vi.fn()} baseCurrency="USD" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Thêm cảnh báo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Không hỗ trợ ticker này');
  });

  it('shows the server error when deleting a price alert fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
      if (options?.method === 'DELETE') {
        return Promise.resolve(Response.json({ error: 'Cảnh báo đang được xử lý' }, { status: 409 }));
      }
      return Promise.resolve(Response.json({
        alerts: [{
          id: 'alert-delete', coinId: 'btc', symbol: 'BTC', condition: 'ABOVE', targetValue: 65000,
          currentValueAtCreation: 0, isActive: true, isRecurring: true, createdAt: '2026-10-09T00:00:00.000Z',
        }],
        telegramConfig: {}, deliveries: [],
      }));
    }));
    render(<TelegramAlertsModal isOpen onClose={vi.fn()} baseCurrency="USD" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Xóa cảnh báo BTC' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cảnh báo đang được xử lý');
  });

  it('creates a contract-specific alert for a selected wallet asset', async () => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    const fetchMock = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(Response.json({ success: true }, { status: 201 }));
      return Promise.resolve(Response.json({
        alerts: [], telegramConfig: {}, deliveries: [],
        walletAssets: [{ id: 'asset-base-1', chain: 'BASE', symbol: 'TOK', name: 'Token', assetAddress: '0xtoken', isNative: false }],
      }));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<TelegramAlertsModal isOpen onClose={vi.fn()} baseCurrency="USD" />);

    fireEvent.click(await screen.findByRole('combobox', { name: 'Tài sản cần theo dõi' }));
    fireEvent.click(await screen.findByRole('option', { name: /TOK · Token · BASE/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm cảnh báo' }));

    await waitFor(() => {
      const createCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST');
      expect(JSON.parse(String(createCall?.[1]?.body))).toEqual(expect.objectContaining({
        walletAssetId: 'asset-base-1', symbol: 'TOK',
      }));
    });
  });
});
