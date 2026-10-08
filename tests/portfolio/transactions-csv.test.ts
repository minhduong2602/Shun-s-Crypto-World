import { describe, expect, it } from 'vitest';
import { buildTransactionsCsv, parseTransactionsCsv, planTransactionsCsvImport } from '@/lib/portfolio/transactions-csv';
import type { Transaction } from '@/lib/types';

describe('buildTransactionsCsv', () => {
  it('exports the complete transaction ledger with escaped text and spreadsheet-safe notes', () => {
    const transactions: Transaction[] = [{
      id: 'tx-1', coinId: 'btc', symbol: 'BTC', name: 'Bitcoin, Spot', type: 'BUY',
      amount: 0.5, pricePerCoin: 60_000, totalAmount: 30_010, fee: 10,
      walletId: 'wallet-1', txHash: '0xabc', executedAt: '2026-01-02T03:04:05.000Z',
      notes: '=HYPERLINK("https://evil.example","open"), DCA', createdAt: '2026-01-02T03:04:05.000Z',
    }];

    const csv = buildTransactionsCsv(transactions);

    expect(csv).toBe('\uFEFFExecuted At,Type,Symbol,Name,Amount,Unit Price USD,Fee USD,Total USD,Wallet ID,Transaction Hash,Notes\r\n"2026-01-02T03:04:05.000Z","BUY","BTC","Bitcoin, Spot","0.5","60000","10","30010","wallet-1","0xabc","\'=HYPERLINK(""https://evil.example"",""open""), DCA"');
  });

  it('returns a header-only file for an empty ledger', () => {
    expect(buildTransactionsCsv([])).toBe('\uFEFFExecuted At,Type,Symbol,Name,Amount,Unit Price USD,Fee USD,Total USD,Wallet ID,Transaction Hash,Notes');
  });

  it('parses the exported transaction schema, including quoted commas, quotes, and line breaks', () => {
    const csv = '\uFEFFExecuted At,Type,Symbol,Name,Amount,Unit Price USD,Fee USD,Total USD,Wallet ID,Transaction Hash,Notes\r\n"2026-01-02T03:04:05.000Z","BUY","BTC","Bitcoin, ""Spot""",0.5,60000,10,30010,"wallet-1","0xabc","line one\r\nline two"';

    expect(parseTransactionsCsv(csv)).toEqual({
      rows: [{
        line: 2,
        symbol: 'BTC',
        name: 'Bitcoin, "Spot"',
        type: 'BUY',
        amount: 0.5,
        pricePerCoin: 60000,
        fee: 10,
        totalAmount: 30010,
        walletId: 'wallet-1',
        txHash: '0xabc',
        executedAt: '2026-01-02T03:04:05.000Z',
        notes: 'line one\r\nline two',
      }],
      errors: [],
    });
  });

  it('reports malformed transaction rows with their CSV line instead of importing them', () => {
    const csv = 'Executed At,Type,Symbol,Name,Amount,Unit Price USD,Fee USD,Total USD,Wallet ID,Transaction Hash,Notes\n2026-01-02T03:04:05.000Z,SELL,BTC,Bitcoin,2,10,0,20,,,,\n2026-01-03T03:04:05.000Z,BUY,ETH,Ethereum,1,2000,0,2000,,,ok';

    expect(parseTransactionsCsv(csv)).toMatchObject({
      rows: [{ line: 3, symbol: 'ETH' }],
      errors: [{ line: 2, message: expect.stringContaining('12 cột') }],
    });
  });

  it('rejects a CSV with an unterminated quoted field', () => {
    const result = parseTransactionsCsv('Executed At,Type,Symbol,Name,Amount,Unit Price USD,Fee USD,Total USD,Wallet ID,Transaction Hash,Notes\n"2026-01-02T03:04:05.000Z,BUY,BTC');

    expect(result.rows).toEqual([]);
    expect(result.errors[0]?.message).toMatch(/dấu ngoặc kép/i);
  });

  it('skips transactions already present in the ledger and blocks an import that would oversell', () => {
    const csv = 'Executed At,Type,Symbol,Name,Amount,Unit Price USD,Fee USD,Total USD,Wallet ID,Transaction Hash,Notes\n2026-01-02T03:04:05.000Z,BUY,ETH,Ethereum,1,2000,0,2000,,0xalready,\n2026-01-03T03:04:05.000Z,SELL,ETH,Ethereum,2,2100,0,4200,,,too much';
    const existing: Transaction[] = [{
      id: 'tx-existing', coinId: 'eth', symbol: 'ETH', name: 'Ethereum', type: 'BUY',
      amount: 1, pricePerCoin: 2000, totalAmount: 2000, fee: 0, txHash: '0xalready',
      executedAt: '2026-01-02T03:04:05.000Z', createdAt: '2026-01-02T03:04:05.000Z',
    }];

    expect(planTransactionsCsvImport(csv, existing)).toMatchObject({
      rows: [{ symbol: 'ETH', type: 'SELL', amount: 2 }],
      duplicates: [{ line: 2 }],
      errors: [],
      balanceError: 'Giao dịch nhập khẩu làm số dư ETH bị âm; chưa có dòng nào được nhập.',
    });
  });

  it('does not treat a shared chain transaction hash as a duplicate across different assets', () => {
    const csv = 'Executed At,Type,Symbol,Name,Amount,Unit Price USD,Fee USD,Total USD,Wallet ID,Transaction Hash,Notes\n2026-01-02T03:04:05.000Z,TRANSFER_IN,ETH,Ethereum,1,2000,0,2000,wallet-1,0xmulti,';
    const existing: Transaction[] = [{
      id: 'tx-existing', coinId: 'btc', symbol: 'BTC', name: 'Bitcoin', type: 'TRANSFER_IN',
      amount: 1, pricePerCoin: 50000, totalAmount: 50000, fee: 0, walletId: 'wallet-1', txHash: '0xmulti',
      executedAt: '2026-01-02T03:04:05.000Z', createdAt: '2026-01-02T03:04:05.000Z',
    }];

    expect(planTransactionsCsvImport(csv, existing)).toMatchObject({
      rows: [{ symbol: 'ETH', txHash: '0xmulti' }],
      duplicates: [],
      balanceError: null,
    });
  });
});
