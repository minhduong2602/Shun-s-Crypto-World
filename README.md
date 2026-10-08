# Shun's Crypto World

A personal crypto portfolio tracker built with Next.js, shadcn/ui and Supabase.
It combines manual transactions with read-only wallet tracking; it never asks
for a seed phrase, private key, or transaction signature.

## What it does

- Tracks manual buys, sells and transfers, with transaction history, CSV import,
  cost basis, realized/unrealized P&L and portfolio history.
- Scans public wallet balances on Ethereum, BNB Smart Chain, Polygon, Arbitrum,
  Base, Solana and Bitcoin. Solana SPL and EVM fungible token discovery is
  provider/indexer based; NFTs and Bitcoin ordinals are outside the current
  scope.
- Shows market watchlists, live chart feeds where a real exchange pair exists,
  and explicit unavailable states instead of simulated prices or candles.
- Sends scheduled Telegram alerts for configured price/24-hour percentage
  conditions. Telegram delivery and wallet refresh continue server-side while
  the browser is closed, subject to Supabase availability and provider limits.
- Uses Supabase Auth and RLS for durable, user-scoped data. New users are
  provisioned in Supabase; the app does not expose sign-up.

## Local development

1. Install Node.js and run `npm ci`.
2. Copy `.env.example` to `.env.local` and fill the values for your Supabase
   project. Keep server-only keys out of `NEXT_PUBLIC_*` variables.
3. Apply the SQL migrations under `supabase/migrations` to the intended
   Supabase project and create the login user in Supabase Auth.
4. Run `npm run dev` and open `http://localhost:3000`.

For a first-time setup, already-applied migrations, Vercel configuration,
Telegram scheduling, operational checks and backups, follow the
[Supabase/Vercel runbook](docs/runbooks/supabase-setup.md) and
[deployment notes](docs/deployment.md).

## Verification

```powershell
npm test -- --run
npm run lint
npx tsc --noEmit
npm run build
```

## Free-tier expectations

The application intentionally avoids persisting market ticks and OHLCV data.
Supabase Free projects may pause after low database activity, and periodic
wallet/Telegram jobs cannot run while the project is paused. Keep independent
database exports and do not treat a free hosted database as an always-on
notification guarantee. See the runbook for the current backup and recovery
procedure.
