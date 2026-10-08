# Shadcn Production Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bespoke dashboard with an accessible shadcn/ui portfolio application backed by the existing Supabase project and deploy it to Vercel.

**Architecture:** A new `AppShell` composes copied shadcn primitives into responsive navigation and page panels. Server repositories isolate Supabase rows from view models; route handlers require a Supabase Auth session. Vercel hosts Next.js, while the existing Supabase Edge Function owns Telegram delivery.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui New York primitives, Radix UI, Supabase SSR/Auth/Postgres, Vitest, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-09-shadcn-production-design.md`

## Global Constraints

- Use shadcn/ui New York primitives copied into `components/ui`; do not retain bespoke modal or table chrome.
- Use a neutral dark palette with emerald as the only accent; retain red/amber only for status semantics.
- Keep service-role, Telegram, provider and cron secrets server-only; `.env.example` contains placeholders.
- All authenticated data access must be RLS-scoped through `requireUser()`.
- Missing live data renders an unavailable state, never synthetic/demonstration data.
- Before deploy, run `npm run test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

## Review Focus

- Unauthenticated initial load must show sign-in rather than empty/demo wallet data — Task 3 test.
- Wallets with hundreds of assets must remain horizontally scrollable on mobile — Task 5 component test/manual QA.
- A provider failure must preserve last known wallet rows and show a sync failure — Task 4 repository test.
- Supabase callback with absent/invalid `code` must redirect to `/login?error=auth` — Task 3 route test.
- Vercel refresh endpoint without its cron authorization must reject the request — Task 6 route test.

---

### Task 1: Install canonical shadcn primitives and tokens

**Files:**
- Modify: `components.json`, `app/globals.css`, `package.json`
- Create: `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/dialog.tsx`, `components/ui/sheet.tsx`, `components/ui/table.tsx`, `components/ui/tabs.tsx`, `components/ui/dropdown-menu.tsx`, `components/ui/alert.tsx`, `components/ui/avatar.tsx`, `components/ui/separator.tsx`

**Interfaces:**
- Produces: canonical shadcn exports consumed by `AppShell`, `LoginForm`, and dashboard pages.

- [ ] **Step 1: Install Radix dependencies with npm and fetch/copy the matching shadcn New York component sources**

The repository has `bun.lock` but no Bun executable; use npm packages required by the exact primitives and preserve the lockfile.

- [ ] **Step 2: Run the type check to verify primitive exports resolve**

Run: `npx tsc --noEmit`

Expected: PASS with no missing shadcn/Radix imports.

- [ ] **Step 3: Commit**

```bash
git add components.json app/globals.css components/ui package.json package-lock.json
git commit -m "feat: add shadcn dashboard primitives"
```

### Task 2: Build responsive application shell

**Files:**
- Create: `components/app-shell.tsx`, `components/app-sidebar.tsx`, `components/app-header.tsx`
- Modify: `app/page.tsx`, `components/Navbar.tsx`
- Test: `tests/components/app-shell.test.tsx`

**Interfaces:**
- Consumes: `Sheet`, `Button`, `Separator`, `Tooltip`-equivalent shadcn primitives from Task 1.
- Produces: `AppShell({ children, activeTab, onTabChange, title, actions })` for page-level content.

- [ ] **Step 1: Write a failing test that renders the sidebar navigation and its mobile menu trigger**

Assert accessible names for “Danh mục”, “Thị trường”, “Biểu đồ”, “Ví”, and the mobile “Mở điều hướng” trigger.

- [ ] **Step 2: Run the test to verify it fails because `AppShell` is unavailable**

Run: `npm run test -- --run tests/components/app-shell.test.tsx`

Expected: FAIL on missing module/export.

- [ ] **Step 3: Implement `AppShell` and replace the double Navbar with responsive Sidebar/Sheet/Header composition**

Use semantic `nav`, one desktop sidebar, a Sheet only below `md`, and a header with no duplicate metrics/navigation.

- [ ] **Step 4: Run the component test and full test suite**

Run: `npm run test -- --run tests/components/app-shell.test.tsx` then `npm run test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components app/page.tsx tests/components/app-shell.test.tsx
git commit -m "feat: add responsive shadcn app shell"
```

### Task 3: Replace legacy session with Supabase magic-link authentication

**Files:**
- Create: `app/login/page.tsx`, `app/auth/callback/route.ts`, `components/login-form.tsx`, `lib/auth/redirect.ts`
- Modify: `app/api/auth/status/route.ts`, `app/api/auth/logout/route.ts`, `app/page.tsx`
- Test: `tests/auth/redirect.test.ts`, `tests/auth/status.test.ts`

**Interfaces:**
- Consumes: `getServerSupabase()`, `getAuthenticatedUser()`.
- Produces: `safeAuthRedirect(path: string): string` and an authenticated app state/redirect.

- [ ] **Step 1: Write failing tests for callback redirect validation and unauthenticated status**

Assert an external redirect resolves to `/` and status returns `{ isAuthenticated: false }` without data from the legacy store.

- [ ] **Step 2: Run the auth tests to verify they fail**

Run: `npm run test -- --run tests/auth/redirect.test.ts tests/auth/status.test.ts`

Expected: FAIL because the helper/status behaviour does not exist.

- [ ] **Step 3: Implement magic-link login, code exchange callback, Supabase logout and login-state gate**

Use `auth.signInWithOtp`, `exchangeCodeForSession`, and `auth.signOut`; redirect unauthenticated dashboard users to `/login`.

- [ ] **Step 4: Run targeted and full tests**

Run: `npm run test -- --run tests/auth/redirect.test.ts tests/auth/status.test.ts` then `npm run test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app components lib/auth tests/auth
git commit -m "feat: add Supabase magic link authentication"
```

### Task 4: Complete RLS-scoped portfolio repositories and API routes

**Files:**
- Create: `lib/portfolio/portfolio-repository.ts`, `lib/portfolio/portfolio-mapper.ts`, `lib/alerts/alert-repository.ts`
- Modify: `app/api/portfolio/summary/route.ts`, `app/api/portfolio/holdings/route.ts`, `app/api/portfolio/transactions/route.ts`, `app/api/alerts/route.ts`, `app/api/alerts/test-telegram/route.ts`
- Test: `tests/portfolio/portfolio-mapper.test.ts`, `tests/alerts/alert-repository.test.ts`, `tests/wallets/wallet-sync-service.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `mapWalletRow`, `syncWalletAssets`.
- Produces: `getPortfolioSummary(ownerId)`, `getHoldings(ownerId)`, `listTransactions(ownerId)`, and RLS-safe alert CRUD.

- [ ] **Step 1: Write failing mapper/repository tests for wallet-derived holdings and an alert owned by another user**

Assert wallet assets produce holdings with no synthetic prices, and every repository query includes the caller owner id.

- [ ] **Step 2: Run tests to verify expected failures**

Run: `npm run test -- --run tests/portfolio/portfolio-mapper.test.ts tests/alerts/alert-repository.test.ts`

Expected: FAIL due to missing repositories.

- [ ] **Step 3: Implement repository mappers and migrate portfolio/alerts API routes from `lib/db/store`**

Keep raw on-chain value persistent, map database snake_case only at repository boundaries, and return 401 via `UnauthorizedError`.

- [ ] **Step 4: Add wallet-sync test for provider failure preserving existing assets, then implement only the required failure record path**

Run: `npm run test -- --run tests/wallets/wallet-sync-service.test.ts`

Expected: the new test passes while existing active asset rows are not deleted before a successful scan.

- [ ] **Step 5: Run full tests and commit**

```bash
npm run test
git add lib app/api tests
git commit -m "feat: move portfolio and alerts to Supabase"
```

### Task 5: Compose shadcn portfolio, wallet, market and chart views

**Files:**
- Create: `components/dashboard/summary-cards.tsx`, `components/dashboard/holdings-table.tsx`, `components/dashboard/wallet-panel.tsx`, `components/dashboard/empty-state.tsx`, `components/dashboard/unavailable-state.tsx`
- Modify: `components/PortfolioHero.tsx`, `components/HoldingsTable.tsx`, `components/ViewOnlyWallets.tsx`, `components/MarketWatchlist.tsx`, `components/TechnicalChart.tsx`, `app/page.tsx`
- Test: `tests/components/holdings-table.test.tsx`, `tests/components/wallet-panel.test.tsx`, `tests/components/unavailable-state.test.tsx`

**Interfaces:**
- Consumes: Task 1 primitives, `Wallet`, `Holding`, chart API response contract.
- Produces: composable dashboard panels with no bespoke modal/table layout.

- [ ] **Step 1: Write failing component tests for table semantic markup, wallet empty state and truthful chart unavailable state**

Assert `table`, column headers, an “Chưa có ví” empty state, and “Không hiển thị dữ liệu mô phỏng” when chart data is unavailable.

- [ ] **Step 2: Run tests to verify failures**

Run: `npm run test -- --run tests/components/holdings-table.test.tsx tests/components/wallet-panel.test.tsx tests/components/unavailable-state.test.tsx`

Expected: FAIL due to absent new composed components.

- [ ] **Step 3: Implement compact Card/Table/Dialog-based views and replace legacy dashboard components in `app/page.tsx`**

Keep table overflow inside `overflow-x-auto`; use Badge for chain/status/change and Dialog for wallet detail/add flows. Remove custom gradient borders, double navigation and fixed-width panels.

- [ ] **Step 4: Run component suite and perform responsive visual QA**

Run: `npm run test -- --run tests/components`

Expected: PASS. Inspect 375px and 1440px viewport: no clipped header; table scrolls within its Card.

- [ ] **Step 5: Commit**

```bash
git add components app/page.tsx tests/components
git commit -m "feat: redesign portfolio with shadcn components"
```

### Task 6: Configure production deployment and scheduled refresh

**Files:**
- Create: `app/api/cron/refresh/route.ts`, `vercel.json`, `docs/deployment.md`
- Modify: `.env.example`, `next.config.ts`, `supabase/migrations/202610090002_alert_cron.sql`
- Test: `tests/cron/refresh-route.test.ts`, `tests/config/env.test.ts`

**Interfaces:**
- Consumes: `CRON_SHARED_SECRET`, Supabase server/admin client.
- Produces: `GET /api/cron/refresh` guarded by Vercel’s authorization and `vercel.json` daily schedule.

- [ ] **Step 1: Write a failing cron test for absent or invalid bearer secret**

Assert a request without matching `CRON_SHARED_SECRET` returns 401 and performs no refresh.

- [ ] **Step 2: Run the cron test to verify failure**

Run: `npm run test -- --run tests/cron/refresh-route.test.ts`

Expected: FAIL because the route is absent.

- [ ] **Step 3: Implement the guarded refresh route, Vercel schedule and deployment documentation**

Use a server-only secret comparison. Document Vercel variables, Supabase Auth URLs, migration status, Edge Function deploy command and Scheduler request header; never add an actual secret.

- [ ] **Step 4: Run targeted and full verification**

Run: `npm run test -- --run tests/cron/refresh-route.test.ts`, `npm run test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`

Expected: all PASS.

- [ ] **Step 5: Commit and deploy only after explicit external-deploy confirmation**

```bash
git add app/api/cron vercel.json docs/deployment.md .env.example supabase/migrations tests
git commit -m "chore: configure Vercel production deployment"
```

Deploy through the authenticated Vercel CLI only after presenting the exact environment/deployment action to the user.

## Plan self-review

- UI shell, canonical primitives and responsive QA are covered by Tasks 1, 2 and 5.
- Supabase Auth and removal of legacy production session paths are covered by Task 3.
- RLS-scoped portfolio, transaction, alert and sync failure behaviour are covered by Task 4.
- Supabase Scheduler remains Telegram owner; Vercel Cron is isolated and guarded in Task 6.
- Production environment, build verification and deploy approval are covered by Task 6.
