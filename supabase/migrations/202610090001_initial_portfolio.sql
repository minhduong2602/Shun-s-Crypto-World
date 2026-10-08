create extension if not exists pgcrypto;

create type public.chain_type as enum ('ETH', 'BSC', 'POLYGON', 'ARBITRUM', 'SOL', 'BTC');
create type public.transaction_type as enum ('BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT');
create type public.alert_condition as enum ('ABOVE', 'BELOW', 'PCT_UP_24H', 'PCT_DOWN_24H');
create type public.sync_status as enum ('pending', 'running', 'success', 'partial', 'failed');
create type public.delivery_status as enum ('pending', 'sent', 'failed', 'skipped');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = timezone('utc', now()); return new; end;
$$;

create table public.user_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  base_currency text not null default 'USD' check (base_currency in ('USD', 'VND', 'EUR')),
  telegram_chat_id text,
  telegram_alerts_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  chain public.chain_type not null,
  address text not null,
  address_normalized text not null,
  label text not null check (char_length(trim(label)) between 1 and 120),
  is_active boolean not null default true,
  native_balance numeric not null default 0,
  native_symbol text not null,
  balance_usd numeric not null default 0,
  asset_count integer not null default 0,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, chain, address_normalized)
);
create index wallets_owner_active_idx on public.wallets (owner_id, is_active);

create table public.wallet_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  chain public.chain_type not null,
  asset_address text not null,
  asset_address_normalized text not null,
  is_native boolean not null default false,
  symbol text not null,
  name text not null,
  decimals integer not null check (decimals >= 0 and decimals <= 255),
  raw_balance text not null,
  balance numeric not null,
  price_usd numeric,
  price_change_24h numeric,
  balance_usd numeric not null default 0,
  price_updated_at timestamptz,
  synced_at timestamptz not null default timezone('utc', now()),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((is_native and asset_address_normalized = 'native') or not is_native),
  unique (wallet_id, chain, asset_address_normalized)
);
create index wallet_assets_owner_active_idx on public.wallet_assets (owner_id, is_active);
create index wallet_assets_wallet_active_idx on public.wallet_assets (wallet_id, is_active);

create table public.portfolio_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid references public.wallets(id) on delete set null,
  chain public.chain_type,
  asset_address text,
  symbol text not null,
  name text not null,
  type public.transaction_type not null,
  amount numeric not null check (amount > 0),
  price_per_coin numeric not null check (price_per_coin > 0),
  fee numeric not null default 0 check (fee >= 0),
  total_amount numeric not null check (total_amount >= 0),
  tx_hash text,
  executed_at timestamptz not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index portfolio_transactions_owner_executed_idx on public.portfolio_transactions (owner_id, executed_at desc);

create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  wallet_asset_id uuid references public.wallet_assets(id) on delete set null,
  chain public.chain_type,
  asset_address_normalized text,
  symbol text not null,
  condition public.alert_condition not null,
  target_value numeric not null,
  is_active boolean not null default true,
  is_recurring boolean not null default false,
  cooldown_minutes integer not null default 30 check (cooldown_minutes between 1 and 1440),
  last_triggered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index price_alerts_active_idx on public.price_alerts (owner_id, is_active) where is_active;

create table public.alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  alert_id uuid not null references public.price_alerts(id) on delete cascade,
  bucket_key text not null,
  observed_price_usd numeric,
  observed_change_24h numeric,
  status public.delivery_status not null default 'pending',
  provider_response text,
  created_at timestamptz not null default timezone('utc', now()),
  delivered_at timestamptz,
  unique (alert_id, bucket_key)
);
create index alert_deliveries_owner_created_idx on public.alert_deliveries (owner_id, created_at desc);

create table public.wallet_sync_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  status public.sync_status not null default 'pending',
  asset_count integer not null default 0,
  provider text,
  error_code text,
  error_message text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);
create index wallet_sync_runs_wallet_started_idx on public.wallet_sync_runs (wallet_id, started_at desc);

create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  total_value_usd numeric not null,
  change_24h_usd numeric not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, snapshot_date)
);

create or replace function public.record_daily_snapshot(p_owner_id uuid, p_total_value_usd numeric, p_change_24h_usd numeric)
returns void language sql security definer set search_path = public as $$
  insert into public.portfolio_snapshots (owner_id, snapshot_date, total_value_usd, change_24h_usd)
  values (p_owner_id, current_date, p_total_value_usd, p_change_24h_usd)
  on conflict (owner_id, snapshot_date) do update
  set total_value_usd = excluded.total_value_usd, change_24h_usd = excluded.change_24h_usd;
$$;

create or replace function public.purge_expired_portfolio_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.wallet_sync_runs where started_at < timezone('utc', now()) - interval '30 days';
  delete from public.alert_deliveries where created_at < timezone('utc', now()) - interval '90 days';
  delete from public.portfolio_snapshots where snapshot_date < current_date - interval '365 days';
end;
$$;

alter table public.user_settings enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_assets enable row level security;
alter table public.portfolio_transactions enable row level security;
alter table public.price_alerts enable row level security;
alter table public.alert_deliveries enable row level security;
alter table public.wallet_sync_runs enable row level security;
alter table public.portfolio_snapshots enable row level security;

create policy "owner access" on public.user_settings for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner access" on public.wallets for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner access" on public.wallet_assets for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner access" on public.portfolio_transactions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner access" on public.price_alerts for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner access" on public.alert_deliveries for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner access" on public.wallet_sync_runs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner access" on public.portfolio_snapshots for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create trigger user_settings_updated_at before update on public.user_settings for each row execute function public.set_updated_at();
create trigger wallets_updated_at before update on public.wallets for each row execute function public.set_updated_at();
create trigger wallet_assets_updated_at before update on public.wallet_assets for each row execute function public.set_updated_at();
create trigger portfolio_transactions_updated_at before update on public.portfolio_transactions for each row execute function public.set_updated_at();
create trigger price_alerts_updated_at before update on public.price_alerts for each row execute function public.set_updated_at();
