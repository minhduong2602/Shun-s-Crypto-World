-- Enable these extensions from Supabase Dashboard if they are not already enabled:
-- pg_cron, pg_net and supabase_vault.
--
-- Store CRON_SHARED_SECRET in Vault, then schedule the Edge Function from the
-- Dashboard Scheduler. The request must include: Authorization: Bearer <secret>.
-- The function uses a unique (alert_id, bucket_key) delivery row to make retries
-- and overlapping cron runs idempotent.

create index if not exists wallet_assets_alert_lookup_idx
  on public.wallet_assets (owner_id, symbol, is_active)
  where is_active;

create index if not exists wallet_assets_alert_identity_idx
  on public.wallet_assets (owner_id, chain, asset_address_normalized, is_active)
  where is_active;
