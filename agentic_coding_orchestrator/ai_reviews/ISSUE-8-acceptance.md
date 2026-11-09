# ISSUE-8 acceptance — Vercel deployment and setup documentation

- **Issue:** [#8](https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/issues/8)
- **Branch:** `development/feature/vercel-deployment` (from `main` at `249dd4d`)
- **Spec:** [`../ai_specs/ISSUE-8-vercel-deployment.md`](../ai_specs/ISSUE-8-vercel-deployment.md)
- **Date:** 2026-11-09
- **Environment:** macOS (Darwin 27.0.0), Node 22.2.0, Next.js 16.4.5
- **Application code changed:** none. This branch touches `.env.example`,
  `.gitignore`, `README.md` and the working record only.

## Result

| # | Criterion | Verdict |
| --- | --- | --- |
| 1 | `.env.example` declares every variable the code reads | ✅ |
| 2 | Copying the template unchanged leaves the app working, in memory | ✅ proven live |
| 3 | `.env.local` ignored by git, `.env.example` tracked | ✅ |
| 4 | README states local development needs no credentials | ✅ |
| 5 | README carries an env var table: name, owner, required, absent-behaviour | ✅ |
| 6 | README documents the deploy path and the deliberate no-Redis failure | ✅ with real output |
| 7 | `npm test`, `typecheck`, `lint`, `build` all pass | ✅ 83/83, clean |
| 8 | The deployed URL serves all three pages; a deposit survives a cold start | ✅ verified live |

Eight of eight. Criterion 8 was blocked at first hand-over and was completed
once the owner provisioned Upstash; the evidence is in §8.

**Deploying also exposed a defect that no local test could reach** — the
minor-unit exponent for IDR differs between the local and production runtimes.
See *Defect found by deploying*, below.

## 1 — the template matches what the code actually reads

The list was derived from the source, not from memory:

```
$ grep -rn 'process\.env' src/ | grep -v '^src/test/'
src/infrastructure/container.ts:37:  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
src/infrastructure/container.ts:38:  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
src/infrastructure/container.ts:53:  if (process.env.VERCEL) {
```

Five variables, one file, and `.env.example` declares all five. `VERCEL_TOKEN`
and the two `VERCEL_*_ID`s are also listed, flagged explicitly as deploy-time
only and **not read by the application** — true, and the grep above is the
proof.

## 2 — the copied template does not break anything

This is the criterion most worth proving properly, because "every variable is
optional" is easy to write and easy to get wrong. Three steps:

**Step 1 — copy it and confirm nothing is active.**

```
$ cp .env.example .env.local
$ grep -vE '^\s*(#|$)' .env.local
(no output — every line is a comment)
```

**Step 2 — confirm Next actually reads the file**, rather than the app merely
surviving a file it ignores. A cold start lists it:

```
▲ Next.js 16.4.5 (Turbopack)
- Local:         http://localhost:3001
- Environments: .env.local
```

**Step 3 — prove the switch is live, not just the file.** A file that is read
but has no effect looks identical to one that works. So a *deliberately dead*
Redis address was appended:

```
$ printf 'KV_REST_API_URL=http://127.0.0.1:1\nKV_REST_API_TOKEN=deliberately-dead\n' >> .env.local
$ curl -s -o /dev/null -w '%{http_code}' localhost:3001/api/wallets
500
$ # body: {"error":{"code":"INTERNAL_ERROR","message":"Something went wrong."}}
```

Then restored, and the app recovers:

```
$ cp <backup> .env.local
$ curl -s -o /dev/null -w '%{http_code}' localhost:3001/api/wallets
200
```

`200` with the values commented out, `500` when they point somewhere dead,
`200` again once restored. The environment genuinely selects the store, and the
unmodified template genuinely selects memory. This also exercises the
container's env branch against a real Next.js server, which the unit tests
(which manipulate `process.env` directly) cannot.

## 3 — git treats the two files oppositely

`git check-ignore -v` was misleading here: it prints a match for the `!` rule
too, which reads like the template is ignored. The unambiguous test is what
would be staged:

```
$ git add --dry-run .env.example .env.local
The following paths are ignored by one of your .gitignore files:
.env.local
hint: Use -f if you really want to add them.
add '.env.example'
```

Template staged, real file refused. The `.gitignore` exception:

```
.env*

# ...but the template declares only variable NAMES, never values, and a
# reviewer cannot set up the project without it, so it stays tracked.
!.env.example
```

## 6 — the no-Redis failure is loud, and the README quotes it accurately

The README first claimed the failure arrives "with the reason in the build log".
Rather than trust that, it was run:

```
$ VERCEL=1 npm run build
> Build error occurred
Error: Failed to collect page data for /api/transfers
    at ignore-listed frames { type: 'Error' }
$ echo $?
1
```

The headline names a route and no cause — which would send a reader hunting in
`/api/transfers`. Searching the full log found the real message one level down:

```
$ grep -n 'without Redis' build.log
16:  [cause]: Error: Running on Vercel without Redis configured. Set
KV_REST_API_URL and KV_REST_API_TOKEN (or the UPSTASH_REDIS_REST_*
equivalents): the in-memory ledger cannot survive across serverless instances.
```

So the claim was true but incomplete, and the README now quotes the actual
two-part output and tells the reader to look one line down. **A deploy without
the Redis store fails at build time, exit 1** — it never reaches a state where
it looks healthy while losing transactions.

## 7 — the standing checks

```
$ npm test
 Test Files  11 passed (11)
      Tests  83 passed (83)
   Duration  2.90s

$ npm run typecheck     # tsc --noEmit
(no output)

$ npm run lint          # eslint
(no output)

$ npm run build
✓ Compiled successfully in 4.3s
  Finished TypeScript in 3.1s
✓ Generating static pages (10/10)
```

Route table from the build — every route that touches the ledger is `ƒ`
(server-rendered on demand), so nothing is frozen at build time with the seeded
balances:

```
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/conversions          ├ ƒ /api/deposits
├ ƒ /api/rates                ├ ƒ /api/transactions
├ ƒ /api/transactions/[id]    ├ ƒ /api/transfers
├ ƒ /api/wallets              ├ ƒ /api/wallets/[id]
├ ƒ /api/withdrawals
├ ƒ /transactions             └ ƒ /transactions/[id]
```

Only `/_not-found` is static. Confirmed before deploying rather than after,
because a statically prerendered `/` would have shown a reviewer permanently
stale balances while every API call succeeded — a failure that looks like
nothing at all.

## 8 — the live deployment

**URL:** <https://coconut-labs-coding-test-internatio.vercel.app/>

Deployed from `main` at `249dd4d` via the Vercel dashboard, with Upstash for
Redis attached through the Marketplace integration (an existing Upstash account,
linked rather than created).

### Seeding ran exactly once on a real cold start

The `SET NX` guard was until now only tested against a fake. Against the real
service:

```
$ curl -s $URL/api/transactions
seed-4  DEPOSIT  jpy-main      75000 JPY   2026-01-01T00:00:00.000Z
seed-3  DEPOSIT  eur-main      50000 EUR   2026-01-01T00:00:00.000Z
seed-2  DEPOSIT  usd-savings  100000 USD   2026-01-01T00:00:00.000Z
seed-1  DEPOSIT  usd-main     250000 USD   2026-01-01T00:00:00.000Z
```

Four entries, ids `seed-1` to `seed-4`, no duplicates — so no concurrent cold
start re-seeded and no opening deposit was conjured twice.

Balances match `seed.ts` exactly, including the two wallets that are
**deliberately empty** because they have no opening deposit:

| Wallet | Expected | Live |
| --- | --- | --- |
| USD Main | `$2,500.00` | ✅ |
| USD Savings | `$1,000.00` | ✅ |
| EUR | `€500.00` | ✅ |
| GBP | `£0.00` (no seed deposit) | ✅ |
| JPY | `¥75,000` | ✅ |
| IDR | `IDR 0` (no seed deposit) | ✅ |

### A write survives the trip between instances

```
$ curl -X POST $URL/api/deposits -d '{"walletId":"gbp-main","amount":"17.42"}'
201  {"transaction":{...,"amountMinor":1742,"currency":"GBP",...}}

$ curl -s $URL/api/wallets/gbp-main        # separate request
{"wallet":{"id":"gbp-main",...,"balanceMinor":1742,"balanceFormatted":"£17.42"}}
```

This is the failure #5 existed to prevent: on the pre-Redis build the second
request could land on another instance and report `£0.00`.

### Live-rate conversion, end to end

```
$ curl -s "$URL/api/rates?from=USD&to=IDR"
{"from":"USD","to":"IDR","rate":"18114","date":"2026-11-09"}

$ curl -X POST $URL/api/conversions -d '{"fromWalletId":"usd-main","toWalletId":"idr-main","amount":"100.00"}'
201  {"type":"CONVERSION","amountMinor":10000,"currency":"USD",
      "targetAmountMinor":1811400,"targetCurrency":"IDR",
      "rate":"18114","rateDate":"2026-11-09"}
```

One ledger entry carrying both legs, with the rate stored as the exact decimal
string Frankfurter quoted. $100.00 × 18,114 = IDR 1,811,400. Correct.

**Criterion 8: met.** Nothing in §2 of this document is now untested against the
real service.

---

## Defect found by deploying: the minor-unit exponent is runtime-dependent

Deploying surfaced something no local test could, and it is the most important
result in this document.

`decimalsFor` reads
`Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`, exactly as the
brief instructs. That value comes from the CLDR data bundled with the Node
build — and **CLDR changed IDR from 2 fraction digits to 0.**

| Runtime | `decimalsFor("IDR")` | The stored integer `1811400` renders as |
| --- | --- | --- |
| Local, Node 22.2.0 | `2` | `IDR 18,114.00` |
| Vercel production | `0` | `IDR 1,811,400` |

Measured both ways. The deployed value was not read from a table — it was
derived from live output: `balanceMinor: 1811400` rendering as `IDR 1,811,400`
with no decimal separator is only possible at exponent 0, and the conversion
arithmetic agrees, since `10000 × 18114 × 10^(0−2) = 1811400`.

**Why this is worse than a formatting quirk.** `amountMinor` is an integer whose
meaning depends on the exponent in force when it was written. Each environment
is self-consistent, so each looks correct in isolation. But the ledger is now
**shared and persistent**, so the same row read by the other runtime is wrong by
100×. The README's own `vercel env pull` instructions point local development at
the production store — the exact configuration that triggers it.

It was latent and harmless while the ledger lived in one process. #5 made it
real, and nobody noticed, because every test runs on one runtime.

**No data is currently corrupt.** Neither seeded wallet with a nonzero opening
balance is IDR, and the single IDR row was written and read under the same
0-exponent runtime.

**Proposed fix, not applied:** pin the exponent per supported currency in a
constant table, keep `Intl` for display only, and record the exponent on each
ledger entry so historical rows stay readable if the table changes. This
reverses an explicit instruction in the brief ("take decimals from `Intl`"), so
it is the owner's decision, not the agent's.

### A second correction this produced

The README carried a *Known limitations* bullet stating CLDR gives IDR two
fraction digits and that "IDR balances are held in sen". That is true locally
and **false in production**. Replaced with the measured table above.

The agent also told the owner, mid-deploy, to expect `USD Main $3,000.00` and
`USD Savings $900.00`, and that all six wallets would be non-zero. Both wrong:
those figures were read off the **local dev server**, whose in-memory ledger had
this session's acceptance transactions applied to it, and only four wallets
receive an opening deposit. Following that check would have made a correct
deployment look broken. The authoritative source was `seed.ts`, which should
have been read first.

## Secondary fixes, both found by checking a claim

| Claim in the README | What checking it showed |
| --- | --- |
| "with the reason in the build log" | True, but buried under a misleading headline — now quoted in full (§6) |
| "Concurrency is only as safe as one Node process" | Stale since #5, and contradicted the Redis-aware bullet three lines above it — removed |
| "a file or SQL adapter can replace it without touching the service layer" | #5 actually kept this promise, so it now states the tested outcome rather than the aspiration |
