import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';

export class UnauthorizedError extends Error {
  constructor() {
    super('Authentication is required');
    this.name = 'UnauthorizedError';
  }
}

export async function getAuthenticatedUser(client: Pick<SupabaseClient, 'auth'>) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new UnauthorizedError();
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function requireUser() {
  return getAuthenticatedUser(await getServerSupabase());
}
