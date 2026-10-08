-- Automatic wallet refresh without storing the endpoint or bearer secret in cron.job.
create schema if not exists extensions;
create schema if not exists vault;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.wallet_sync_cron_lock (
  id smallint primary key default 1 check (id = 1),
  locked_until timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);
insert into public.wallet_sync_cron_lock (id) values (1) on conflict (id) do nothing;
alter table public.wallet_sync_cron_lock enable row level security;

create or replace function public.claim_wallet_sync_cron_lock()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  affected_rows integer;
begin
  update public.wallet_sync_cron_lock
  set locked_until = timezone('utc', now()) + interval '4 minutes',
      updated_at = timezone('utc', now())
  where id = 1 and (locked_until is null or locked_until <= timezone('utc', now()));
  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

create or replace function public.release_wallet_sync_cron_lock()
returns void language sql security definer set search_path = public as $$
  update public.wallet_sync_cron_lock
  set locked_until = null, updated_at = timezone('utc', now())
  where id = 1;
$$;

revoke all on function public.claim_wallet_sync_cron_lock() from public, anon, authenticated;
revoke all on function public.release_wallet_sync_cron_lock() from public, anon, authenticated;
grant execute on function public.claim_wallet_sync_cron_lock() to service_role;
grant execute on function public.release_wallet_sync_cron_lock() to service_role;

create or replace function public.invoke_wallet_sync_cron()
returns bigint language plpgsql security definer set search_path = public, vault, net as $$
declare
  endpoint text;
  bearer_secret text;
  request_id bigint;
begin
  select decrypted_secret into endpoint
  from vault.decrypted_secrets where name = 'wallet_sync_endpoint'
  order by created_at desc limit 1;
  select decrypted_secret into bearer_secret
  from vault.decrypted_secrets where name = 'wallet_sync_cron_secret'
  order by created_at desc limit 1;

  if endpoint is null or bearer_secret is null then
    raise notice 'Wallet sync cron is not configured; add wallet_sync_endpoint and wallet_sync_cron_secret to Vault.';
    return null;
  end if;

  select net.http_get(
    url := endpoint,
    headers := jsonb_build_object('Authorization', 'Bearer ' || bearer_secret),
    timeout_milliseconds := 120000
  ) into request_id;
  return request_id;
end;
$$;
revoke all on function public.invoke_wallet_sync_cron() from public, anon, authenticated;
grant execute on function public.invoke_wallet_sync_cron() to postgres;

create or replace function public.invoke_telegram_alert_cron()
returns bigint language plpgsql security definer set search_path = public, vault, net as $$
declare
  endpoint text;
  bearer_secret text;
  request_id bigint;
begin
  select decrypted_secret into endpoint
  from vault.decrypted_secrets where name = 'telegram_alerts_endpoint'
  order by created_at desc limit 1;
  select decrypted_secret into bearer_secret
  from vault.decrypted_secrets where name = 'telegram_alerts_cron_secret'
  order by created_at desc limit 1;

  if endpoint is null or bearer_secret is null then
    raise notice 'Telegram alert cron is not configured; add telegram_alerts_endpoint and telegram_alerts_cron_secret to Vault.';
    return null;
  end if;

  select net.http_post(
    url := endpoint,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || bearer_secret),
    timeout_milliseconds := 120000
  ) into request_id;
  return request_id;
end;
$$;
revoke all on function public.invoke_telegram_alert_cron() from public, anon, authenticated;
grant execute on function public.invoke_telegram_alert_cron() to postgres;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'portfolio-wallet-auto-sync') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'portfolio-wallet-auto-sync';
  end if;
  perform cron.schedule(
    'portfolio-wallet-auto-sync',
    '*/15 * * * *',
    'select public.invoke_wallet_sync_cron();'
  );
  if exists (select 1 from cron.job where jobname = 'portfolio-telegram-alerts') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'portfolio-telegram-alerts';
  end if;
  perform cron.schedule(
    'portfolio-telegram-alerts',
    '*/5 * * * *',
    'select public.invoke_telegram_alert_cron();'
  );
end;
$$;
