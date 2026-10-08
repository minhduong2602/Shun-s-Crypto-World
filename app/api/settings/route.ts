import { NextRequest, NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerSupabase } from '@/lib/supabase/server';

const supportedCurrencies = ['USD', 'VND'] as const;
type BaseCurrency = (typeof supportedCurrencies)[number];

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'Cần đăng nhập để truy cập cài đặt' }, { status: 401 });
  }
  console.error('Settings API error:', error);
  return NextResponse.json({ error: 'Không thể lưu cài đặt lúc này' }, { status: 500 });
}

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await getServerSupabase();
    const { data, error } = await supabase.from('user_settings')
      .select('base_currency')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (error) throw error;

    const baseCurrency: BaseCurrency = data?.base_currency === 'VND' ? 'VND' : 'USD';
    return NextResponse.json({ baseCurrency });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const baseCurrency = body && typeof body === 'object' ? body.baseCurrency : undefined;
    if (!supportedCurrencies.includes(baseCurrency)) {
      return NextResponse.json({ error: 'Đơn vị tiền tệ không được hỗ trợ' }, { status: 400 });
    }

    const supabase = await getServerSupabase();
    const { error } = await supabase.from('user_settings').upsert({
      owner_id: user.id,
      base_currency: baseCurrency,
    }, { onConflict: 'owner_id' });
    if (error) throw error;

    return NextResponse.json({ baseCurrency });
  } catch (error) {
    return errorResponse(error);
  }
}
