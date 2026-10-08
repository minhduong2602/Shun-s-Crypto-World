# Shadcn dashboard and production deployment design

## Goal

Replace the current custom, visually inconsistent dashboard with a compact
dark shadcn/ui interface. Ship it on Vercel against the existing Supabase
project, with Supabase as the only production state store and authentication
authority.

## Product requirements

- The app remains a personal, watch-only crypto portfolio tracker.
- The visual language uses shadcn/ui New York primitives and a restrained
  neutral dark palette. Emerald is the only semantic accent; red and amber
  remain status colors only.
- The page must work at desktop and mobile widths without overlapping controls
  or horizontal content clipping.
- No client bundle may contain service-role, Telegram, provider, or cron keys.
- Existing Supabase schema and migrations are the source of truth. The current
  project has already had migrations applied.

## UI architecture

### Application shell

`AppShell` owns global navigation and responsive layout:

- Desktop: a fixed-width left Sidebar with brand, five navigation items, and a
  compact connection/status section.
- Mobile: the same navigation appears in a shadcn Sheet, opened from the header.
- Header: page title, refresh action, account/menu control. It does not repeat
  navigation or market metrics.
- Main content uses a max-width container, a 24px desktop / 16px mobile gap,
  and stable Card boundaries.

### Pages and composed components

- Portfolio: summary cards, allocation card and a shadcn Table for holdings.
- Market: searchable Table with compact numeric columns and status Badges.
- Chart: a single lightweight-charts renderer fed by the truthful OHLCV API;
  unavailable market data renders an Alert rather than synthetic candles.
- Wallets: Card list plus Dialog for wallet details. Add/edit actions use
  Dialog + Input + Label and show a clear empty state.
- Alerts, transactions and authentication use Dialog/Form primitives rather
  than bespoke modal chrome.
- Loading is represented by Skeleton components matching final layout.

## Data and authentication architecture

- Supabase Auth is the only application session. A magic-link email flow and
  `/auth/callback` exchange the authorization code into the server session.
- Route handlers call `requireUser()` and access PostgreSQL through the
  server Supabase client. The legacy in-memory store is removed from production
  paths.
- Each UI data request handles 401 with an authenticated empty/login state,
  instead of silently showing demo data.
- Wallet scans are performed server-side with GoldRush, preserving raw balance
  precision in `wallet_assets`; a full scan marks old rows inactive and upserts
  current fungible assets.
- Portfolio holdings, transactions, alerts, settings and summary queries use
  RLS-scoped tables/repositories. UI types are mapped at the repository edge.

## Scheduling and notifications

- Supabase Edge Function `check-price-alerts` remains the Telegram delivery
  worker. It is scheduled by Supabase Scheduler with `CRON_SHARED_SECRET`.
- Alert delivery rows use a unique `(alert_id, bucket_key)` claim to make
  overlap and retries idempotent.
- Vercel Cron is optional and limited to a server route that starts wallet/price
  refreshes. It never sends Telegram directly or holds Supabase service-role
  credentials in the browser.

## Vercel deployment

- `vercel.json` defines the optional refresh schedule.
- Vercel environment variables: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `GOLDRUSH_API_KEY`, `TELEGRAM_BOT_TOKEN`, `CRON_SHARED_SECRET`,
  `GEMINI_API_KEY`, and `APP_URL`.
- `APP_URL` points at the Vercel production URL. The same URL is added to
  Supabase Auth URL Configuration, along with the callback path.
- `.env.example` remains placeholders only. Local production-like testing uses
  ignored `.env.local`.
- Deployment is performed only after a production build succeeds and the
  signed-in Vercel account is confirmed. The deployment URL is reported.

## Failure behavior

- Missing provider data: show a concise unavailable state; do not create
  fallback price or chart data.
- Missing Supabase configuration: fail server-side with an actionable error;
  never substitute demo storage.
- Unauthorized API calls: return 401.
- External provider failure during wallet sync: retain the last successful
  asset records and record a failed `wallet_sync_run`.

## Verification

- Unit tests cover repository mappers, auth helpers, wallet sync behaviour and
  chart response truthfulness.
- `npm run test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` must
  pass before deployment.
- Visual QA is performed at mobile and desktop widths: no clipped header,
  table overflow remains horizontally scrollable inside its container, and
  Sidebar/Sheet states are keyboard accessible.
