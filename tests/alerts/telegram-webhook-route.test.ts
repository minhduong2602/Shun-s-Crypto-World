import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAdminSupabaseMock, getServerEnvMock, rpcMock } = vi.hoisted(() => ({
  getAdminSupabaseMock: vi.fn(),
  getServerEnvMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({ getAdminSupabase: getAdminSupabaseMock }));
vi.mock('@/lib/config/env', () => ({ getServerEnv: getServerEnvMock }));

import { POST } from '@/app/api/telegram/webhook/route';

function request(update: unknown, secret = 'webhook-secret') {
  return new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
    body: JSON.stringify(update),
  }) as never;
}

describe('POST /api/telegram/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnvMock.mockReturnValue({ TELEGRAM_BOT_TOKEN: 'bot-token', TELEGRAM_WEBHOOK_SECRET: 'webhook-secret' });
    rpcMock.mockResolvedValue({ data: true, error: null });
    getAdminSupabaseMock.mockReturnValue({ rpc: rpcMock });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true })));
  });

  it('consumes the private-chat pairing code once and confirms the connection', async () => {
    const response = await POST(request({ message: {
      text: '/start aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chat: { id: 12345, type: 'private' },
    } }));

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('complete_telegram_link', expect.objectContaining({
      p_chat_id: '12345',
      p_token_hash: expect.any(String),
    }));
    expect(fetch).toHaveBeenCalledWith('https://api.telegram.org/botbot-token/sendMessage', expect.objectContaining({ method: 'POST' }));
  });

  it('rejects a webhook with the wrong secret before processing the update', async () => {
    const response = await POST(request({ message: { text: '/start code', chat: { id: 123, type: 'private' } } }, 'wrong'));

    expect(response.status).toBe(401);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('ignores pairing commands from group chats', async () => {
    const response = await POST(request({ message: { text: '/start code', chat: { id: -1001, type: 'group' } } }));

    expect(response.status).toBe(200);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
