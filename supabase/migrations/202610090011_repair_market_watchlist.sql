-- Repair the watchlist schema/grants when earlier SQL was applied manually.
-- Safe to apply when the table already exists; existing rows are preserved.
create table if not exists public.market_watchlist (
  owner_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (symbol = upper(symbol) and length(symbol) between 2 and 20),
  created_at timestamptz not null default now(),
  primary key (owner_id, symbol)
);

create index if not exists market_watchlist_owner_created_idx
  on public.market_watchlist (owner_id, created_at desc);

alter table public.market_watchlist enable row level security;
drop policy if exists "Users manage their own market watchlist" on public.market_watchlist;
create policy "Users manage their own market watchlist"
  on public.market_watchlist
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

revoke all on table public.market_watchlist from anon;
grant select, insert, update, delete on table public.market_watchlist to authenticated;
grant all on table public.market_watchlist to service_role;

notify pgrst, 'reload schema';
