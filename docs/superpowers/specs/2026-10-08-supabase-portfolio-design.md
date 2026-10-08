# Supabase portfolio tracker design

## Purpose

Replace the in-memory data store in Shun's Crypto World with a durable, user-scoped Supabase backend. The application must track view-only wallets across supported chains, discover non-zero token balances without relying on a fixed token list, show truthful market data, and deliver Telegram price alerts while the browser is closed.

The design optimizes for a personal portfolio tracker that remains small and inexpensive to operate. It deliberately avoids persisting high-frequency market data.

## Goals

- Persist user data across restarts and deployments.
- Use Supabase Auth and Row Level Security (RLS) instead of the custom in-memory session and password scheme.
- Persist the latest wallet-asset state after each successful sync.
- Discover every non-zero supported fungible token returned by a chain-specific indexer, rather than scanning a curated contract list.
- Keep market price, holdings, and portfolio summary internally consistent by deriving them from one price snapshot.
- Never fabricate token balances, prices, or chart candles. Show an explicit unavailable or stale state instead.
- Evaluate configured portfolio alerts on a server-side schedule and send deduplicated Telegram notifications.
- Keep the database below the Supabase Free tier storage ceiling under normal personal use by retaining only operational data, daily snapshots, and bounded logs.

## Non-goals

- Custody, wallet connection, signing, or private-key handling.
- Storing full tick, order-book, or OHLCV history in Supabase.
- Guaranteeing 24/7 service availability on Supabase Free, which may pause inactive projects.
- Supporting NFT valuation in the first migration. Indexer responses may include NFTs but the first implementation will ignore them explicitly.

## Architecture

```text
Browser (Next.js + shadcn/ui)
    |
    +-- Next.js API routes -- Supabase Auth + PostgREST (RLS)
    |                              |
    |                              +-- wallets / wallet_assets / transactions
    |                              +-- alerts / deliveries / snapshots / sync runs
    |
    +-- Market provider + WebSocket (display data only, short cache)

Supabase Cron (every 5 minutes)
    -> alert Edge Function
    -> batched market-price lookup
    -> price condition evaluation + deduplication
    -> Telegram Bot API

Manual and scheduled wallet sync
    -> EVM / Solana / Bitcoin provider adapters
    -> normalize balances and token identity
    -> upsert latest wallet_assets in Supabase
```

## Data model

All application tables have an `owner_id uuid not null references auth.users(id)` column. RLS permits a user to select and mutate only rows whose `owner_id = auth.uid()`. The service-role client is permitted only in server-side API routes and Edge Functions; it must never be bundled into the browser.

### `user_settings`

One row per user. Stores base currency, Telegram chat ID, whether notifications are enabled, and display preferences. The Telegram bot token is not stored in this table; it is a server secret.

### `wallets`

Stores the watched public address, normalized chain key, label, active state, native asset summary, USD total, and timestamps for creation and the last successful sync. A unique constraint on `(owner_id, chain, address_normalized)` prevents duplicates.

### `wallet_assets`

Stores the latest detected fungible asset for a wallet. Its identity is `(wallet_id, chain, asset_address_normalized)`, where a reserved deterministic value represents a chain native asset. It contains the token name, symbol, decimals, raw balance as text, display balance as numeric, contract/mint, price, 24-hour change, USD value, price timestamp, and asset-sync timestamp.

This table has only the current state. Syncing uses upserts, then marks or removes assets absent from a completed authoritative scan. It does not append a row on every price change.

### `portfolio_transactions`

Stores user-entered buy, sell, transfer, fee, and note data. A transaction may reference a wallet but remains valid if that watched wallet is later removed.

### `price_alerts`

Stores an asset identity and condition (`ABOVE`, `BELOW`, `PCT_UP_24H`, or `PCT_DOWN_24H`), target, enabled state, recurring option, cooldown minutes, last-triggered timestamp, and creation/update timestamps. Price alerts target a specific chain and contract/mint when possible, not a symbol alone.

### `alert_deliveries`

An immutable audit row for each attempted notification: alert ID, wallet asset identity, observed price/change, delivery status, provider response summary, and timestamp. A unique time-bucket key prevents duplicate sends during cooldown.

### `wallet_sync_runs`

Records sync start, end, status, discovered-asset count, error code/message, and provider metadata. Retain for 30 days only.

### `portfolio_snapshots`

Stores one aggregate portfolio value per user per UTC date, with total value and 24-hour change. The unique `(owner_id, snapshot_date)` constraint enables daily upsert. Retain 365 days.

## Data flow

### Wallet sync

1. Validate a public address locally and reject strings resembling private keys.
2. Choose the correct provider adapter by chain.
3. Query all non-zero fungible balances for the wallet. EVM uses a token-indexer adapter; Solana uses an owner-assets adapter; Bitcoin reads native balance only.
4. Resolve token metadata and prices in batches using chain + contract/mint whenever available.
5. Normalize asset identity, raw balances, decimal display values, price timestamps, and USD values.
6. In one transaction, upsert `wallet_assets`, update the wallet summary, and mark the sync run successful. If a source is unavailable, keep the prior known asset state and record a failed or partial sync; do not substitute sample balances.

### Market and chart data

Market data remains ephemeral. The server price service has a short cache and returns an explicit source plus timestamp. The client may use a provider WebSocket for the selected chart pair. Candles must come from an actual listed market. When a pair is unavailable, the UI shows an unavailable state, never generated candles.

The selected provider's contract/mint lookup is the first price path. A symbol-based exchange lookup is used only when an unambiguous listed pair is known.

### Portfolio reads

Dashboard API routes fetch current wallet assets and manual transactions for the authenticated user. The API derives totals from the stored latest asset state. A read may refresh prices through the shared price service, but it does not write a price row for each request.

### Scheduled Telegram alerts

1. Supabase Cron invokes one server-side Edge Function every five minutes.
2. The function reads enabled alerts and their referenced current portfolio assets in batches.
3. It obtains batch prices, evaluates conditions, and atomically claims a delivery slot using the alert cooldown bucket.
4. For each claimed slot, it sends a Telegram message using `TELEGRAM_BOT_TOKEN` from Edge Function secrets.
5. It writes an `alert_deliveries` row, updates `last_triggered_at`, and disables non-recurring alerts after a successful notification.
6. Provider failures are logged as failed runs and do not cause an alert to fire from stale data.

The default schedule is five minutes and the default recurring-alert cooldown is 30 minutes. These values will be configurable later without schema changes.

## Retention and capacity

- No price ticks, candles, raw RPC responses, or WebSocket messages are stored.
- `wallet_assets` has one current row per wallet asset.
- Sync runs expire after 30 days.
- Alert deliveries expire after 90 days.
- Daily portfolio snapshots expire after 365 days.

At personal-portfolio scale, this data model remains far below 500 MB. Supabase Free is suitable for development and low-volume personal use, but a paused free project cannot run scheduled alerts until resumed. Production 24/7 notifications require a non-pausing plan and a market data provider whose rate limits support the configured schedule.

## Security

- Use Supabase Auth for password login and optional MFA.
- Enable RLS on every public application table; migrations include owner-isolation policies and supporting owner indexes.
- Use the public anon key only in the browser.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, indexer keys, market-provider keys, `TELEGRAM_BOT_TOKEN`, and cron secrets server-only.
- Verify the Cron/Edge Function secret before accepting scheduled invocations.
- Preserve the watch-only model: never collect private keys or transaction signatures.

## Environment configuration

The repository's `.env.example` will include these placeholders:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

EVM_INDEXER_API_KEY=
SOLANA_INDEXER_API_KEY=
MARKET_DATA_API_KEY=

TELEGRAM_BOT_TOKEN=
CRON_SHARED_SECRET=
```

Provider-specific names may be added once the final EVM, Solana, and market-data vendors are configured. The app must fail closed with a clear configuration error when a required key is absent.

## UI redesign

The interface will use shadcn/ui components and a restrained neutral/slate palette.

- A responsive sidebar or mobile sheet supplies navigation.
- Card surfaces separate the portfolio summary, wallet status, holdings, chart, and alerts.
- Tables provide dense but readable holdings and transaction data with loading, empty, stale, and error states.
- Dialogs and sheets replace custom modals for adding wallets, transactions, and alert rules.
- Badges identify live, stale, syncing, partial, and failed data states without excessive decorative color.
- The chart presents one coherent source selection and an explicit unavailable state rather than competing chart engines.

## Migration and implementation sequencing

1. Add Supabase client/server helpers, Auth integration, and environment validation.
2. Apply the initial migration with tables, indexes, RLS, triggers, and retention functions.
3. Replace the in-memory store with repository modules backed by Supabase.
4. Replace curated token scanning and demo-address substitutions with provider adapters.
5. Replace synthetic chart fallback and mismatched price paths with the unified price service.
6. Add the alert Edge Function, Cron migration/configuration, Telegram delivery log, and idempotency tests.
7. Rebuild the interface with shadcn/ui while preserving and improving existing portfolio, wallet, market, chart, alert, and AI flows.
8. Add integration and visual verification, then document setup and deployment.

## Acceptance criteria

- Data remains after a Next.js restart and is isolated by authenticated user.
- Adding and syncing a supported wallet discovers all provider-reported non-zero fungible assets without fixed-token allowlists or fabricated sample values.
- Dashboard total equals the sum of current wallet asset USD values plus the existing manual-transaction policy defined during implementation.
- Chart endpoint returns only provider data; unavailable pairs are visibly unavailable.
- A configured alert fires once per threshold crossing/cooldown and sends no duplicate Telegram messages from concurrent Cron executions.
- The browser contains no service-role key, Telegram token, or provider secret.
- The revised UI is keyboard-accessible, responsive, and uses shadcn/ui primitives consistently.
