import { NextRequest, NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerEnv } from '@/lib/config/env';
import { getServerSupabase } from '@/lib/supabase/server';
import type { AlertCondition, ChainType, PriceAlert } from '@/lib/types';

type AlertRow = {
  id: string;
  symbol: string;
  condition: AlertCondition;
  target_value: number | string;
  is_active: boolean;
  is_recurring: boolean;
  last_triggered_at: string | null;
  created_at: string;
  wallet_asset_id?: string | null;
  chain?: ChainType | null;
  asset_address_normalized?: string | null;
};

type AlertDeliveryRow = {
  id: string;
  alert_id: string;
  observed_price_usd: number | string | null;
  observed_change_24h: number | string | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  created_at: string;
  delivered_at: string | null;
};

type LinkedAlertAsset = { id: string; chain: ChainType; symbol: string; asset_address_normalized: string };

function mapAlert(row: AlertRow): PriceAlert {
  return {
    id: row.id,
    coinId: row.symbol.toLowerCase(),
    symbol: row.symbol,
    condition: row.condition,
    targetValue: Number(row.target_value),
    currentValueAtCreation: 0,
    isActive: row.is_active,
    isRecurring: row.is_recurring,
    triggeredAt: row.last_triggered_at ?? undefined,
    createdAt: row.created_at,
    walletAssetId: row.wallet_asset_id ?? undefined,
    chain: row.chain ?? undefined,
    assetAddress: row.asset_address_normalized ?? undefined,
  };
}

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'Cần đăng nhập để quản lý cảnh báo' }, { status: 401 });
  }
  console.error('Alerts API error:', error);
  return NextResponse.json({ error: 'Không thể xử lý cảnh báo lúc này' }, { status: 500 });
}

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await getServerSupabase();
    const [alertsResult, settingsResult, deliveriesResult, walletAssetsResult] = await Promise.all([
      supabase.from('price_alerts').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
      supabase.from('user_settings').select('telegram_chat_id, telegram_alerts_enabled').eq('owner_id', user.id).maybeSingle(),
      supabase.from('alert_deliveries')
        .select('id,alert_id,observed_price_usd,observed_change_24h,status,created_at,delivered_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(25),
      supabase.from('wallet_assets')
        .select('id,chain,symbol,name,asset_address_normalized,is_native')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .order('chain', { ascending: true })
        .order('symbol', { ascending: true }),
    ]);
    if (alertsResult.error) throw alertsResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (deliveriesResult.error) throw deliveriesResult.error;
    if (walletAssetsResult.error) throw walletAssetsResult.error;
    const tokenAvailable = Boolean(getServerEnv().TELEGRAM_BOT_TOKEN);

    return NextResponse.json({
      alerts: ((alertsResult.data ?? []) as AlertRow[]).map(mapAlert),
      walletAssets: (walletAssetsResult.data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        chain: String(row.chain),
        symbol: String(row.symbol),
        name: String(row.name),
        assetAddress: String(row.asset_address_normalized),
        isNative: Boolean(row.is_native),
      })),
      deliveries: ((deliveriesResult.data ?? []) as AlertDeliveryRow[]).map((row) => ({
        id: row.id,
        alertId: row.alert_id,
        observedPriceUsd: row.observed_price_usd === null ? null : Number(row.observed_price_usd),
        observedChange24h: row.observed_change_24h === null ? null : Number(row.observed_change_24h),
        status: row.status,
        createdAt: row.created_at,
        deliveredAt: row.delivered_at ?? undefined,
      })),
      telegramConfig: {
        chatId: settingsResult.data?.telegram_chat_id ?? '',
        hasToken: tokenAvailable,
        enabled: Boolean(settingsResult.data?.telegram_alerts_enabled),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const walletAssetId = typeof body.walletAssetId === 'string' ? body.walletAssetId : '';
    let linkedAsset: LinkedAlertAsset | null = null;
    const supabase = await getServerSupabase();
    if (walletAssetId) {
      const { data, error } = await supabase.from('wallet_assets')
        .select('id,chain,symbol,asset_address_normalized')
        .eq('id', walletAssetId)
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Không tìm thấy tài sản ví đang theo dõi' }, { status: 404 });
      linkedAsset = data as LinkedAlertAsset;
    }
    const symbol = linkedAsset?.symbol.toUpperCase() ?? (typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : '');
    const condition = body.condition as AlertCondition;
    const targetValue = Number(body.targetValue);
    const conditions: AlertCondition[] = ['ABOVE', 'BELOW', 'PCT_UP_24H', 'PCT_DOWN_24H'];

    if (!/^[A-Z0-9]{2,20}$/.test(symbol) || !conditions.includes(condition) || !Number.isFinite(targetValue) || targetValue <= 0) {
      return NextResponse.json({ error: 'Mã tài sản, điều kiện hoặc giá trị mục tiêu không hợp lệ' }, { status: 400 });
    }

    const { data, error } = await supabase.from('price_alerts').insert({
      owner_id: user.id,
      wallet_asset_id: linkedAsset?.id ?? null,
      chain: linkedAsset?.chain ?? null,
      asset_address_normalized: linkedAsset?.asset_address_normalized ?? null,
      symbol,
      condition,
      target_value: targetValue,
      is_active: true,
      is_recurring: Boolean(body.isRecurring),
    }).select('*').single();
    if (error || !data) throw error ?? new Error('Không thể tạo cảnh báo');

    return NextResponse.json({ success: true, alert: mapAlert(data as AlertRow) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Thiếu alert ID' }, { status: 400 });

    const supabase = await getServerSupabase();
    const { data, error } = await supabase.from('price_alerts').delete().eq('id', id).eq('owner_id', user.id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Không tìm thấy cảnh báo' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Thiếu alert ID' }, { status: 400 });

    const supabase = await getServerSupabase();
    const { data: current, error: readError } = await supabase.from('price_alerts').select('is_active').eq('id', id).eq('owner_id', user.id).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: 'Không tìm thấy cảnh báo' }, { status: 404 });

    const { data, error } = await supabase.from('price_alerts').update({ is_active: !current.is_active }).eq('id', id).eq('owner_id', user.id).select('*').single();
    if (error || !data) throw error ?? new Error('Không thể cập nhật cảnh báo');
    return NextResponse.json({ success: true, alert: mapAlert(data as AlertRow) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Thiếu alert ID' }, { status: 400 });

    const updates: { condition?: AlertCondition; target_value?: number; is_recurring?: boolean; is_active?: boolean } = {};
    if (body.condition !== undefined) {
      const conditions: AlertCondition[] = ['ABOVE', 'BELOW', 'PCT_UP_24H', 'PCT_DOWN_24H'];
      if (!conditions.includes(body.condition)) return NextResponse.json({ error: 'Điều kiện cảnh báo không hợp lệ' }, { status: 400 });
      updates.condition = body.condition;
    }
    if (body.targetValue !== undefined) {
      const targetValue = Number(body.targetValue);
      if (!Number.isFinite(targetValue) || targetValue <= 0) return NextResponse.json({ error: 'Giá trị mục tiêu phải lớn hơn 0' }, { status: 400 });
      updates.target_value = targetValue;
    }
    if (body.isRecurring !== undefined) updates.is_recurring = Boolean(body.isRecurring);
    if (body.isActive !== undefined) updates.is_active = Boolean(body.isActive);
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Không có thay đổi hợp lệ' }, { status: 400 });

    const supabase = await getServerSupabase();
    const { data, error } = await supabase.from('price_alerts').update(updates).eq('id', id).eq('owner_id', user.id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Không tìm thấy cảnh báo' }, { status: 404 });
    return NextResponse.json({ success: true, alert: mapAlert(data as AlertRow) });
  } catch (error) {
    return errorResponse(error);
  }
}
