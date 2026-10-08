import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerSupabaseMock, requireUserMock, eqMock, queryMock, upsertMock } = vi.hoisted(() => ({
  getServerSupabaseMock: vi.fn(),
  requireUserMock: vi.fn(),
  eqMock: vi.fn(),
  queryMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/auth/require-user')>(),
  requireUser: requireUserMock,
}));
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: getServerSupabaseMock }));

import { GET, PATCH } from '@/app/api/settings/route';

describe('settings route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: 'user-1', email: 'shun@example.com' });
    eqMock.mockReturnValue({ maybeSingle: async () => ({ data: { base_currency: 'USD' }, error: null }) });
    queryMock.mockReturnValue({ eq: eqMock });
    upsertMock.mockResolvedValue({ error: null });
    getServerSupabaseMock.mockResolvedValue({
      from: (table: string) => {
        expect(table).toBe('user_settings');
        return { select: queryMock, upsert: upsertMock };
      },
    });
  });

  it('reads the signed-in user currency preference', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ baseCurrency: 'USD' });
    expect(eqMock).toHaveBeenCalledWith('owner_id', 'user-1');
  });

  it('persists a supported currency only for the signed-in user', async () => {
    const request = new Request('http://localhost/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseCurrency: 'VND' }),
    });

    const response = await PATCH(request as never);

    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith({ owner_id: 'user-1', base_currency: 'VND' }, { onConflict: 'owner_id' });
  });

  it('rejects unsupported currency values without writing them', async () => {
    const request = new Request('http://localhost/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseCurrency: 'JPY' }),
    });

    const response = await PATCH(request as never);

    expect(response.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
