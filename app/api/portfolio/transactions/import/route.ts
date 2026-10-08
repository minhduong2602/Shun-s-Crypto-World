import { NextRequest, NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerSupabase } from '@/lib/supabase/server';
import { listTransactions, transactionToRow } from '@/lib/portfolio/repository';
import { planTransactionsCsvImport } from '@/lib/portfolio/transactions-csv';

const MAX_CSV_CHARACTERS = 1_000_000;
const MAX_CSV_ROWS = 500;

function apiError(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để nhập giao dịch' }, { status: 401 });
  console.error('Portfolio transaction import error:', error);
  return NextResponse.json({ error: 'Không thể nhập giao dịch lúc này' }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const csv = typeof body.csv === 'string' ? body.csv : '';
    const mode = body.mode;
    if (mode !== 'preview' && mode !== 'import') {
      return NextResponse.json({ error: 'Chế độ nhập CSV không hợp lệ' }, { status: 400 });
    }
    if (!csv.trim()) return NextResponse.json({ error: 'Vui lòng chọn file CSV giao dịch.' }, { status: 400 });
    if (csv.length > MAX_CSV_CHARACTERS) {
      return NextResponse.json({ error: 'File CSV vượt quá giới hạn 1 MB.' }, { status: 413 });
    }

    const supabase = await getServerSupabase();
    const existing = await listTransactions(supabase, user.id);
    const plan = planTransactionsCsvImport(csv, existing);
    const rowCount = plan.rows.length + plan.errors.length + plan.duplicates.length;
    if (rowCount > MAX_CSV_ROWS) {
      return NextResponse.json({ error: `Chỉ hỗ trợ tối đa ${MAX_CSV_ROWS} dòng giao dịch mỗi lần.` }, { status: 413 });
    }

    const validWalletId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const walletIds = [...new Set(plan.rows.map((row) => row.walletId)
      .filter((id): id is string => Boolean(id && validWalletId.test(id))))];
    let warnings: Array<{ line: number; message: string }> = [];
    const invalidRows = plan.rows.filter((row) => row.walletId && !validWalletId.test(row.walletId));
    if (walletIds.length > 0) {
      const { data, error } = await supabase.from('wallets')
        .select('id')
        .eq('owner_id', user.id)
        .in('id', walletIds);
      if (error) throw error;
      const ownedWalletIds = new Set((data ?? []).map((wallet: { id: string }) => wallet.id));
      invalidRows.push(...plan.rows.filter((row) => row.walletId && validWalletId.test(row.walletId) && !ownedWalletIds.has(row.walletId)));
    }
    warnings = invalidRows.map((row) => ({
      line: row.line,
      message: 'Ví liên kết không còn thuộc tài khoản này; giao dịch sẽ được nhập không gắn ví.',
    }));
    for (const row of invalidRows) row.walletId = undefined;

    if (mode === 'preview') {
      return NextResponse.json({
        rows: plan.rows,
        errors: plan.errors,
        duplicates: plan.duplicates,
        duplicateCount: plan.duplicates.length,
        warnings,
        balanceError: plan.balanceError,
        canImport: plan.rows.length > 0 && plan.errors.length === 0 && plan.balanceError === null,
      });
    }

    if (plan.errors.length > 0) {
      return NextResponse.json({ error: 'Hãy sửa các dòng CSV lỗi trước khi nhập.', errors: plan.errors }, { status: 400 });
    }
    if (plan.balanceError) return NextResponse.json({ error: plan.balanceError }, { status: 409 });
    if (plan.rows.length === 0) {
      return NextResponse.json({ error: 'Không còn giao dịch mới để nhập; các giao dịch trong file đã có trong sổ cái.' }, { status: 409 });
    }

    const createdAtByLine = new Map(
      [...plan.rows]
        .sort((left, right) => left.executedAt.localeCompare(right.executedAt) || left.line - right.line)
        .map((row, index) => [row.line, new Date(Date.now() + index).toISOString()] as const),
    );
    const transactionRows = plan.rows.map((row) => ({
      ...transactionToRow(user.id, row),
      created_at: createdAtByLine.get(row.line),
    }));
    const { error } = await supabase.from('portfolio_transactions').insert(transactionRows);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      importedCount: transactionRows.length,
      duplicateCount: plan.duplicates.length,
      warnings,
    }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
