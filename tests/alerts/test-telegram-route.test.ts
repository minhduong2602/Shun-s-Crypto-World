import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserMock, getServerSupabaseMock, getServerEnvMock, upsertMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getServerSupabaseMock: vi.fn(),
  getServerEnvMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/auth/require-user')>(),
  requireUser: requireUserMock,
}));
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: getServerSupabaseMock }));
vi.mock('@/lib/config/env', () => ({ getServerEnv: getServerEnvMock }));

import { POST } from '@/app/api/alerts/test-telegram/route';

function request(body: { chatId: string; saveOnly?: boolean }) {
  return new Request('http://localhost/api/alerts/test-telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

describe('POST /api/alerts/test-telegram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: 'user-1' });
    getServerEnvMock.mockReturnValue({ TELEGRAM_BOT_TOKEN: 'bot-token' });
    upsertMock.mockResolvedValue({ error: null });
    getServerSupabaseMock.mockResolvedValue({ from: () => ({ upsert: upsertMock }) });
    vi.stubGlobal('fetch', vi.fn());
  });

  it('does not overwrite an existing destination when Telegram rejects the test message', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(
      { ok: false, description: 'bot was blocked' },
      { status: 403 },
    ));

    const response = await POST(request({ chatId: 'invalid-chat' }));

    expect(response.status).toBe(502);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('stores and enables the destination only after Telegram accepts the test message', async () => {
    const operations: string[] = [];
    vi.mocked(fetch).mockImplementation(async () => {
      operations.push('telegram');
      return Response.json({ ok: true });
    });
    upsertMock.mockImplementation(async () => {
      operations.push('save');
      return { error: null };
    });

    const response = await POST(request({ chatId: '-1001234567890' }));

    expect(response.status).toBe(200);
    expect(operations).toEqual(['telegram', 'save']);
    expect(upsertMock).toHaveBeenCalledWith({
      owner_id: 'user-1',
      telegram_chat_id: '-1001234567890',
      telegram_alerts_enabled: true,
    }, { onConflict: 'owner_id' });
  });

  it('saves without sending when the user explicitly chooses save-only', async () => {
    const response = await POST(request({ chatId: '12345', saveOnly: true }));

    expect(response.status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: 'user-1',
      telegram_chat_id: '12345',
      telegram_alerts_enabled: true,
    }), { onConflict: 'owner_id' });
  });
});
