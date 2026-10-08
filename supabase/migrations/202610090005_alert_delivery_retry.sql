-- Atomically claim an alert delivery, including retries after failed or abandoned sends.
create or replace function public.claim_alert_delivery(
  p_owner_id uuid,
  p_alert_id uuid,
  p_bucket_key text,
  p_observed_price_usd numeric,
  p_observed_change_24h numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  insert into public.alert_deliveries as existing (
    owner_id, alert_id, bucket_key, observed_price_usd, observed_change_24h, status
  ) values (
    p_owner_id, p_alert_id, p_bucket_key, p_observed_price_usd, p_observed_change_24h, 'pending'
  )
  on conflict (alert_id, bucket_key) do update
  set status = 'pending',
      observed_price_usd = excluded.observed_price_usd,
      observed_change_24h = excluded.observed_change_24h,
      provider_response = null,
      created_at = timezone('utc', now()),
      delivered_at = null
  where existing.status = 'failed'
     or (
       existing.status = 'pending'
       and existing.created_at < timezone('utc', now()) - interval '10 minutes'
     )
  returning id into claimed_id;

  return claimed_id is not null;
end;
$$;

revoke all on function public.claim_alert_delivery(uuid, uuid, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.claim_alert_delivery(uuid, uuid, text, numeric, numeric) to service_role;
