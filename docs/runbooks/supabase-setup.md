# Supabase and Vercel operations runbook

This runbook describes the configuration actually used by this repository:
Supabase Auth/Postgres, Vercel-hosted Next.js, CoinGecko Demo keys for token
pricing, and Supabase Cron for recurring wallet sync, Telegram alerts and
portfolio snapshots. Use `.env.example` as the canonical variable-name list;
do not replace existing project values with examples or commit secrets.

## 1. Provision the Supabase project

1. Create or select the Supabase project and save its project reference and
   database password in a password manager.
2. In **Authentication → Providers**, enable Email/Password and disable public
   sign-ups. Create each allowed account in **Authentication → Users**. The
   app only signs in existing Supabase users; there is no registration form.
3. Configure the production Site URL and allowed redirect URLs for the Vercel
   domain. Login uses password auth, not magic-link email delivery.
4. Run migrations `202610090001` through `202610090011` in order. They create
   the user-owned portfolio schema, RLS, wallet sync, alert delivery claims,
   snapshots, retention and cron functions. Migration `202610090011` also
   repairs the watchlist table, RLS policy and authenticated-role grants if
   SQL was previously applied manually. Verify the schema and scheduled jobs
   before enabling production use.

### If SQL was already run manually

Do not blindly run the migrations a second time. Link the project and compare
the database's migration history first:

```powershell
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase migration list
```

If a migration's schema changes are confirmed to exist but the migration
history row is missing, mark only that specific version as applied, then
preview the remaining changes:

```powershell
npx supabase migration repair --status applied <MIGRATION_VERSION>
npx supabase db push --dry-run
```

`migration repair` changes migration history only; it does not run or validate
the SQL. Confirm each migration's effects before repairing history. If the
preview lists changes you did not intend, stop and reconcile the schema before
running `npx supabase db push`. See the
[Supabase migration workflow](https://supabase.com/docs/guides/deployment/database-migrations).

## 2. Configure Vercel

Import the repository as a Next.js project and set the variables listed in
`.env.example` in Vercel's Production environment. At minimum, the live app
needs the Supabase URL, anon/publishable key and service-role key. Add CoinGecko
Demo keys for contract-token and VND pricing; optional keys 2 and 3 are rotated
server-side. Telegram requires `TELEGRAM_BOT_TOKEN` and a long random
`CRON_SHARED_SECRET`. `GEMINI_API_KEY` enables portfolio analysis. Set `APP_URL`
to the final production origin.

Never place service-role, CoinGecko, Telegram or cron secrets in a variable
whose name starts with `NEXT_PUBLIC_`. After changing environment variables,
redeploy so the production build receives the correct values.

The app's high-frequency schedules are in Supabase Cron, not `vercel.json`:
wallet sync every 15 minutes, alert checks every 5 minutes, daily snapshots,
and daily retention. This keeps the recurring schedule compatible with
Vercel Hobby's once-per-day Cron limit. Supabase Free can pause projects after
low database activity; scheduled jobs do not provide an always-on guarantee
while paused. See [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
and [Vercel Cron plan limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## 3. Configure Supabase Cron and Vault

Migrations `202610090004`, `202610090006` and `202610090009` create the
wallet-sync, Telegram-alert, daily-snapshot and retention jobs. Confirm these
job names in **Database → Cron** after applying the migrations:

- `portfolio-wallet-auto-sync`
- `portfolio-telegram-alerts`
- `portfolio-daily-snapshot`
- `portfolio-data-retention`

Store the production URL and the same `CRON_SHARED_SECRET` used by Vercel in
Vault. Use the exact secret names and endpoint paths in
[deployment.md](../deployment.md); never paste real secrets into this repo,
support chat, or SQL history. The Telegram Edge Function also needs the
Supabase URL/service-role key, bot token, cron secret, and CoinGecko key(s) as
Edge Function secrets. Deploy it from the project root with:

```powershell
npx supabase functions deploy check-price-alerts
```

The function validates its own bearer secret. `supabase/config.toml` disables
gateway JWT verification only for this function so Supabase's JWT gateway does
not reject the dedicated cron bearer token first.

## 4. Connect Telegram and create an alert

1. Create a bot with Telegram's official BotFather and set its token as the
   server-only `TELEGRAM_BOT_TOKEN` in Vercel and Supabase Edge Function
   secrets. Do not store the bot token in `user_settings`.
2. In Vercel, set `APP_URL` to the public HTTPS app origin and set
   `TELEGRAM_WEBHOOK_SECRET` to a random 1–256 character value containing only
   letters, numbers, `_`, or `-`. Keep both server-only and redeploy.
3. In the app, open **Cảnh báo Telegram** and choose **Liên kết với Telegram**.
   The app verifies the bot and registers its webhook automatically. Open the
   generated link, tap **Start**, return to the app and confirm the pairing.
   Pairing codes expire after 15 minutes, can be used once, and are stored as
   SHA-256 hashes. The webhook accepts private chats only.
4. Send a test message, then create a one-time or recurring alert for a ticker
   or wallet asset. Wallet asset alerts use chain + contract/mint identity;
   manual ticker alerts use the ticker lookup. Conditions include above/below
   price and 24-hour percentage movement.
5. Confirm `portfolio-telegram-alerts` is enabled in Supabase Cron, then check
   the app's alert delivery history for `sent`, `failed`, or `skipped` results.

Delivery is evaluated every five minutes, not on every market tick. Cooldown
buckets and atomic database claims prevent concurrent cron invocations from
sending duplicates. Failed provider quotes are skipped rather than replaced
with stale wallet prices.

## 5. Check wallet sync and market data

- Add only a public wallet address in the **Ví theo dõi** page. This is
  watch-only; never enter a seed phrase or private key.
- Manual sync returns the latest scan outcome. Scheduled sync selects up to
  five wallets every 15 minutes and cools down wallets that failed recently.
- Inspect the wallet's last sync status and `wallet_sync_runs` for the
  provider error. A failed scan preserves the last successful asset state.
- EVM/Solana fungible tokens come from paginated public indexers/RPCs. Token
  prices are looked up by contract/mint using CoinGecko Demo keys; unpriced
  assets remain visible without fabricated valuations.
- Bitcoin currently reports BTC native balance only. NFTs and Bitcoin
  ordinals are not valued by this release.
- Charts use real exchange candles where a supported pair exists, with
  CoinGecko fallback only for supported assets. An unavailable pair should
  show an unavailable state, not synthetic candles.

Useful checks in the Supabase SQL Editor:

```sql
select jobname, schedule, active
from cron.job
where jobname in (
  'portfolio-wallet-auto-sync',
  'portfolio-telegram-alerts',
  'portfolio-daily-snapshot',
  'portfolio-data-retention'
)
order by jobname;

select status, count(*)
from public.wallet_sync_runs
where started_at > now() - interval '24 hours'
group by status;

select status, count(*)
from public.alert_deliveries
where created_at > now() - interval '24 hours'
group by status;
```

For the `pg_net` request/response log, use `net._http_response` soon after an
invocation; Supabase documents that response rows are retained for only a
limited period. The durable outcomes for wallet sync and Telegram delivery
are in `wallet_sync_runs` and `alert_deliveries` respectively.

## 6. Back up and recover

Supabase Free does not include the same managed daily-backup retention as paid
plans. Supabase recommends regular logical exports and off-site copies for
Free projects. Keep exports encrypted and outside the repository; these files
contain user portfolio and Telegram destination data.

Install the Supabase CLI and `pg_dump` prerequisites, link the project, then
export roles, schema and data to a private backup directory. Supply the
database connection URL through a secure environment variable for the current
PowerShell session; do not put the password directly in a committed script or
`.env.example`.

```powershell
$backupDir = Join-Path $env:TEMP "shun-crypto-backup-$(Get-Date -Format yyyyMMdd-HHmmss)"
New-Item -ItemType Directory -Path $backupDir | Out-Null

npx supabase db dump --db-url $env:SUPABASE_DB_URL --file (Join-Path $backupDir 'roles.sql') --role-only
npx supabase db dump --db-url $env:SUPABASE_DB_URL --file (Join-Path $backupDir 'schema.sql')
npx supabase db dump --db-url $env:SUPABASE_DB_URL --file (Join-Path $backupDir 'data.sql') --data-only --use-copy
```

Copy the backup directory to encrypted off-site storage, verify the three
files are non-empty, and periodically rehearse restoration into a separate
test project. Do not restore over production as a test. Database dumps do not
include objects stored in Supabase Storage; this app currently does not rely
on Storage for portfolio records.

To restore, create a new Supabase project, enable the same required
extensions, and restore roles/schema/data using Supabase's documented CLI/psql
workflow. Then configure Auth users, Vercel environment variables, Edge
Function secrets and Vault secrets again. Validate RLS policies and cron jobs
before directing the production domain to the restored project. See
[Supabase backup and restore](https://supabase.com/docs/guides/platform/backups)
and [restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

Free projects may be paused after a low-activity period; Supabase currently
documents a one-year restore window for paused Free projects. Keep independent
exports rather than relying on that restore window as your backup plan.

## 7. Retention and data footprint

The scheduled retention function removes only operational history:

- Wallet sync runs older than 30 days.
- Alert delivery attempts older than 90 days.
- Portfolio snapshots older than 365 days.

It does not delete wallets, current wallet assets, transactions, settings or
alerts. Market ticks and chart candles are not persisted in the database.

## 8. Release checks

Before pushing a release branch or relying on a deployment, run:

```powershell
npm ci
npm test -- --run
npm run lint
npx tsc --noEmit
npm run build
```

After deployment, verify password login for a Supabase-created user, portfolio
reads/writes, wallet sync, market data availability, Telegram test delivery,
alert history and the four Supabase cron jobs. Never claim scheduled
notifications are active based on a successful Vercel build alone.
