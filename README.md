# Multi-Currency Wallet

A simulated multi-currency digital wallet: one user, several wallets, deposits,
withdrawals, same-currency transfers and cross-currency conversions at live
mid-market rates. No auth and no payments. Nothing to install to run it
locally; the deployed version keeps its ledger in Redis.

**Live:** <https://coconut-labs-coding-test-internatio.vercel.app/>

## Run it

Node 20.19+ or 22+ (built and verified on Node 22.2.0). Nothing else — **no
database, no Redis, no API key and no account anywhere** are needed to run this
locally.

```bash
git clone https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer.git
cd coconut-labs-coding-test_international_wallet_transfer
npm install
cp .env.example .env.local   # optional — every variable in it is optional locally
npm run dev
```

Open <http://localhost:3000>. Six wallets are already seeded, so there is
something to deposit into straight away. (If port 3000 is taken, Next picks
another and prints it — read the `Local:` line, not the default.)

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server, hot reload |
| `npm test` | Vitest: money math, use cases, the Redis adapter and DOM behaviour (Frankfurter mocked) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm start` | Serve that build — run `npm run build` first |

One thing does reach the network at runtime: the exchange rate. `/api/rates`
and `/api/conversions` call [Frankfurter](https://frankfurter.dev), which needs
no key or account. With no connection, conversions return
`503 RATE_UNAVAILABLE` rather than inventing a rate — and `npm test` still
passes, because the tests mock it.

### Where the ledger lives

The app picks its storage from the environment, in one place
([`src/infrastructure/container.ts`](src/infrastructure/container.ts)):

| Redis variables set? | Store | What that means |
| --- | --- | --- |
| No — the default locally | In memory | Zero setup; the ledger resets when the server restarts |
| Yes | Upstash Redis | Survives restarts; the same store the deployment uses |
| No, but running on Vercel | — | **Startup throws, deliberately** — see [Deploying](#deploying) |

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

## Environment variables

Every variable the code reads is declared in [`.env.example`](.env.example),
with a comment on where each value comes from. Copy it and fill in only what
you need:

```bash
cp .env.example .env.local
```

`.env.local` is gitignored; `.env` works too. `.env.example` is committed and
holds variable **names** only, never values.

| Variable | Required | Who sets it | When it is absent |
| --- | --- | --- | --- |
| `KV_REST_API_URL` | In production | Vercel, once an Upstash store is connected | Falls through to `UPSTASH_REDIS_REST_URL` |
| `KV_REST_API_TOKEN` | In production | Vercel, same | Falls through to `UPSTASH_REDIS_REST_TOKEN` |
| `UPSTASH_REDIS_REST_URL` | Alternative to the above | You, from the Upstash console | In-memory ledger |
| `UPSTASH_REDIS_REST_TOKEN` | Alternative to the above | You, same | In-memory ledger |
| `VERCEL` | **Never set this yourself** | The Vercel build and runtime | Local behaviour: a missing Redis config is fine |
| `VERCEL_TOKEN` | Only for CLI deploys | You, from Vercel → Account → Tokens | Use the dashboard integration instead |

Set **one** of the two pairs. `KV_REST_API_*` is read first; both name the same
Upstash service, and two names exist only because the two ways of provisioning
it differ.

**The adapter speaks Upstash's HTTP REST API, not the Redis wire protocol.** A
local `redis-server` or the `redis` Docker image cannot stand in for it — they
do not speak HTTP. Use a free Upstash store, or leave the variables unset and
develop against the in-memory ledger.

## Deploying

Hosted on **Vercel**, with the ledger in **Upstash Redis**.

### 1. Create the Redis store — before the first deploy

1. Vercel dashboard → the project → **Storage** → **Create Database** →
   **Upstash Redis** → free tier.
2. Connect it to the project. `KV_REST_API_URL` and `KV_REST_API_TOKEN` are
   injected into every environment automatically — you never copy them by hand.

**The order matters: a deploy with no Redis configured fails on purpose**, at
build time. Next's headline is generic and names a route rather than the cause,
so read one line further down:

```
> Build error occurred
Error: Failed to collect page data for /api/transfers
  [cause]: Error: Running on Vercel without Redis configured. Set
  KV_REST_API_URL and KV_REST_API_TOKEN (or the UPSTASH_REDIS_REST_*
  equivalents): the in-memory ledger cannot survive across serverless instances.
```

That refusal is deliberate. Vercel runs the app as serverless functions with no
instance affinity and recycles idle ones, so an in-memory ledger would serve
one request from one instance's memory and the next from another's — a deposit
would appear to vanish. A deployment that looks healthy while losing money is
worse than one that refuses to start.

### 2a. Deploy from the dashboard (recommended)

1. **Add New** → **Project** → import this repository.
2. Next.js is auto-detected — no build command, output directory or install
   command to change.
3. **Deploy.** Every later merge to `main` deploys itself, and pull requests
   get their own preview URLs.

### 2b. Or deploy from the command line

Needs `VERCEL_TOKEN` in `.env.local` (Vercel → Account → Tokens):

```bash
set -a; . ./.env.local; set +a          # load it into this shell
npx vercel link --yes --token "$VERCEL_TOKEN"
npx vercel --prod --token "$VERCEL_TOKEN"
```

To point local development at the deployed store rather than the in-memory one:

```bash
npx vercel env pull .env.local          # overwrites it with the real values
npm run dev
```

### Not GitHub Pages

Static hosting cannot serve this app at all — all nine API routes are
server-side, and `output: "export"` fails on every one of them. The options
were measured rather than assumed; see
[`ai_docs/deployment.md`](agentic_coding_orchestrator/ai_docs/deployment.md).

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
ledger survives Next.js hot reloads. The Redis adapter, added later, tested that
claim rather than asserting it: swapping the store touched `infrastructure/` and
the composition root only, and no file under `domain/` or `application/` imports
or even names Redis.

**All business logic is server-side.** The use cases in
`src/application/useCases/` own every rule. Route handlers validate shapes with zod and map errors; the client posts
JSON and renders what comes back. The convert form displays the quoted rate but
never computes a converted amount.

**Rates are cached 60s per pair** with a 5s request timeout. If Frankfurter fails
or answers unexpectedly, the request returns `503` and **nothing is written** —
there is no invented or stale-beyond-cache fallback. The rate is fetched before
the append, and the balance is re-checked after that `await`, immediately before
writing.

## Known limitations

- **Storage depends on where it runs.** Locally the ledger is in memory and
  resets on restart. On Vercel it is in Redis and persists; reseeding is
  guarded so a cold start cannot duplicate the opening deposits.
- **Concurrent writes can race.** A use case reads the balance, then appends.
  Within one process that is effectively atomic; across serverless instances it
  is not, so two simultaneous withdrawals could both pass the funds check. The
  fix is a per-wallet lock or a Lua check-and-append; see
  [`ai_docs/deployment.md`](agentic_coding_orchestrator/ai_docs/deployment.md).
- **Single simulated user, no auth.** Every request is that user. `/api/rates`
  is an unauthenticated passthrough (cached, but unthrottled).
- **Daily mid-market rates.** Frankfurter publishes ECB reference rates once per
  working day, so a conversion made at 02:00 uses the previous close. No spread
  or fees are modelled, which no real provider would do.
- **A currency's minor-unit exponent comes from the runtime, and runtimes
  disagree.** `decimalsFor` reads
  `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`, as the brief
  requires. But that value depends on the CLDR data bundled with the Node build,
  and CLDR changed IDR from 2 fraction digits to 0. Measured, not assumed:

  | Runtime | `decimalsFor("IDR")` | `balanceMinor: 1811400` renders as |
  | --- | --- | --- |
  | Local, Node 22.2.0 | `2` | `IDR 18,114.00` |
  | Vercel production | `0` | `IDR 1,811,400` |

  Each environment is internally consistent, so both read correctly on their
  own. The hazard is a **shared** ledger: `amountMinor` is an integer whose
  meaning depends on the exponent in force when it was written, so the same
  stored row is off by 100× when read by the other runtime. This was harmless
  while the ledger lived in one process, and became real the moment it moved to
  Redis — including for the `vercel env pull` workflow above, which deliberately
  points local development at the production store.

  **The fix is to stop deriving stored money from a library version**: pin the
  exponent per supported currency in a constant table, keep `Intl` for display
  only, and record the exponent on each ledger entry so old rows stay readable
  if the table ever changes. Not done here — it reverses an explicit
  instruction in the brief, so it is the owner's call.
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

Layered (clean) architecture; dependencies point inward only
(`app → infrastructure → application → domain`). The full convention is in
[`agentic_coding_orchestrator/ai_docs/architecture.md`](agentic_coding_orchestrator/ai_docs/architecture.md).

```
src/
  app/                        Next.js routing + HTTP edge (no business logic)
    page.tsx                  balances + action forms
    transactions/             history, detail
    api/                      9 route handlers (the whole API surface)
  components/                 client components (fetch + render only)
  domain/                     the rules; imports nothing outward
    entities/                 Currency, Money, Wallet, Transaction, ExchangeRate
    repositories/             WalletRepository, ExchangeRateRepository (interfaces)
    errors.ts                 AppError + ErrorCode
  application/
    useCases/                 depositFunds, withdrawFunds, transferFunds,
                              convertCurrency, listWallets, getWallet,
                              listTransactions, getTransaction, getExchangeRate
  infrastructure/
    repositories/             InMemoryWalletRepository, FrankfurterExchangeRateRepository
    http/                     errorResponse, requestValidation (zod)
    container.ts              composition root: the only place implementations are chosen
  test/                       Vitest specs, mirroring the layout above
```
