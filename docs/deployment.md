# Production deployment

## Vercel

Import this Git repository as a Next.js project. Add these Production and
Preview environment variables in Vercel; do not commit their values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `COINGECKO_DEMO_API_KEY`
- `COINGECKO_DEMO_API_KEY_2` and `COINGECKO_DEMO_API_KEY_3` (optional round-robin keys for ticker and wallet-token pricing)
- `TELEGRAM_BOT_TOKEN`
- `CRON_SHARED_SECRET`
- `GEMINI_API_KEY`
- `APP_URL` (the final Vercel production URL)

Build command: `npm run build`.

## Supabase Auth

Enable Email and Password sign-in in Authentication → Providers. Disable public
sign-ups; create users from Authentication → Users and set their initial
passwords there. The app signs in with `signInWithPassword`, so login does not
depend on outbound email or a magic-link callback. Keep the project URL and
publishable/anon key in the Vercel Production environment before building.
Portfolio, transaction, wallet, alert, and Telegram destination records are
owned by the Supabase Auth user and protected by RLS.

Apply every SQL file in `supabase/migrations` to the same project. In
particular, `202610090003_market_watchlist.sql` adds the per-user market
favorites table; without it the Market watchlist API will return a database
error.

`202610090008_prevent_negative_transaction_balances.sql` serializes ledger
writes per user and rejects transaction inserts, edits, or deletes that would
make an asset's chronological balance negative. Apply it before relying on the
database-level concurrency guard; the app keeps a pre-check for faster feedback.

`202610090006_portfolio_snapshot_cron.sql` records daily history for the same
transaction-derived valuation shown in the portfolio summary. It skips users
whose open positions do not all have valid live prices, so partial quotes do
not become misleading history points. Wallet balances remain in the separate
watch-only wallet panel. The migration schedules the guarded endpoint at
00:07 UTC; apply it before expecting the history chart to populate.

`202610090010_nullable_snapshot_change.sql` allows a snapshot to preserve its
valid total valuation when 24-hour market-change data is unavailable. That
change is stored as `NULL`, not as a fabricated zero; apply the migration after
the initial portfolio schema.

`202610090009_portfolio_data_retention_cron.sql` schedules database cleanup at
02:23 UTC. It retains wallet sync runs for 30 days, alert delivery attempts for
90 days, and portfolio snapshots for 365 days. It does not delete wallets,
transactions, user settings, or current wallet assets. Confirm
`portfolio-data-retention` exists in Supabase Database → Cron after applying
the migration.

`202610090004_wallet_auto_sync_cron.sql` installs a Supabase Cron job that
queues wallet sync every 15 minutes. It processes up to five wallets per run,
uses a database lease to prevent overlapping batches, and backs off failed
wallets for one hour. To activate it after applying the migration:

1. Set a long random `CRON_SHARED_SECRET` in Vercel Production and redeploy.
2. In the Supabase SQL Editor, store the production endpoint and the exact same
   secret in Vault (replace both placeholders; do not commit the secret):

   ```sql
   select vault.create_secret(
     'https://YOUR-VERCEL-DOMAIN/api/cron/sync-wallets',
     'wallet_sync_endpoint',
     'Production wallet sync endpoint'
   );
   select vault.create_secret(
     'PASTE_THE_SAME_CRON_SHARED_SECRET_HERE',
     'wallet_sync_cron_secret',
     'Bearer secret for the wallet sync cron'
   );
   ```

3. Confirm the `portfolio-wallet-auto-sync` job exists in Supabase Database →
   Cron. Check invocation requests in `net._http_response`; the endpoint
   returns batch counts, while per-wallet outcomes are recorded in
   `wallet_sync_runs`.

The scheduler is owned by Supabase rather than Vercel, so it can run every 15
minutes on the Vercel Hobby plan. Each run scans only a small number of wallets
to limit public-indexer load; this is periodic tracking, not instantaneous
on-chain streaming.

Wallet scanning uses public indexers for Ethereum, Polygon, Arbitrum, Solana,
Base, and Bitcoin native balance. Blockscout ERC-20 holdings are read through
its cursor-paginated address-token endpoint; Routescan's keyless cursor-paginated
holdings endpoint is used for BNB Smart Chain and Base. The scanner fails the
sync explicitly if an indexer returns an invalid/repeating cursor or exceeds
its safety page limit, so a truncated response is not saved as a complete wallet.
Native EVM balances use public RPCs. Apply `202610090007_add_base_chain.sql`
before selecting Base wallets in the UI.
Bitcoin addresses are scanned for BTC only; SPL tokens are
discovered by mint and shown with shortened mint metadata when no trustworthy
token metadata is available. Wallet token prices are looked up by contract or
mint address through CoinGecko's Demo token-price endpoint, with configured
keys rotated server-side; assets not listed by CoinGecko or missing valid
market data remain visible as unpriced instead of being assigned an estimated
price.

Chart candles prefer exchange OHLCV (MEXC/Binance, then OKX). If all exchange
sources fail, known CoinGecko IDs use the Demo OHLC endpoint and rotate the same
configured keys. The UI labels the fallback's actual granularity (`30m`, `4h`,
or `4d`) because it does not match every selected chart interval; fallback
candles do not invent volume data.

VND display conversion uses CoinGecko's Bitcoin USD/VND quote ratio, fetched
server-side with the same Demo keys and cached for five minutes. If the quote
cannot be validated, VND amounts show as unavailable rather than using a
hard-coded exchange rate.

## Telegram scheduler

`supabase/config.toml` disables gateway JWT verification only for
`check-price-alerts`; the function validates `CRON_SHARED_SECRET` itself.
Deploy the function from the project root:

```
supabase functions deploy check-price-alerts
```

Set `TELEGRAM_BOT_TOKEN`, `CRON_SHARED_SECRET`, and the same
`COINGECKO_DEMO_API_KEY` / optional `_2` / `_3` values as Edge Function secrets.
Then store the endpoint and same cron secret in Supabase Vault (replace the
project ref and secret; do not commit the secret):

```sql
select vault.create_secret(
  'https://YOUR-PROJECT-REF.supabase.co/functions/v1/check-price-alerts',
  'telegram_alerts_endpoint',
  'Telegram price-alert function endpoint'
);
select vault.create_secret(
  'PASTE_THE_SAME_CRON_SHARED_SECRET_HERE',
  'telegram_alerts_cron_secret',
  'Bearer secret for Telegram alert cron'
);
```

Migration `202610090004_wallet_auto_sync_cron.sql` schedules wallet refresh
every 15 minutes and Telegram price-alert evaluation every 5 minutes. Confirm
both `portfolio-wallet-auto-sync` and `portfolio-telegram-alerts` in Supabase
Database → Cron. Every alert run requests a fresh CoinGecko quote: contract
alerts use the selected wallet asset's chain and contract address, while manual
ticker alerts use CoinGecko's Demo `/coins/markets` endpoint. Configured keys are
rotated server-side. Stored wallet prices are never substituted for a failed
live request; percentage alerts are skipped if the quote lacks valid 24-hour
change data. Configure the same bot token
as a server-only Vercel environment variable so users can send a connection
test; each user stores only their own Telegram Chat ID in `user_settings`.
Supabase owns scheduled delivery and idempotent alert claims.

Apply `202610090005_alert_delivery_retry.sql` to enable atomic delivery claims.
Failed Telegram requests can retry within the same alert cooldown bucket; a
pending claim abandoned for over 10 minutes can also be reclaimed safely.

## Daily portfolio history

After deploying the app and applying `202610090006_portfolio_snapshot_cron.sql`,
store the Vercel endpoint and the same `CRON_SHARED_SECRET` in Supabase Vault:

```sql
select vault.create_secret(
  'https://YOUR-VERCEL-DOMAIN/api/cron/portfolio-snapshots',
  'portfolio_snapshots_endpoint',
  'Daily portfolio snapshot endpoint'
);
select vault.create_secret(
  'PASTE_THE_SAME_CRON_SHARED_SECRET_HERE',
  'portfolio_snapshots_cron_secret',
  'Bearer secret for portfolio snapshot cron'
);
```

Confirm `portfolio-daily-snapshot` exists in Supabase Database → Cron and check
the invocation result in `net._http_response`. The dashboard provides 7-, 30-,
90-day and 1-year views; historical data starts accumulating after activation.
