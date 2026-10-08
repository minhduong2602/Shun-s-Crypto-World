# Atomic Portfolio Balance Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent concurrent transaction writes from making a user's chronological asset balance negative.

**Architecture:** Enforce the invariant in PostgreSQL triggers so transaction writes for each owner are serialized and the complete statement is validated, including multi-row imports and direct authenticated Supabase writes. Preserve the existing API pre-check for useful early feedback; map the database constraint violation to HTTP 409.

**Tech Stack:** PostgreSQL migration, Supabase PostgREST, Next.js route handler, Vitest.

**Spec:** Verified requirement from the active portfolio objective: transaction management must keep balances valid under concurrent operations. Current evidence is `app/api/portfolio/transactions/route.ts`, which performs balance validation and insert as separate requests.

## Global Constraints

- Keep transaction history ordered by `executed_at`, `created_at`, then `id`.
- Treat `BUY` and `TRANSFER_IN` as increasing balances; `SELL` and `TRANSFER_OUT` decrease them.
- Reject any genuinely negative numeric balance in the database; the existing API pre-check retains its floating-point tolerance for early feedback.
- Enforce the invariant in the database for all authenticated insert/update/delete paths, not only one API route.

## Review Focus

- Concurrent sells or withdrawals: serialized using a transaction-scoped advisory lock.
- Historical edits/deletes: validate the resulting ledger chronologically, not only the latest balance.
- Symbol edits: validate both the old and new asset ledgers and lock both identities in deterministic order.
- Authenticated attempts to change transaction ownership: rejected.
- Ordinary buys/transfers and service-role writes: remain compatible.

Ruling: Validate after the full SQL statement using transition tables rather than validating each row in a `BEFORE` trigger — `BEFORE ROW` cannot see later rows in the same bulk import, which could reject a valid chronological ledger depending on input order; the cost if wrong is an extra owner-level serialization point and whole-ledger validation after each write.

Ruling: Use a strict `< 0` database balance test instead of the API's `1e-10` tolerance — PostgreSQL `numeric` arithmetic is exact and has no binary floating-point noise to absorb, while any tolerated negative would be a real oversell; the cost if wrong is that a legacy ledger with even a tiny negative balance requires correction before further mutations.

### Task 1: Database invariant

**Files:** Create `supabase/migrations/202610090008_prevent_negative_transaction_balances.sql`.

- [ ] Add a `BEFORE INSERT OR UPDATE OR DELETE` trigger function that locks the affected owner/symbol identities, computes chronological running balances, rejects a minimum below `-0.0000000001`, and prevents authenticated ownership changes.
- [ ] Add the trigger and restrict direct execution of its function.
- [ ] Review SQL branches for INSERT, UPDATE, DELETE and deterministic multi-symbol lock ordering.

### Task 2: API conflict response

**Files:** Modify `app/api/portfolio/transactions/route.ts`; test `tests/portfolio/transaction-route.test.ts`.

- [ ] Add a failing route test for Supabase constraint error code `23514` returning HTTP 409 with a useful balance-conflict message.
- [ ] Map the trigger's constraint violation to HTTP 409 while retaining existing validation and handling of other DB errors.
- [ ] Verify POST, PUT, and DELETE DB conflicts are mapped consistently.

### Task 3: Verification

- [ ] Run focused transaction route tests and the complete Vitest suite.
- [ ] Run TypeScript, lint, production build, and `git diff --check`.
- [ ] Report that the migration must be applied to the connected Supabase project before the invariant is active there.
