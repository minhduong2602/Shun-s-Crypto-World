import { describe, expect, it } from 'vitest';
import { listTransactions } from '@/lib/portfolio/repository';
import type { SupabaseClient } from '@supabase/supabase-js';

function transactionRow(id: string, index: number) {
  const timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();
  return {
    id,
    symbol: 'BTC',
    name: 'Bitcoin',
    type: 'BUY',
    amount: 1,
    price_per_coin: 100,
    total_amount: 100,
    fee: 0,
    wallet_id: null,
    tx_hash: null,
    executed_at: timestamp,
    notes: null,
    created_at: timestamp,
  };
}

function paginatedClient(rows: ReturnType<typeof transactionRow>[]) {
  const ranges: Array<[number, number]> = [];
  let currentRange: [number, number] = [0, 999];
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    range: (from: number, to: number) => {
      currentRange = [from, to];
      ranges.push(currentRange);
      return query;
    },
    then: (resolve: (value: { data: ReturnType<typeof transactionRow>[]; error: null }) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: rows.slice(currentRange[0], currentRange[1] + 1), error: null }).then(resolve, reject),
  };
  const client = { from: () => query } as unknown as SupabaseClient;
  return { client, ranges };
}

describe('transaction history pagination', () => {
  it('loads every transaction beyond the PostgREST per-request row limit', async () => {
    const rows = Array.from({ length: 1_201 }, (_, index) => transactionRow(`tx-${index}`, index));
    const { client, ranges } = paginatedClient(rows);

    const transactions = await listTransactions(client, 'owner-1');

    expect(transactions).toHaveLength(1_201);
    expect(transactions[0].id).toBe('tx-0');
    expect(transactions.at(-1)?.id).toBe('tx-1200');
    expect(ranges).toEqual([[0, 499], [500, 999], [1_000, 1_499]]);
  });
});
