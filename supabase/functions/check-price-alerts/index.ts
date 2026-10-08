// @ts-nocheck -- this file is type-checked by the Supabase Deno runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { claimAlertDelivery } from '../_shared/claim-delivery.ts';
import { createAlertMarketQuoteProvider, isAlertTriggered } from '../_shared/alert-market-quotes.ts';
import { loadAllPages } from '../_shared/pagination.ts';
import { formatAlertUsdPrice } from '../_shared/telegram-alert-message.ts';
import { isTelegramSendSuccessful } from '../_shared/telegram-send-result.ts';
import { getAlertDeliveryBucket } from '../_shared/delivery-bucket.ts';

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
  created_at: string;
  last_triggered_at: string | null;
};

Deno.serve(async (request) => {
  const secret = Deno.env.get('CRON_SHARED_SECRET');
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!telegramToken) return Response.json({ error: 'TELEGRAM_BOT_TOKEN is not configured' }, { status: 500 });
  const coingeckoKeys = [
    Deno.env.get('COINGECKO_DEMO_API_KEY'),
    Deno.env.get('COINGECKO_DEMO_API_KEY_2'),
    Deno.env.get('COINGECKO_DEMO_API_KEY_3'),
  ].filter((key): key is string => Boolean(key));
  const quoteProvider = createAlertMarketQuoteProvider({ apiKeys: coingeckoKeys });

  const supabase = createClient(url, serviceRoleKey);
  let alerts: Alert[];
  try {
    alerts = await loadAllPages<Alert>(async (afterId, pageSize) => {
      let query = supabase.from('price_alerts').select('*').eq('is_active', true)
        .order('id', { ascending: true }).limit(pageSize);
      if (afterId !== null) query = query.gt('id', afterId);
      return await query;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Could not load active Telegram alerts:', message);
    return Response.json({ error: 'Could not load active alerts' }, { status: 500 });
  }

  let delivered = 0;
  for (const alert of alerts) {
    let assetQuery = supabase
      .from('wallet_assets')
      .select('chain, asset_address, asset_address_normalized, is_native, symbol')
      .eq('owner_id', alert.owner_id)
      .eq('is_active', true)
      .limit(1);
    if (alert.wallet_asset_id) assetQuery = assetQuery.eq('id', alert.wallet_asset_id);
    else if (alert.chain && alert.asset_address_normalized) {
      assetQuery = assetQuery.eq('chain', alert.chain).eq('asset_address_normalized', alert.asset_address_normalized);
    } else assetQuery = assetQuery.eq('symbol', alert.symbol);

    const { data: asset } = await assetQuery.maybeSingle();
    const isContractSpecific = Boolean(alert.wallet_asset_id || (alert.chain && alert.asset_address_normalized));
    const quote = isContractSpecific
      ? (asset || (alert.chain && alert.asset_address_normalized)
        ? await quoteProvider.forAsset({
            symbol: alert.symbol,
            chain: alert.chain ?? asset?.chain,
            assetAddress: alert.asset_address_normalized ?? asset?.asset_address_normalized ?? asset?.asset_address,
            isNative: asset?.is_native ?? alert.asset_address_normalized === 'native',
          })
        : null)
      : await quoteProvider.bySymbol(alert.symbol);
    if (!quote || !isAlertTriggered({ condition: alert.condition, target: alert.target_value }, quote)) continue;
    const price = quote.price;
    const change24h = quote.change24h;

    const bucket = getAlertDeliveryBucket(
      alert.id,
      alert.cooldown_minutes,
      Date.now(),
      alert.last_triggered_at,
      alert.created_at,
    );
    let claimed = false;
    try {
      claimed = await claimAlertDelivery(supabase, {
        ownerId: alert.owner_id,
        alertId: alert.id,
        bucketKey: bucket,
        price,
        change24h,
      });
    } catch (claimError) {
      console.error('Could not claim Telegram alert delivery:', claimError);
      continue;
    }
    if (!claimed) continue; // another run owns the pending/sent delivery for this cooldown bucket.

    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('telegram_chat_id, telegram_alerts_enabled')
      .eq('owner_id', alert.owner_id)
      .maybeSingle();
    if (settingsError) {
      await supabase.from('alert_deliveries').update({ status: 'failed', provider_response: settingsError.message })
        .eq('alert_id', alert.id).eq('bucket_key', bucket);
      continue;
    }
    if (!settings?.telegram_alerts_enabled || !settings.telegram_chat_id) {
      await supabase.from('alert_deliveries').update({ status: 'skipped' }).eq('alert_id', alert.id).eq('bucket_key', bucket);
      continue;
    }

    const message = `🔔 ${alert.symbol} ${alert.condition}\nGiá: ${formatAlertUsdPrice(price)}\n24h: ${change24h === null ? 'N/A' : `${change24h.toFixed(2)}%`}`;
    let telegramOk = false;
    let providerResponse = '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const telegram = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: settings.telegram_chat_id, text: message }),
        signal: controller.signal,
      });
      providerResponse = await telegram.text();
      telegramOk = isTelegramSendSuccessful(telegram.ok, providerResponse);
    } catch (telegramError) {
      providerResponse = telegramError instanceof Error ? telegramError.message : String(telegramError);
    } finally {
      clearTimeout(timeout);
    }
    await supabase.from('alert_deliveries').update({
      status: telegramOk ? 'sent' : 'failed',
      provider_response: providerResponse.slice(0, 2000),
      delivered_at: telegramOk ? new Date().toISOString() : null,
    }).eq('alert_id', alert.id).eq('bucket_key', bucket);
    if (telegramOk) {
      delivered += 1;
      await supabase.from('price_alerts').update({
        last_triggered_at: new Date().toISOString(),
        is_active: alert.is_recurring,
      }).eq('id', alert.id);
    }
  }

  return Response.json({ delivered });
});
