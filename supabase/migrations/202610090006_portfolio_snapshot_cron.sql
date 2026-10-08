-- Schedule one daily snapshot without putting the endpoint or bearer token in cron.job.
create schema if not exists extensions;
create schema if not exists vault;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

revoke all on function public.record_daily_snapshot(uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.record_daily_snapshot(uuid, numeric, numeric) to service_role;

create or replace function public.list_portfolio_snapshot_owners()
returns setof uuid language sql security definer set search_path = public as $$
  select distinct owner_id from public.portfolio_transactions order by owner_id;
$$;
revoke all on function public.list_portfolio_snapshot_owners() from public, anon, authenticated;
grant execute on function public.list_portfolio_snapshot_owners() to service_role;

create or replace function public.invoke_portfolio_snapshot_cron()
returns bigint language plpgsql security definer set search_path = public, vault, net as $$
declare
  endpoint text;
  bearer_secret text;
  request_id bigint;
begin
  select decrypted_secret into endpoint
  from vault.decrypted_secrets where name = 'portfolio_snapshots_endpoint'
  order by created_at desc limit 1;
  select decrypted_secret into bearer_secret
  from vault.decrypted_secrets where name = 'portfolio_snapshots_cron_secret'
  order by created_at desc limit 1;

  if endpoint is null or bearer_secret is null then
    raise notice 'Portfolio snapshot cron is not configured; add portfolio_snapshots_endpoint and portfolio_snapshots_cron_secret to Vault.';
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

revoke all on function public.invoke_portfolio_snapshot_cron() from public, anon, authenticated;
grant execute on function public.invoke_portfolio_snapshot_cron() to postgres;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'portfolio-daily-snapshot') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'portfolio-daily-snapshot';
  end if;
  perform cron.schedule(
    'portfolio-daily-snapshot',
    '7 0 * * *',
    'select public.invoke_portfolio_snapshot_cron();'
  );
end;
$$;
