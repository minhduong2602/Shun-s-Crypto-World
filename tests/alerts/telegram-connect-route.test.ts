import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const { requireUserMock, getAdminSupabaseMock, getServerEnvMock, insertMock, deleteMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getAdminSupabaseMock: vi.fn(),
  getServerEnvMock: vi.fn(),
  insertMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/auth/require-user')>(), requireUser: requireUserMock }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminSupabase: getAdminSupabaseMock }));
vi.mock('@/lib/config/env', () => ({ getServerEnv: getServerEnvMock }));

import { POST } from '@/app/api/alerts/telegram/connect/route';

describe('POST /api/alerts/telegram/connect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: 'user-1' });
    getServerEnvMock.mockReturnValue({ TELEGRAM_BOT_TOKEN: 'bot-token', TELEGRAM_WEBHOOK_SECRET: 'webhook_secret', APP_URL: 'https://portfolio.example.com' });
    deleteMock.mockResolvedValue({ error: null });
    insertMock.mockResolvedValue({ error: null });
    getAdminSupabaseMock.mockReturnValue({ from: () => ({ delete: () => ({ eq: () => ({ is: deleteMock }) }), insert: insertMock }) });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string | URL | Request) => String(url).endsWith('/getMe')
      ? Response.json({ ok: true, result: { username: 'portfolio_alert_bot' } })
      : Response.json({ ok: true, result: true })));
  });

  it('returns a bot deep link and stores only a hashed, expiring one-time code', async () => {
    const response = await POST();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.botLink).toMatch(/^https:\/\/t\.me\/portfolio_alert_bot\?start=[a-f0-9]{48}$/);
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: 'user-1',
      token_hash: createHash('sha256').update(result.botLink.split('start=')[1]).digest('hex'),
      expires_at: expect.any(String),
    }));
    expect(fetch).toHaveBeenCalledWith('https://api.telegram.org/botbot-token/setWebhook', expect.objectContaining({
      body: expect.stringContaining('https://portfolio.example.com/api/telegram/webhook'),
    }));
  });

  it('does not issue a link when Telegram cannot identify the configured bot', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ ok: false, description: 'Unauthorized' }, { status: 401 }));

    const response = await POST();

    expect(response.status).toBe(502);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
