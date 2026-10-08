import type { Transaction } from '@/lib/types';
import type { TransactionType } from '@/lib/types';

const headers = [
  'Executed At', 'Type', 'Symbol', 'Name', 'Amount', 'Unit Price USD',
  'Fee USD', 'Total USD', 'Wallet ID', 'Transaction Hash', 'Notes',
];

const transactionTypes = new Set<TransactionType>(['BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT']);

export interface TransactionImportRow {
  line: number;
  symbol: string;
  name: string;
  type: TransactionType;
  amount: number;
  pricePerCoin: number;
  fee: number;
  totalAmount: number;
  walletId?: string;
  txHash?: string;
  executedAt: string;
  notes?: string;
}

export interface TransactionCsvParseResult {
  rows: TransactionImportRow[];
  errors: Array<{ line: number; message: string }>;
}

export interface TransactionCsvImportPlan extends TransactionCsvParseResult {
  duplicates: Array<{ line: number; symbol: string; message: string }>;
  balanceError: string | null;
}

interface CsvRecord {
  line: number;
  fields: string[];
}

function parseRecords(input: string): { records: CsvRecord[]; error?: { line: number; message: string } } {
  const source = input.replace(/^\uFEFF/, '');
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = '';
  let line = 1;
  let recordLine = 1;
  let quoted = false;
  let closedQuote = false;

  const finishField = () => {
    fields.push(field);
    field = '';
    closedQuote = false;
  };
  const finishRecord = () => {
    finishField();
    if (fields.some((value) => value.trim() !== '')) records.push({ line: recordLine, fields });
    fields = [];
    recordLine = line + 1;
  };

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        field += char;
        if (char === '\n') line += 1;
        else if (char === '\r' && source[i + 1] !== '\n') line += 1;
      }
      continue;
    }

    if (closedQuote && char !== ',' && char !== '\n' && char !== '\r' && char !== ' ' && char !== '\t') {
      return { records: [], error: { line, message: 'CSV có nội dung không hợp lệ sau dấu ngoặc kép.' } };
    }
    if (char === '"') {
      if (field.length > 0) return { records: [], error: { line, message: 'CSV có dấu ngoặc kép không hợp lệ.' } };
      quoted = true;
    } else if (char === ',') {
      finishField();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      finishRecord();
      line += 1;
      recordLine = line;
    } else if (!closedQuote) {
      field += char;
    }
  }

  if (quoted) return { records: [], error: { line: recordLine, message: 'CSV có dấu ngoặc kép chưa được đóng.' } };
  if (field.length > 0 || fields.length > 0) finishRecord();
  return { records };
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseTransactionsCsv(input: string): TransactionCsvParseResult {
  const parsed = parseRecords(input);
  if (parsed.error) return { rows: [], errors: [parsed.error] };
  const [header, ...records] = parsed.records;
  if (!header) return { rows: [], errors: [{ line: 1, message: 'File CSV đang trống.' }] };
  if (header.fields.map((value) => value.trim()).join('\u0000') !== headers.join('\u0000')) {
    return { rows: [], errors: [{ line: header.line, message: 'Tiêu đề CSV không đúng định dạng giao dịch của ứng dụng.' }] };
  }

  const rows: TransactionImportRow[] = [];
  const errors: TransactionCsvParseResult['errors'] = [];
  for (const record of records) {
    if (record.fields.length !== headers.length) {
      errors.push({ line: record.line, message: `Dòng có ${record.fields.length} cột, cần đúng ${headers.length} cột.` });
      continue;
    }
    const [dateText, typeText, symbolText, nameText, amountText, priceText, feeText, totalText, walletText, hashText, notesText] = record.fields;
    const type = typeText.trim().toUpperCase() as TransactionType;
    const symbol = symbolText.trim().toUpperCase();
    const amount = parseNumber(amountText);
    const pricePerCoin = parseNumber(priceText);
    const fee = parseNumber(feeText);
    const totalAmount = parseNumber(totalText);
    const executedDate = new Date(dateText.trim());
    let message = '';

    if (Number.isNaN(executedDate.getTime())) message = 'Ngày giao dịch không hợp lệ.';
    else if (!transactionTypes.has(type)) message = 'Loại giao dịch không được hỗ trợ.';
    else if (!/^[A-Z0-9]{2,20}$/.test(symbol)) message = 'Mã tài sản không hợp lệ.';
    else if (amount === null || amount <= 0) message = 'Số lượng phải là số lớn hơn 0.';
    else if (pricePerCoin === null || pricePerCoin <= 0) message = 'Đơn giá phải là số lớn hơn 0.';
    else if (fee === null || fee < 0) message = 'Phí phải là số không âm.';
    else if (totalAmount === null || totalAmount < 0) message = 'Tổng giá trị không hợp lệ.';
    else {
      const expectedTotal = amount * pricePerCoin + fee;
      if (Math.abs(totalAmount - expectedTotal) > Math.max(1e-8, expectedTotal * 1e-8)) {
        message = 'Tổng giá trị không khớp số lượng, đơn giá và phí.';
      }
    }

    if (message) {
      errors.push({ line: record.line, message });
      continue;
    }
    rows.push({
      line: record.line,
      symbol,
      name: nameText.trim() || symbol,
      type,
      amount: amount!,
      pricePerCoin: pricePerCoin!,
      fee: fee!,
      totalAmount: totalAmount!,
      walletId: walletText.trim() || undefined,
      txHash: hashText.trim() || undefined,
      executedAt: executedDate.toISOString(),
      notes: notesText || undefined,
    });
  }

  return { rows, errors };
}

function transactionFingerprint(transaction: Pick<Transaction, 'symbol' | 'type' | 'executedAt' | 'amount' | 'pricePerCoin' | 'fee' | 'walletId'>) {
  return [
    transaction.symbol.toUpperCase(), transaction.type, new Date(transaction.executedAt).toISOString(),
    transaction.amount, transaction.pricePerCoin, transaction.fee, transaction.walletId ?? '',
  ].join('|');
}

function importFingerprint(transaction: Pick<Transaction, 'symbol' | 'type' | 'executedAt' | 'amount' | 'pricePerCoin' | 'fee' | 'walletId' | 'txHash'>) {
  const row = transactionFingerprint(transaction);
  const hash = transaction.txHash?.trim().toLowerCase();
  return hash ? `hash:${hash}|${row}` : `row:${row}`;
}

function hasSufficientBalances(transactions: Transaction[]) {
  const balances = new Map<string, number>();
  const ordered = [...transactions].sort((left, right) => left.executedAt.localeCompare(right.executedAt)
    || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  for (const transaction of ordered) {
    const symbol = transaction.symbol.toUpperCase();
    const balance = balances.get(symbol) ?? 0;
    const outgoing = transaction.type === 'SELL' || transaction.type === 'TRANSFER_OUT';
    if (outgoing && transaction.amount > balance + 1e-10) return symbol;
    balances.set(symbol, balance + (outgoing ? -transaction.amount : transaction.amount));
  }
  return null;
}

export function planTransactionsCsvImport(input: string, existing: Transaction[]): TransactionCsvImportPlan {
  const parsed = parseTransactionsCsv(input);
  const seen = new Set(existing.map(importFingerprint));
  const rows: TransactionImportRow[] = [];
  const duplicates: TransactionCsvImportPlan['duplicates'] = [];

  for (const row of parsed.rows) {
    const fingerprint = importFingerprint(row);
    if (seen.has(fingerprint)) {
      duplicates.push({ line: row.line, symbol: row.symbol, message: 'Giao dịch đã có trong sổ cái nên sẽ được bỏ qua.' });
      continue;
    }
    seen.add(fingerprint);
    rows.push(row);
  }

  const importTime = Date.now();
  const candidates: Transaction[] = rows.map((row, index) => ({
    id: `import-${String(index).padStart(6, '0')}`,
    coinId: row.symbol.toLowerCase(),
    symbol: row.symbol,
    name: row.name,
    type: row.type,
    amount: row.amount,
    pricePerCoin: row.pricePerCoin,
    totalAmount: row.totalAmount,
    fee: row.fee,
    walletId: row.walletId,
    txHash: row.txHash,
    executedAt: row.executedAt,
    notes: row.notes,
    createdAt: new Date(importTime + index).toISOString(),
  }));
  const negativeBalanceSymbol = hasSufficientBalances([...existing, ...candidates]);

  return {
    rows,
    errors: parsed.errors,
    duplicates,
    balanceError: negativeBalanceSymbol
      ? `Giao dịch nhập khẩu làm số dư ${negativeBalanceSymbol} bị âm; chưa có dòng nào được nhập.`
      : null,
  };
}

function csvCell(value: string | number | undefined) {
  let text = value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildTransactionsCsv(transactions: Transaction[]): string {
  const lines = transactions.map((transaction) => [
    transaction.executedAt,
    transaction.type,
    transaction.symbol,
    transaction.name,
    transaction.amount,
    transaction.pricePerCoin,
    transaction.fee,
    transaction.totalAmount,
    transaction.walletId,
    transaction.txHash,
    transaction.notes,
  ].map(csvCell).join(','));

  return `\uFEFF${headers.join(',')}${lines.length ? `\r\n${lines.join('\r\n')}` : ''}`;
}
