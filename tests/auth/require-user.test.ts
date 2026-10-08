import { describe, expect, it } from 'vitest';
import { UnauthorizedError, getAuthenticatedUser } from '@/lib/auth/require-user';

describe('getAuthenticatedUser', () => {
  it('returns the authenticated user identity', async () => {
    await expect(getAuthenticatedUser({ auth: { getUser: async () => ({ data: { user: { id: 'user-1', email: 'shun@example.com' } }, error: null }) } } as never))
      .resolves.toEqual({ id: 'user-1', email: 'shun@example.com' });
  });

  it('rejects an absent authenticated user', async () => {
    await expect(getAuthenticatedUser({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never))
      .rejects.toBeInstanceOf(UnauthorizedError);
  });
});
