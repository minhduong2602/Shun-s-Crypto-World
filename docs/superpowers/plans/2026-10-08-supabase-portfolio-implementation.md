# Supabase Portfolio Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ephemeral portfolio data and simulated market behavior with a secure, durable Supabase-backed portfolio tracker that discovers real wallet assets, reports truthful prices, and runs Telegram price alerts without an open browser.

**Architecture:** Supabase owns authenticated user data and the latest normalized asset state, while wallet indexers and market APIs remain external sources of truth. Next.js routes orchestrate authenticated reads and manual syncs; a Supabase Edge Function, scheduled by Cron, evaluates durable alert rules with idempotent delivery records. The client is rebuilt around shadcn/ui primitives and reads one consistent API model.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Supabase Auth/Postgres/RLS/Edge Functions/Cron, GoldRush wallet indexing, exchange/market API, Telegram Bot API, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-08-supabase-portfolio-design.md`

## Global Constraints

- Keep the app watch-only: never accept, store, or transmit private keys or transaction signatures.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, provider keys, `TELEGRAM_BOT_TOKEN`, and cron secrets off the browser bundle.
- Enable RLS on every public application table and scope every row to `auth.uid()`.
- Never persist market ticks, OHLCV candles, raw provider responses, or WebSocket messages.
- Never synthesize a balance, price, chart candle, or demo wallet result after a provider failure.
- Use `chain + contract/mint` asset identity where available; symbols are display-only.
- Run the scheduled alert evaluation every five minutes with a default 30-minute cooldown.
- Retain sync runs for 30 days, alert deliveries for 90 days, and daily snapshots for 365 days.
- Use a neutral/slate shadcn/ui visual system with accessible keyboard and focus behavior.

## Review Focus

- Missing, invalid, or browser-exposed Supabase/provider secrets must fail with a clear server-side configuration error; test in Task 1.
- Two distinct assets sharing `USDC` or another symbol must persist and price separately by chain plus contract/mint; test in Task 2.
- A partial provider outage must retain the last successful wallet state and mark the sync partial/failed rather than replacing it with zeros or samples; test in Task 4.
- An unlisted market pair must show an unavailable/stale chart status, never generated candles or a misleading live label; test in Task 5.
- Concurrent Cron invocations must claim only one Telegram delivery per alert cooldown bucket; test in Task 7.

---

## File structure

- `supabase/migrations/202610080001_initial_portfolio.sql` — schema, indexes, RLS, timestamp triggers, retention RPCs, and daily-snapshot upsert function.
- `supabase/functions/evaluate-alerts/index.ts` — authenticated scheduled alert worker.
- `supabase/functions/_shared/alert-domain.ts` — pure condition, cooldown, and Telegram-message logic shared by edge tests.
- `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts` — browser, cookie-aware server, and service-role clients.
- `lib/config/env.ts` — validated server/client configuration boundary.
- `lib/domain/*.ts` — stable application models, normalization, and portfolio calculations.
- `lib/providers/*.ts` — GoldRush wallet indexer and truthful market/chart provider adapters behind narrow interfaces.
- `lib/repositories/*.ts` — Supabase-only persistence boundaries for settings, wallets, transactions, alerts, and dashboard reads.
- `lib/services/*.ts` — wallet sync, price, portfolio, and alert orchestration.
- `app/api/**/route.ts` — authenticated Next.js APIs that call services rather than directly access providers or tables.
- `components/ui/*` — generated shadcn/ui primitives; `components/dashboard/*`, `components/wallets/*`, and `components/alerts/*` — composed feature UI.
- `tests/**/*.test.ts(x)` — unit, repository-contract, API-route, and component behavior coverage.

### Task 1: Establish Supabase, testing, configuration, and shadcn foundations

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Create: `components.json`
- Create: `lib/config/env.ts`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`
- Create: `components/ui/{button,card,input,label,dialog,sheet,tabs,table,badge,skeleton,dropdown-menu,select,sonner}.tsx`
- Create: `tests/setup.ts`
- Create: `tests/config/env.test.ts`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `getClientSupabase(): SupabaseClient`, `getServerSupabase(): Promise<SupabaseClient>`, `getAdminSupabase(): SupabaseClient`, and `getServerEnv(): ServerEnv`.
- Produces: a Vitest `test`, `test:watch`, and `test:coverage` script plus a jsdom Testing Library setup.

- [ ] **Step 1: Write the failing environment-boundary tests**

```ts
it('rejects a missing server-only secret', () => {
  expect(() => getServerEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' }))
    .toThrow('SUPABASE_SERVICE_ROLE_KEY')
})

it('does not expose service-role or Telegram secrets from the public config', () => {
  expect(getPublicEnv(fullEnv)).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY')
  expect(getPublicEnv(fullEnv)).not.toHaveProperty('TELEGRAM_BOT_TOKEN')
})
```

- [ ] **Step 2: Run the environment tests to verify they fail**

Run: `npm run test -- tests/config/env.test.ts`

Expected: FAIL because the configuration module and test runner do not exist.

- [ ] **Step 3: Install the Supabase, validation, test, and shadcn dependencies; add generated shadcn primitives**

Add `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `vitest`, `jsdom`, `@testing-library/react`, and `@testing-library/jest-dom`. Initialize shadcn using the project alias and Tailwind 4 configuration, then add only the primitives listed in Files. Keep wrappers in feature directories rather than editing generated primitives.

- [ ] **Step 4: Implement `getPublicEnv`, `getServerEnv`, and the three Supabase client factories**

Validate public URL/anon values independently from server secrets. The browser client can read only public values; cookie-aware server client owns the authenticated request context; `getAdminSupabase` is imported only from server routes/Edge Functions.

- [ ] **Step 5: Replace the global color tokens in `app/globals.css` with the neutral/slate shadcn token set**

Define light and dark CSS variables, preserve readable focus outlines, and remove hard-coded neon defaults from global styles without rewriting feature components yet.

- [ ] **Step 6: Run the foundation checks**

Run: `npm run test -- tests/config/env.test.ts && npm run lint && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit the foundation**

```bash
git add package.json package-lock.json bun.lock .env.example components.json app/globals.css lib/config lib/supabase components/ui tests
git commit -m "chore: add Supabase and shadcn foundations"
```

### Task 2: Create the durable user-scoped schema and data contracts

**Files:**
- Create: `supabase/migrations/202610080001_initial_portfolio.sql`
- Create: `lib/domain/portfolio.ts`
- Create: `lib/domain/asset-identity.ts`
- Create: `lib/supabase/database.types.ts`
- Create: `tests/domain/asset-identity.test.ts`
- Create: `tests/database/initial-portfolio-schema.test.ts`
- Modify: `lib/types.ts`

**Interfaces:**
- Produces: `AssetIdentity { chain: ChainType; assetAddress: string; isNative: boolean }`, `normalizeAssetIdentity(input): AssetIdentity`, and `assetIdentityKey(identity): string`.
- Produces: generated `Database` table types and `PortfolioAsset`, `WalletRecord`, `AlertRecord`, and `AlertDeliveryRecord` client models.
- Consumes: `getServerEnv` from Task 1.

- [ ] **Step 1: Write the failing domain and schema tests**

```ts
it('uses chain and normalized contract address to distinguish same-symbol assets', () => {
  expect(assetIdentityKey({ chain: 'ETH', assetAddress: '0xA0b8...', isNative: false }))
    .not.toBe(assetIdentityKey({ chain: 'SOL', assetAddress: 'EPjF...', isNative: false }))
})

it('declares RLS, owner policies, unique wallet identity, and asset identity constraints', () => {
  expect(migration).toContain('enable row level security')
  expect(migration).toContain('unique (owner_id, chain, address_normalized)')
  expect(migration).toContain('unique (wallet_id, chain, asset_address_normalized)')
})
```

- [ ] **Step 2: Run the schema tests to verify they fail**

Run: `npm run test -- tests/domain/asset-identity.test.ts tests/database/initial-portfolio-schema.test.ts`

Expected: FAIL because the migration and domain contracts do not exist.

- [ ] **Step 3: Implement the initial migration**

Create `user_settings`, `wallets`, `wallet_assets`, `portfolio_transactions`, `price_alerts`, `alert_deliveries`, `wallet_sync_runs`, and `portfolio_snapshots`. Add UUID primary keys, owner indexes, `updated_at` trigger, RLS policies, constraints from the spec, `record_daily_snapshot(owner_id, snapshot_date, total_usd, change_24h_usd)`, and retention functions for 30/90/365-day data. Store `raw_balance` as text and currency as `numeric`; use a deterministic native address sentinel.

- [ ] **Step 4: Define the TypeScript contracts and generate database types from the migration**

Remove the in-memory-specific fields such as `passwordHash`, `telegramBotToken`, and `sessionTokens`. Keep client DTOs separate from raw database rows so API components do not need database naming knowledge.

- [ ] **Step 5: Apply the migration to a local Supabase instance and rerun tests**

Run: `supabase db reset && npm run test -- tests/domain/asset-identity.test.ts tests/database/initial-portfolio-schema.test.ts`

Expected: PASS; the local database accepts isolated owner rows and rejects duplicate wallet/asset identities.

- [ ] **Step 6: Commit the schema contracts**

```bash
git add supabase/migrations lib/domain lib/supabase/database.types.ts lib/types.ts tests/domain tests/database
git commit -m "feat: add Supabase portfolio schema"
```

### Task 3: Replace custom session state with Supabase Auth and owner-aware route guards

**Files:**
- Create: `middleware.ts`
- Create: `app/login/page.tsx`
- Create: `app/auth/callback/route.ts`
- Create: `lib/auth/require-user.ts`
- Create: `tests/auth/require-user.test.ts`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Delete: `app/api/auth/login/route.ts`
- Delete: `app/api/auth/logout/route.ts`
- Delete: `app/api/auth/status/route.ts`
- Delete: `app/api/auth/setup-2fa/route.ts`
- Delete: `app/api/auth/verify-2fa/route.ts`
- Delete: `lib/crypto-totp.ts`

**Interfaces:**
- Produces: `requireUser(): Promise<{ id: string; email: string | null }>` that throws `UnauthorizedError` if Supabase has no authenticated user.
- Produces: `withApiUser(handler): RouteHandler` to map `UnauthorizedError` to a JSON 401 response.
- Consumes: cookie-aware Supabase client from Task 1.

- [ ] **Step 1: Write the failing auth boundary tests**

```ts
it('returns the authenticated Supabase user id', async () => {
  mockedGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@example.com' } }, error: null })
  await expect(requireUser()).resolves.toEqual({ id: 'u1', email: 'a@example.com' })
})

it('maps an absent user to UnauthorizedError', async () => {
  mockedGetUser.mockResolvedValue({ data: { user: null }, error: null })
  await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError)
})
```

- [ ] **Step 2: Run the auth tests to verify they fail**

Run: `npm run test -- tests/auth/require-user.test.ts`

Expected: FAIL because the guard does not exist.

- [ ] **Step 3: Implement Supabase email/password sign-in, callback exchange, middleware session refresh, and `requireUser`**

Protect dashboard routes and APIs by default, exempting login, callback, and public static assets. Redirect an unauthenticated browser request to `/login`; API routes return JSON 401. Remove the custom TOTP secret flow; account MFA will be managed through Supabase Auth configuration, not application tables.

- [ ] **Step 4: Remove custom auth routes and in-memory TOTP/session dependencies**

Update the app shell to show authenticated account state from Supabase rather than calling `/api/auth/status`.

- [ ] **Step 5: Run auth and type checks**

Run: `npm run test -- tests/auth/require-user.test.ts && npm run lint && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit Supabase Auth migration**

```bash
git add middleware.ts app/login app/auth app/layout.tsx app/page.tsx lib/auth app/api/auth lib/crypto-totp.ts tests/auth
git commit -m "feat: migrate authentication to Supabase"
```

### Task 4: Implement complete wallet indexing and atomic durable sync

**Files:**
- Create: `lib/providers/wallet-indexer.ts`
- Create: `lib/providers/goldrush-wallet-indexer.ts`
- Create: `lib/services/wallet-sync-service.ts`
- Create: `lib/repositories/wallet-repository.ts`
- Create: `tests/providers/goldrush-wallet-indexer.test.ts`
- Create: `tests/services/wallet-sync-service.test.ts`
- Modify: `app/api/wallets/route.ts`
- Modify: `app/api/wallets/[id]/route.ts`
- Modify: `app/api/wallets/[id]/sync/route.ts`
- Modify: `components/ViewOnlyWallets.tsx`
- Delete: `lib/onchain-wallet-service.ts`
- Delete: `lib/wallet-tokens-service.ts`

**Interfaces:**
- Produces: `WalletIndexer.scan(input: { chain: ChainType; address: string }): Promise<IndexedWalletAsset[]>`.
- Produces: `WalletSyncService.sync(ownerId: string, walletId: string): Promise<WalletSyncResult>`.
- Produces: `WalletRepository.upsertSyncResult(input: SyncPersistenceInput): Promise<WalletRecord>`.
- Consumes: `normalizeAssetIdentity` from Task 2 and `requireUser` from Task 3.

- [ ] **Step 1: Write the failing provider pagination and sync-safety tests**

```ts
it('follows every GoldRush cursor and excludes zero-balance and NFT assets', async () => {
  await expect(indexer.scan({ chain: 'ETH', address })).resolves.toHaveLength(101)
})

it('keeps the last successful assets and records a partial run when the provider fails', async () => {
  await expect(syncService.sync('u1', 'w1')).rejects.toThrow('WalletSyncPartialError')
  expect(walletRepository.replaceAssets).not.toHaveBeenCalled()
  expect(walletRepository.createSyncRun).toHaveBeenCalledWith(expect.objectContaining({ status: 'partial' }))
})
```

- [ ] **Step 2: Run provider and service tests to verify they fail**

Run: `npm run test -- tests/providers/goldrush-wallet-indexer.test.ts tests/services/wallet-sync-service.test.ts`

Expected: FAIL because the provider adapter and sync service do not exist.

- [ ] **Step 3: Implement `GoldRushWalletIndexer` with cursor pagination and normalization**

Use `GOLDRUSH_API_KEY` only server-side. Map ETH, BSC, POLYGON, ARBITRUM, SOL, and BTC to the provider chain identifiers. Fetch until there is no next-page cursor, retain only non-zero native/fungible assets, and use raw integer strings plus provider decimals without converting through unsafe JavaScript integers.

- [ ] **Step 4: Implement transactional sync persistence**

Create a sync-run row, upsert the current assets and wallet summary on complete scans, and atomically mark absent assets inactive. On any partial or failed provider response, preserve the prior wallet assets and write the run status/error only. Remove the custom-contract scanner and all hard-coded demo addresses/results.

- [ ] **Step 5: Update wallet APIs and the wallet feature UI**

Require the owner, return `syncStatus`, `assetCount`, `lastSyncedAt`, and stale/error information, and use shadcn `Dialog`, `Table`, `Badge`, `Button`, and `Skeleton`. Remove “sample wallet” autofill and reframe manual refresh as a real scan.

- [ ] **Step 6: Run wallet checks**

Run: `npm run test -- tests/providers/goldrush-wallet-indexer.test.ts tests/services/wallet-sync-service.test.ts && npm run lint && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit wallet indexing and sync**

```bash
git add app/api/wallets components/ViewOnlyWallets.tsx lib/providers lib/services/wallet-sync-service.ts lib/repositories/wallet-repository.ts tests/providers tests/services
git rm lib/onchain-wallet-service.ts lib/wallet-tokens-service.ts
git commit -m "feat: persist complete wallet asset scans"
```

### Task 5: Unify truthful price, holding, and chart behavior

**Files:**
- Create: `lib/providers/market-data.ts`
- Create: `lib/providers/exchange-market-data.ts`
- Create: `lib/services/price-service.ts`
- Create: `lib/services/portfolio-service.ts`
- Create: `tests/services/price-service.test.ts`
- Create: `tests/services/portfolio-service.test.ts`
- Modify: `app/api/market/chart/route.ts`
- Modify: `app/api/market/search/route.ts`
- Modify: `app/api/market/tickers/route.ts`
- Modify: `app/api/portfolio/holdings/route.ts`
- Modify: `app/api/portfolio/summary/route.ts`
- Modify: `components/TechnicalChart.tsx`
- Modify: `components/HoldingsTable.tsx`
- Modify: `components/PortfolioHero.tsx`
- Delete: `lib/market-service.ts`

**Interfaces:**
- Produces: `MarketDataProvider.getAssetPrices(assets: AssetIdentity[]): Promise<Map<string, MarketQuote>>` and `getCandles(pair: MarketPair, timeframe: ChartTimeframe): Promise<ChartDataResult>`.
- Produces: `PriceService.quoteAssets(assets): Promise<PricedAsset[]>` and `PortfolioService.getDashboard(ownerId): Promise<PortfolioDashboard>`.
- Consumes: current `wallet_assets` from Task 4 and `assetIdentityKey` from Task 2.

- [ ] **Step 1: Write the failing price and chart-truthfulness tests**

```ts
it('returns an unavailable chart result instead of synthetic candles for an unlisted pair', async () => {
  mockedProvider.getCandles.mockResolvedValue({ status: 'unavailable', candles: [] })
  await expect(chartRoute(requestFor('UNKNOWN'))).resolves.toMatchObject({ status: 404 })
})

it('calculates total from active wallet assets plus manual transactions without wallet_id', async () => {
  await expect(portfolio.getDashboard('u1')).resolves.toMatchObject({ summary: { totalValueUsd: 125 } })
})
```

- [ ] **Step 2: Run the market tests to verify they fail**

Run: `npm run test -- tests/services/price-service.test.ts tests/services/portfolio-service.test.ts`

Expected: FAIL because the market and portfolio services do not exist.

- [ ] **Step 3: Implement contract-aware price and market-pair resolution**

Use chain plus contract/mint as the primary price key and return source/timestamp/status with each quote. Resolve symbol/USDT only for an explicit, unambiguous exchange pair. Short-cache successful provider results in memory; never cache a fabricated fallback.

- [ ] **Step 4: Implement portfolio aggregation policy and replace the market routes**

Treat active on-chain wallet assets as current balance. Derive a manual position only from transactions whose `wallet_id` is null, so a wallet-linked trade is ledger/cost-basis information and cannot double-count an on-chain balance. Return explicit `live`, `stale`, and `unavailable` metadata from every market-facing endpoint.

- [ ] **Step 5: Simplify the chart and portfolio UI**

Remove generated-candle fallback and the competing TradingView iframe mode. Render loading, stale, and unavailable states with shadcn components; show source and timestamp beside the one chart engine. Update holdings and hero cards to read the unified dashboard response.

- [ ] **Step 6: Run market checks**

Run: `npm run test -- tests/services/price-service.test.ts tests/services/portfolio-service.test.ts && npm run lint && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit truthful market behavior**

```bash
git add app/api/market app/api/portfolio components/TechnicalChart.tsx components/HoldingsTable.tsx components/PortfolioHero.tsx lib/providers/market-data.ts lib/providers/exchange-market-data.ts lib/services/price-service.ts lib/services/portfolio-service.ts tests/services
git rm lib/market-service.ts
git commit -m "feat: unify live market and portfolio pricing"
```

### Task 6: Move transactions, preferences, and dashboard reads to Supabase repositories

**Files:**
- Create: `lib/repositories/settings-repository.ts`
- Create: `lib/repositories/transaction-repository.ts`
- Create: `lib/repositories/dashboard-repository.ts`
- Create: `tests/repositories/transaction-repository.test.ts`
- Create: `tests/repositories/dashboard-repository.test.ts`
- Modify: `app/api/portfolio/transactions/route.ts`
- Modify: `app/api/portfolio/holdings/route.ts`
- Modify: `app/api/portfolio/summary/route.ts`
- Modify: `app/api/ai/analyze/route.ts`
- Modify: `components/AddTransactionModal.tsx`
- Modify: `components/TransactionHistory.tsx`
- Modify: `components/AssetAllocationDonut.tsx`
- Modify: `app/page.tsx`
- Delete: `lib/db/store.ts`

**Interfaces:**
- Produces: `TransactionRepository.list(ownerId)`, `create(ownerId, input)`, `update(ownerId, id, input)`, and `remove(ownerId, id)`.
- Produces: `DashboardRepository.getCurrentAssets(ownerId)` and `SettingsRepository.getOrCreate(ownerId)`.
- Consumes: `requireUser` from Task 3 and `PortfolioService` from Task 5.

- [ ] **Step 1: Write the failing repository and route tests**

```ts
it('calculates total amount as amount × price plus fee before inserting a transaction', async () => {
  await repo.create('u1', { amount: 2, pricePerCoin: 10, fee: 1, ...baseInput })
  expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ total_amount: 21 }))
})

it('scopes a transaction mutation to the authenticated owner', async () => {
  await expect(deleteTransaction('u2', 'tx-owned-by-u1')).resolves.toEqual({ deleted: false })
})
```

- [ ] **Step 2: Run the repository tests to verify they fail**

Run: `npm run test -- tests/repositories/transaction-repository.test.ts tests/repositories/dashboard-repository.test.ts`

Expected: FAIL because Supabase repositories do not exist.

- [ ] **Step 3: Implement Supabase repositories and transaction input validation**

Use exact owner filters even though RLS applies. Preserve transaction total calculation and notes; move user preferences into `user_settings`. Ensure the AI analysis route reads authenticated dashboard data only.

- [ ] **Step 4: Replace in-memory route calls and update dashboard feature components**

Keep API response DTOs stable where practical, but remove every `db` and `DEFAULT_PRICES` import. Convert transaction and allocation UI to shadcn `Dialog`, `Table`, `Select`, and `Card` compositions.

- [ ] **Step 5: Run persistence checks**

Run: `npm run test -- tests/repositories/transaction-repository.test.ts tests/repositories/dashboard-repository.test.ts && npm run lint && npx tsc --noEmit`

Expected: PASS; `rg "@/lib/db/store|DEFAULT_PRICES|__SHUN_DB__" app lib components` returns no production references.

- [ ] **Step 6: Commit durable dashboard persistence**

```bash
git add app/api/portfolio app/api/ai components/AddTransactionModal.tsx components/TransactionHistory.tsx components/AssetAllocationDonut.tsx app/page.tsx lib/repositories tests/repositories
git rm lib/db/store.ts
git commit -m "feat: persist portfolio data in Supabase"
```

### Task 7: Add durable alerts, Telegram delivery, Edge Function, and Cron schedule

**Files:**
- Create: `lib/domain/alert-domain.ts`
- Create: `lib/repositories/alert-repository.ts`
- Create: `supabase/functions/_shared/alert-domain.ts`
- Create: `supabase/functions/evaluate-alerts/index.ts`
- Create: `supabase/migrations/202610080002_alert-cron.sql`
- Create: `tests/domain/alert-domain.test.ts`
- Create: `tests/repositories/alert-repository.test.ts`
- Create: `supabase/functions/evaluate-alerts/index.test.ts`
- Modify: `app/api/alerts/route.ts`
- Modify: `app/api/alerts/test-telegram/route.ts`
- Modify: `components/TelegramAlertsModal.tsx`

**Interfaces:**
- Produces: `evaluateAlert(rule: PriceAlertRule, quote: MarketQuote, now: Date): AlertDecision`.
- Produces: `AlertRepository.claimDelivery(input: DeliveryClaim): Promise<'claimed' | 'duplicate'>`.
- Produces: Edge Function `Deno.serve(handleEvaluateAlerts)` guarded by `CRON_SHARED_SECRET`.
- Consumes: `MarketDataProvider.getAssetPrices` from Task 5 and durable alert/asset rows from Tasks 2 and 6.

- [ ] **Step 1: Write the failing condition, cooldown, and concurrency tests**

```ts
it('triggers ABOVE only when price crosses the configured target', () => {
  expect(evaluateAlert({ condition: 'ABOVE', targetValue: 100, cooldownMinutes: 30 }, quote(101), now)).toMatchObject({ shouldNotify: true })
})

it('allows only one delivery claim in an alert cooldown bucket', async () => {
  await expect(Promise.all([repo.claimDelivery(claim), repo.claimDelivery(claim)]))
    .resolves.toEqual(expect.arrayContaining(['claimed', 'duplicate']))
})
```

- [ ] **Step 2: Run alert tests to verify they fail**

Run: `npm run test -- tests/domain/alert-domain.test.ts tests/repositories/alert-repository.test.ts`

Expected: FAIL because alert evaluation and delivery claims do not exist.

- [ ] **Step 3: Implement alert rules and idempotent delivery persistence**

Support `ABOVE`, `BELOW`, `PCT_UP_24H`, and `PCT_DOWN_24H`; default recurring cooldown to 30 minutes. Generate a deterministic bucket key from alert ID and cooldown window, enforce it with a unique database index, record successes and failures, and disable a successful non-recurring rule.

- [ ] **Step 4: Implement and test the Edge Function**

Verify the shared Cron secret, batch-fetch quotes, skip stale/unavailable assets, claim deliveries before calling Telegram, and update rule/delivery status after the response. Read `TELEGRAM_BOT_TOKEN` through Edge Function secrets only.

- [ ] **Step 5: Add the Cron migration and update alert UI/API**

Schedule `evaluate-alerts` every five minutes using Supabase Cron, store only chat IDs in settings, and replace the current test/save endpoint with separate authenticated settings and test-delivery actions. Use shadcn form controls and show last delivery state/cooldown in the alert list.

- [ ] **Step 6: Run alert checks**

Run: `npm run test -- tests/domain/alert-domain.test.ts tests/repositories/alert-repository.test.ts && supabase functions serve evaluate-alerts --no-verify-jwt`

Expected: Tests PASS; function rejects missing Cron secret and accepts a valid scheduled request in local verification.

- [ ] **Step 7: Commit server-side alerts**

```bash
git add app/api/alerts components/TelegramAlertsModal.tsx lib/domain/alert-domain.ts lib/repositories/alert-repository.ts supabase/functions supabase/migrations/202610080002_alert-cron.sql tests/domain tests/repositories
git commit -m "feat: schedule durable Telegram price alerts"
```

### Task 8: Complete the shadcn dashboard redesign and remove obsolete presentation paths

**Files:**
- Create: `components/dashboard/app-sidebar.tsx`
- Create: `components/dashboard/dashboard-shell.tsx`
- Create: `components/dashboard/portfolio-summary-cards.tsx`
- Create: `components/dashboard/data-status.tsx`
- Create: `components/wallets/wallet-sync-status.tsx`
- Create: `tests/components/dashboard-shell.test.tsx`
- Create: `tests/components/data-status.test.tsx`
- Modify: `app/page.tsx`
- Modify: `components/Navbar.tsx`
- Modify: `components/MarketWatchlist.tsx`
- Modify: `components/AiPortfolioDoctor.tsx`
- Modify: `components/TwoFactorModal.tsx`
- Modify: `components/PortfolioHero.tsx`
- Modify: `components/ViewOnlyWallets.tsx`
- Delete: `components/TwoFactorModal.tsx`

**Interfaces:**
- Produces: `DashboardShell({ activeView, children }: DashboardShellProps)` and `DataStatus({ status, updatedAt }: DataStatusProps)`.
- Consumes: unified dashboard DTO from Task 6 and market/sync status DTOs from Tasks 4 and 5.

- [ ] **Step 1: Write the failing interaction and status tests**

```tsx
it('opens the mobile navigation sheet from the menu button', async () => {
  render(<DashboardShell activeView="portfolio">content</DashboardShell>)
  await userEvent.click(screen.getByRole('button', { name: /open navigation/i }))
  expect(screen.getByRole('dialog')).toBeVisible()
})

it('labels unavailable market data without displaying a live indicator', () => {
  render(<DataStatus status="unavailable" updatedAt={null} />)
  expect(screen.getByText(/market data unavailable/i)).toBeVisible()
  expect(screen.queryByText(/live/i)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run UI tests to verify they fail**

Run: `npm run test -- tests/components/dashboard-shell.test.tsx tests/components/data-status.test.tsx`

Expected: FAIL because dashboard compositions do not exist.

- [ ] **Step 3: Implement the shell and status compositions using shadcn primitives**

Use desktop sidebar/mobile sheet navigation, consistent Card/Table/Dialog states, semantic status badges, skeletons, empty states, and keyboard-visible focus. Do not alter generated `components/ui` source for page-specific layout.

- [ ] **Step 4: Migrate remaining feature components and remove custom TOTP UX**

Replace hard-coded dark/neon containers and bespoke modals in market, AI, transaction, wallet, and portfolio features. Remove `TwoFactorModal`; explain that account MFA is configured through Supabase Auth rather than a local modal. Preserve all portfolio, wallet, market, chart, alert, and AI entry points.

- [ ] **Step 5: Run UI and production checks**

Run: `npm run test -- tests/components/dashboard-shell.test.tsx tests/components/data-status.test.tsx && npm run lint && npx tsc --noEmit && npm run build`

Expected: PASS; no generated chart fallback or in-memory database modules remain in the production bundle.

- [ ] **Step 6: Commit the UI redesign**

```bash
git add app/page.tsx components app/globals.css tests/components
git rm components/TwoFactorModal.tsx
git commit -m "feat: redesign dashboard with shadcn ui"
```

### Task 9: Validate deployment configuration, retention, and full regressions

**Files:**
- Create: `README.md`
- Create: `docs/runbooks/supabase-setup.md`
- Create: `tests/integration/portfolio-flow.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: all prior API contracts, migrations, Edge Function, and configuration validation.
- Produces: an operator runbook for project setup, secrets, migration, Cron activation, Telegram configuration, sync troubleshooting, and Free-tier limitations.

- [ ] **Step 1: Write the failing end-to-end service contract test**

```ts
it('creates a wallet, persists a complete scan, reads it after a fresh repository instance, and emits one alert delivery', async () => {
  const wallet = await wallets.create('u1', input)
  await sync.sync('u1', wallet.id)
  expect(await dashboard.getCurrentAssets('u1')).toHaveLength(2)
  await expect(alertWorker.run(validCronRequest)).resolves.toMatchObject({ deliveries: 1 })
})
```

- [ ] **Step 2: Run the end-to-end test to verify it fails**

Run: `npm run test -- tests/integration/portfolio-flow.test.ts`

Expected: FAIL until test fixtures wire all production repository/provider contracts.

- [ ] **Step 3: Add isolated provider fixtures, deployment documentation, and retention verification**

Document creation of a Supabase project, applying migrations, setting server and Edge Function secrets, enabling Cron, configuring GoldRush and market providers, and importing a single test user. Include the Free project-pausing limitation and a manual export/backup procedure. Verify retention RPCs delete only expired sync, delivery, and snapshot rows.

- [ ] **Step 4: Run complete validation**

Run: `npm run test && npm run lint && npx tsc --noEmit && npm run build && supabase db reset`

Expected: PASS; migration applies cleanly to a new local database and all tests/build checks succeed.

- [ ] **Step 5: Commit deployment readiness**

```bash
git add README.md docs/runbooks .env.example tests/integration
git commit -m "docs: add Supabase deployment runbook"
```

## Spec coverage self-review

- Durable user-scoped database and RLS: Tasks 1–3 and 6.
- Complete non-zero fungible wallet discovery, native balances, and truthful partial failures: Task 4.
- Correct contract-aware pricing and no synthetic charts: Task 5.
- Minimal retention and daily snapshots: Tasks 2 and 9.
- Five-minute deduplicated Telegram alert execution: Task 7.
- Professional shadcn/ui redesign across remaining app flows: Tasks 1 and 8.
- Configuration, security, deployability, and regression validation: Tasks 1, 3, and 9.

No spec requirements are left without an owning task. The plan uses stable interfaces between tasks and reserves external provider calls for adapters with mocked test contracts.
