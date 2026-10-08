import { NextRequest, NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerSupabase } from '@/lib/supabase/server';
import { hasSufficientTransactionBalances, listTransactions, transactionToRow } from '@/lib/portfolio/repository';
import type { TransactionType } from '@/lib/types';

const transactionTypes: TransactionType[] = ['BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT'];

function apiError(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để quản lý giao dịch' }, { status: 401 });
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error
    && error.code === '23514' && typeof error.message === 'string'
    && error.message.includes('Transaction would make chronological asset balance negative.')) {
    return NextResponse.json({ error: 'Giao dịch này làm số dư tài sản bị âm. Hãy tải lại sổ giao dịch và thử lại.' }, { status: 409 });
  }
  console.error('Portfolio transactions API error:', error);
  return NextResponse.json({ error: 'Không thể xử lý giao dịch lúc này' }, { status: 500 });
}

export async function GET() {
  try {
    const user = await requireUser();
    const transactions = await listTransactions(await getServerSupabase(), user.id);
    return NextResponse.json({ transactions });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : symbol;
    const type = body.type as TransactionType;
    const amount = Number(body.amount);
    const pricePerCoin = Number(body.pricePerCoin);
    const fee = Number(body.fee ?? 0);
    if (!/^[A-Z0-9]{2,20}$/.test(symbol) || !transactionTypes.includes(type) || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(pricePerCoin) || pricePerCoin <= 0 || !Number.isFinite(fee) || fee < 0) {
      return NextResponse.json({ error: 'Thông tin giao dịch không hợp lệ' }, { status: 400 });
    }

    const executedAt = body.executedAt ? new Date(body.executedAt) : new Date();
    if (Number.isNaN(executedAt.getTime())) return NextResponse.json({ error: 'Ngày giao dịch không hợp lệ' }, { status: 400 });

    const supabase = await getServerSupabase();
    const currentTransactions = await listTransactions(supabase, user.id);
    const candidate = {
      id: 'new', coinId: symbol.toLowerCase(), symbol, name, type, amount, pricePerCoin,
      totalAmount: amount * pricePerCoin + fee, fee, executedAt: executedAt.toISOString(), createdAt: new Date().toISOString(),
    };
    if (!hasSufficientTransactionBalances([...currentTransactions, candidate])) {
      return NextResponse.json({ error: `Không đủ số dư ${symbol} cho giao dịch ${type === 'SELL' ? 'bán' : 'rút'}.` }, { status: 400 });
    }
    const row = transactionToRow(user.id, {
      symbol,
      name,
      type,
      amount,
      pricePerCoin,
      fee,
      walletId: typeof body.walletId === 'string' ? body.walletId : undefined,
      txHash: typeof body.txHash === 'string' ? body.txHash : undefined,
      executedAt: executedAt.toISOString(),
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });
    const { data, error } = await supabase.from('portfolio_transactions').insert(row).select('*').single();
    if (error || !data) throw error ?? new Error('Không thể lưu giao dịch');
    const transactions = await listTransactions(supabase, user.id);
    const transaction = transactions.find((item) => item.id === data.id);
    return NextResponse.json({ success: true, transaction }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Thiếu transaction ID' }, { status: 400 });
    const supabase = await getServerSupabase();
    const transactions = await listTransactions(supabase, user.id);
    const remaining = transactions.filter((transaction) => transaction.id !== id);
    if (!hasSufficientTransactionBalances(remaining)) {
      return NextResponse.json({ error: 'Không thể xóa giao dịch này vì các giao dịch sau đó sẽ vượt quá số dư.' }, { status: 409 });
    }
    const { data, error } = await supabase.from('portfolio_transactions').delete().eq('id', id).eq('owner_id', user.id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Không tìm thấy giao dịch' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Thiếu transaction ID' }, { status: 400 });
    const supabase = await getServerSupabase();
    const { data: current, error: readError } = await supabase.from('portfolio_transactions').select('*').eq('id', id).eq('owner_id', user.id).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: 'Không tìm thấy giao dịch' }, { status: 404 });

    const existingTransactions = await listTransactions(supabase, user.id);
    const oldTransaction = existingTransactions.find((transaction) => transaction.id === id);
    if (!oldTransaction) return NextResponse.json({ error: 'Không tìm thấy giao dịch' }, { status: 404 });

    const amount = body.amount === undefined ? Number(current.amount) : Number(body.amount);
    const pricePerCoin = body.pricePerCoin === undefined ? Number(current.price_per_coin) : Number(body.pricePerCoin);
    const fee = body.fee === undefined ? Number(current.fee) : Number(body.fee);
    const updates: Record<string, unknown> = {};
    if (body.type !== undefined) {
      if (!transactionTypes.includes(body.type)) return NextResponse.json({ error: 'Loại giao dịch không hợp lệ' }, { status: 400 });
      updates.type = body.type;
    }
    if (body.amount !== undefined || body.pricePerCoin !== undefined || body.fee !== undefined) {
      if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(pricePerCoin) || pricePerCoin <= 0 || !Number.isFinite(fee) || fee < 0) {
        return NextResponse.json({ error: 'Số lượng, đơn giá hoặc phí không hợp lệ' }, { status: 400 });
      }
      updates.amount = amount;
      updates.price_per_coin = pricePerCoin;
      updates.fee = fee;
      updates.total_amount = Number((amount * pricePerCoin + fee).toFixed(8));
    }
    if (body.notes !== undefined) updates.notes = typeof body.notes === 'string' ? body.notes : null;
    if (body.executedAt !== undefined) {
      const date = new Date(body.executedAt);
      if (Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Ngày giao dịch không hợp lệ' }, { status: 400 });
      updates.executed_at = date.toISOString();
    }
    const updatedTransaction = {
      ...oldTransaction,
      symbol: typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : oldTransaction.symbol,
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : oldTransaction.name,
      type: (updates.type as TransactionType | undefined) ?? oldTransaction.type,
      amount,
      pricePerCoin,
      fee,
      totalAmount: amount * pricePerCoin + fee,
      executedAt: typeof updates.executed_at === 'string' ? updates.executed_at : oldTransaction.executedAt,
    };
    if (!/^[A-Z0-9]{2,20}$/.test(updatedTransaction.symbol)) return NextResponse.json({ error: 'Mã tài sản không hợp lệ' }, { status: 400 });
    if (!hasSufficientTransactionBalances([...existingTransactions.filter((transaction) => transaction.id !== id), updatedTransaction])) {
      return NextResponse.json({ error: `Thay đổi này làm giao dịch vượt quá số dư ${updatedTransaction.symbol}.` }, { status: 400 });
    }
    if (body.symbol !== undefined) updates.symbol = updatedTransaction.symbol;
    if (body.name !== undefined) updates.name = updatedTransaction.name;
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Không có thay đổi hợp lệ' }, { status: 400 });

    const { error } = await supabase.from('portfolio_transactions').update(updates).eq('id', id).eq('owner_id', user.id);
    if (error) throw error;
    const transactions = await listTransactions(supabase, user.id);
    return NextResponse.json({ success: true, transaction: transactions.find((item) => item.id === id) });
  } catch (error) {
    return apiError(error);
  }
}
