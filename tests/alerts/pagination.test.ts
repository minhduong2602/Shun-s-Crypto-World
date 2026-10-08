import { describe, expect, it } from 'vitest';
import { loadAllPages } from '@/supabase/functions/_shared/pagination';

describe('loadAllPages', () => {
  it('continues through every page instead of silently stopping at the API row cap', async () => {
    const rows = Array.from({ length: 1_201 }, (_, index) => ({ id: String(index + 1).padStart(4, '0') }));
    const cursors: Array<string | null> = [];

    const result = await loadAllPages(async (afterId, pageSize) => {
      cursors.push(afterId);
      const remaining = rows.filter((row) => afterId === null || row.id > afterId);
      return { data: remaining.slice(0, pageSize), error: null };
    }, 500);

    expect(result).toHaveLength(1_201);
    expect(result[0].id).toBe('0001');
    expect(result.at(-1)?.id).toBe('1201');
    expect(cursors).toEqual([null, '0500', '1000']);
  });

  it('fails instead of returning a partial result when a page fails', async () => {
    await expect(loadAllPages(async () => ({ data: null, error: new Error('query failed') })))
      .rejects.toThrow('query failed');
  });
});
