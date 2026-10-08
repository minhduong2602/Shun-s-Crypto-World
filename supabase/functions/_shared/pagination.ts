type PageResult<T> = { data: T[] | null; error: unknown | null };

export async function loadAllPages<T extends { id: string }>(
  loadPage: (afterId: string | null, pageSize: number) => Promise<PageResult<T>>,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Page size must be a positive integer');

  const rows: T[] = [];
  let afterId: string | null = null;
  while (true) {
    const { data, error } = await loadPage(afterId, pageSize);
    if (error) throw error;

    const page = data ?? [];
    if (page.length === 0) break;
    const nextAfterId = page[page.length - 1].id;
    if (afterId !== null && nextAfterId <= afterId) throw new Error('Pagination cursor did not advance');
    rows.push(...page);
    if (page.length < pageSize) break;
    afterId = nextAfterId;
  }
  return rows;
}
