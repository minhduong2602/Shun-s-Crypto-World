import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserMock, getServerSupabaseMock, getServerEnvMock, maybeSingleMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getServerSupabaseMock: vi.fn(),
  getServerEnvMock: vi.fn(),
  maybeSingleMock: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/auth/require-user')>(),
  requireUser: requireUserMock,
}));
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: getServerSupabaseMock }));
vi.mock('@/lib/config/env', () => ({ getServerEnv: getServerEnvMock }));

import { POST } from '@/app/api/alerts/test-telegram/route';

describe('POST /api/alerts/test-telegram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: 'user-1' });
    getServerEnvMock.mockReturnValue({ TELEGRAM_BOT_TOKEN: 'bot-token' });
    maybeSingleMock.mockResolvedValue({ data: { telegram_chat_id: '12345', telegram_alerts_enabled: true }, error: null });
    getServerSupabaseMock.mockResolvedValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) }) });
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sends a test only to the authenticated user’s linked Telegram chat', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ ok: true }));

    const response = await POST();

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith('https://api.telegram.org/botbot-token/sendMessage', expect.objectContaining({
      body: expect.stringContaining('"chat_id":"12345"'),
    }));
  });

  it('does not send when the user has not linked Telegram', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const response = await POST();

    expect(response.status).toBe(409);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports Telegram API rejection without changing the linked destination', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ ok: false, description: 'bot was blocked' }, { status: 403 }));

    const response = await POST();

    expect(response.status).toBe(502);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
