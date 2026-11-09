# Multi-Currency Wallet

A simulated multi-currency digital wallet: one user, several wallets, deposits,
withdrawals, same-currency transfers and cross-currency conversions at live
mid-market rates. No auth, no payments, no database.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # Vitest: money math + wallet service (Frankfurter mocked)
npm run typecheck    # tsc --noEmit
```

Node 20.19+ or 22+ (the repo was built and verified on Node 22.2.0).

## What you can do

| Page | |
| --- | --- |
| `/` | Balances for all six seeded wallets, plus deposit, withdraw, transfer and convert forms. The convert form shows the live rate for the selected pair. |
| `/transactions` | Full history, filterable by wallet. |
| `/transactions/[id]` | One transaction, including the rate and rate date used. |

## API

| Method | Route | Body / query |
| --- | --- | --- |
| GET | `/api/wallets` | — |
| GET | `/api/wallets/[id]` | — |
| POST | `/api/deposits` | `{ walletId, amount }` |
| POST | `/api/withdrawals` | `{ walletId, amount }` |
| POST | `/api/transfers` | `{ fromWalletId, toWalletId, amount }` |
| POST | `/api/conversions` | `{ fromWalletId, toWalletId, amount }` |
| GET | `/api/rates` | `?from=USD&to=EUR` |
| GET | `/api/transactions` | `?walletId=` (optional) |
| GET | `/api/transactions/[id]` | — |

`amount` is always a **decimal string** (`"10.50"`), parsed to minor units on the
server. Errors share one shape:

```json
{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "USD Main holds $12.00, which is less than $50.00." } }
```

`400` validation and amount problems (`VALIDATION_FAILED`, `INVALID_AMOUNT`,
`TOO_MANY_DECIMALS`, `AMOUNT_TOO_LARGE`) · `404` `WALLET_NOT_FOUND`,
`TRANSACTION_NOT_FOUND` · `422` rule violations (`SAME_WALLET`,
`CURRENCY_MISMATCH`, `CURRENCY_MATCH_FOR_CONVERSION`, `INSUFFICIENT_FUNDS`,
`ROUNDS_TO_ZERO`) · `503` `RATE_UNAVAILABLE`.

## Design decisions

**Money is never a float.** Every amount is an integer count of minor units.
Each currency's exponent comes from
`Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits` (USD 2, JPY 0).
Decimal strings are parsed by string manipulation, so `"8.70"` is exactly `870`
sen/cents — no `parseFloat` anywhere in the amount path. A float appears in
exactly one place: `formatMinor`, for display.

**Conversion rounds half-up in BigInt.**
`targetMinor = roundHalfUp(sourceMinor × rate × 10^(targetDecimals − sourceDecimals))`,
computed as a BigInt fraction so USD→IDR cannot lose precision. The rate stays a
**decimal string** end to end: the Frankfurter response's raw numeric token is
extracted from the response text rather than parsed into a JS number, so the
stored rate is byte-for-byte the rate we were quoted. Mid-market only, no spread.

**The ledger is the source of truth.** `Transaction` entries are append-only and
balances are folded from them on every read — there is no stored balance to drift.
A transfer or conversion is a *single* entry describing both legs (debit
`amountMinor` of `currency`, credit `targetAmountMinor` of `targetCurrency`),
which is what makes the two sides atomic: one append, or nothing. Opening
balances are real `DEPOSIT` entries, never untracked state.

**Storage sits behind an interface.** `WalletRepository` exposes one write
(`append`). The in-memory implementation keeps the store on `globalThis` so the
ledger survives Next.js hot reloads; a file or SQL adapter can replace it without
touching the service layer.

**All business logic is server-side.** `src/lib/service/wallet.ts` owns every
rule. Route handlers validate shapes with zod and map errors; the client posts
JSON and renders what comes back. The convert form displays the quoted rate but
never computes a converted amount.

**Rates are cached 60s per pair** with a 5s request timeout. If Frankfurter fails
or answers unexpectedly, the request returns `503` and **nothing is written** —
there is no invented or stale-beyond-cache fallback. The rate is fetched before
the append, and the balance is re-checked after that `await`, immediately before
writing.

## Known limitations

- **Data resets on restart.** The store is in memory; `npm run dev` always starts
  from the same six seeded wallets.
- **Single simulated user, no auth.** Every request is that user. `/api/rates`
  is an unauthenticated passthrough (cached, but unthrottled).
- **Daily mid-market rates.** Frankfurter publishes ECB reference rates once per
  working day, so a conversion made at 02:00 uses the previous close. No spread
  or fees are modelled, which no real provider would do.
- **Concurrency is only as safe as one Node process.** Read-check-append is
  effectively atomic here because a single process interleaves requests at
  `await` points, and the one `await` inside `convert` is followed by a
  re-check. A real deployment needs a transactional store or a per-wallet lock.
- **CLDR gives IDR two fraction digits**, so IDR balances are held in sen
  (`"1"` IDR → 100 minor units). That follows the spec's rule of taking decimals
  from `Intl`, but it is not how Indonesian amounts are written in practice.
- **Tailwind is pinned to v3.** Tailwind v4's compiler `require()`s an ESM
  module, which fails on Node 22.2 (it needs 22.12+); v3 + PostCSS builds on the
  toolchain this was developed against.
- Balance derivation is O(ledger) per read, which is fine for a seeded demo and
  would become a snapshot/projection table with real volume.

## With more time

1. Idempotency keys on the POST routes, so a retried deposit cannot double-apply.
2. A persistent adapter (SQLite or Postgres) behind `WalletRepository`, with the
   two-leg entry written in a transaction and a per-wallet lock.
3. A server-rendered conversion *quote* endpoint (`POST /api/conversions/preview`)
   so the UI can show the exact target amount, not just the rate, without doing
   money math in the client.
4. Route-level integration tests (the current acceptance pass was a scripted
   curl run — see `agentic_coding_orchestrator/ai_reviews/`), plus a fake
   Frankfurter server for timeout and malformed-response paths.
5. Decimal-string formatting per locale, and an `Accept-Language`-aware display
   layer instead of hard-coded `en-US`.

## Layout

```
src/
  app/
    page.tsx                  balances + action forms
    transactions/             history, detail
    api/                      9 route handlers (the whole API surface)
  components/WalletActions.tsx  client forms (fetch + pending state only)
  lib/
    money.ts                  decimals, parsing, half-up conversion  (unit-tested)
    rates.ts                  Frankfurter v2 client + 60s cache
    service/wallet.ts         every business rule                     (unit-tested)
    repo/WalletRepository.ts  storage boundary
    repo/memory.ts            in-memory, globalThis-backed, seeded
    errors.ts validation.ts types.ts currencies.ts
```
