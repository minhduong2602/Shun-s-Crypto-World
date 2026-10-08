-- Keep a valid portfolio valuation when the market provider cannot supply a
-- trustworthy 24-hour change. NULL means unavailable; zero remains a real value.
alter table public.portfolio_snapshots
  alter column change_24h_usd drop not null,
  alter column change_24h_usd drop default;
