// @ts-nocheck -- this file is type-checked by the Supabase Deno runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Alert = {
  id: string;
  owner_id: string;
  symbol: string;
  condition: 'ABOVE' | 'BELOW' | 'PCT_UP_24H' | 'PCT_DOWN_24H';
  target_value: number;
  is_recurring: boolean;
  cooldown_minutes: number;
  wallet_asset_id: string | null;
  chain: string | null;
  asset_address_normalized: string | null;
};

function isTriggered(alert: Alert, price: number, change24h: number) {
  if (alert.condition === 'ABOVE') return price >= alert.target_value;
  if (alert.condition === 'BELOW') return price <= alert.target_value;
  if (alert.condition === 'PCT_UP_24H') return change24h >= alert.target_value;
  return change24h <= -Math.abs(alert.target_value);
}

Deno.serve(async (request) => {
  const secret = Deno.env.get('CRON_SHARED_SECRET');
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!telegramToken) return Response.json({ error: 'TELEGRAM_BOT_TOKEN is not configured' }, { status: 500 });

  const supabase = createClient(url, serviceRoleKey);
  const { data: alerts, error } = await supabase.from('price_alerts').select('*').eq('is_active', true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let delivered = 0;
  for (const alert of (alerts ?? []) as Alert[]) {
    let assetQuery = supabase
      .from('wallet_assets')
      .select('price_usd, price_change_24h')
      .eq('owner_id', alert.owner_id)
      .eq('is_active', true)
      .limit(1);
    if (alert.wallet_asset_id) assetQuery = assetQuery.eq('id', alert.wallet_asset_id);
    else if (alert.chain && alert.asset_address_normalized) {
      assetQuery = assetQuery.eq('chain', alert.chain).eq('asset_address_normalized', alert.asset_address_normalized);
    } else assetQuery = assetQuery.eq('symbol', alert.symbol);

    const { data: asset } = await assetQuery.maybeSingle();
    const price = Number(asset?.price_usd ?? 0);
    const change24h = Number(asset?.price_change_24h ?? 0);
    if (!asset || !isTriggered(alert, price, change24h)) continue;

    const bucket = `${alert.id}:${Math.floor(Date.now() / (alert.cooldown_minutes * 60_000))}`;
    const { error: claimError } = await supabase.from('alert_deliveries').insert({
      owner_id: alert.owner_id,
      alert_id: alert.id,
      bucket_key: bucket,
      observed_price_usd: price,
      observed_change_24h: change24h,
      status: 'pending',
    });
    if (claimError) continue; // unique bucket means a parallel cron already owns this delivery.

    const { data: settings } = await supabase
      .from('user_settings')
      .select('telegram_chat_id, telegram_alerts_enabled')
      .eq('owner_id', alert.owner_id)
      .maybeSingle();
    if (!settings?.telegram_alerts_enabled || !settings.telegram_chat_id) {
      await supabase.from('alert_deliveries').update({ status: 'skipped' }).eq('alert_id', alert.id).eq('bucket_key', bucket);
      continue;
    }

    const message = `🔔 ${alert.symbol} ${alert.condition}\nGiá: $${price.toLocaleString()}\n24h: ${change24h.toFixed(2)}%`;
    const telegram = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: settings.telegram_chat_id, text: message }),
    });
    const providerResponse = await telegram.text();
    await supabase.from('alert_deliveries').update({
      status: telegram.ok ? 'sent' : 'failed',
      provider_response: providerResponse.slice(0, 2000),
      delivered_at: telegram.ok ? new Date().toISOString() : null,
    }).eq('alert_id', alert.id).eq('bucket_key', bucket);
    if (telegram.ok) {
      delivered += 1;
      await supabase.from('price_alerts').update({
        last_triggered_at: new Date().toISOString(),
        is_active: alert.is_recurring,
      }).eq('id', alert.id);
    }
  }

  return Response.json({ delivered });
});
