# Unit test run 1 — money, validation, rates, repo, service

`npm test` (Vitest 3.2.4, Node 22.2.0). **49/49 passed, 0 failed.** Six files,
one per module of the business-logic layers, deliberately separated
from routes and components so it is unit-testable without a server or a browser.

```
src/test/infrastructure/repositories/InMemoryWalletRepository.test.ts   7
src/test/infrastructure/repositories/FrankfurterExchangeRateRepository.test.ts   6
src/test/infrastructure/http/errorResponse.test.ts                      3
src/test/domain/Money.test.ts                                          12
src/test/application/useCases/walletUseCases.test.ts                   15
src/test/infrastructure/http/requestValidation.test.ts                  7
                                                                       --
                                                                       50
```

Test files live under `src/test/`, mirroring the layout of the code they test.
Counts updated after the layered-architecture refactor (see
`../ai_docs/architecture.md`): the suite grew to 50 because the use-case layer
now covers `ROUNDS_TO_ZERO` directly, and Frankfurter is faked at the
`ExchangeRateRepository` port instead of by stubbing `global.fetch`.

## Why these six files, and nothing else

Every file here holds a pure or near-pure function the app's correctness
depends on. What's deliberately **not** here:

- **API routes** (`src/app/api/**/route.ts`) — thin wrappers that parse,
  delegate to the service, and map errors. Covered by the scripted curl pass
  in `acceptance-run-1.md` (31 checks against a live `next dev` server), which
  exercises the real HTTP contract these unit tests cannot.
- **Components** (`WalletActions`, `WalletFilter`, `NavLinks`) — no DOM testing
  library (jsdom/Testing Library) is installed, and the brief's time budget
  went to the layer where a bug has a direct money consequence. Noted as a gap
  under "what this run does not cover."

## Test points by module

### `money.ts` — the money math (12 tests)

The rule under test is "money is never a float." Each test picks a value that
would expose a float if one had leaked in.

| Test point | What it would catch |
| --- | --- |
| `decimalsFor` reads USD=2, EUR=2, JPY=0, IDR=2 from `Intl` | A hard-coded decimals table silently drifting from the platform's own currency data |
| `parseAmountToMinor` parses `"10.50"`, `"0.01"`, `"1000"`, `"7"` (JPY), and a padded `" 2.5 "` | Off-by-one errors in the minor-unit conversion |
| `"8.70"` → exactly `870`, not `869`/`871` | The classic float trap (`0.1 + 0.2 !== 0.3`); this is the test that would fail first if `parseFloat` crept back in |
| rejects `"1.005"` for USD and `"100.5"` for JPY with `TOO_MANY_DECIMALS` | A withdrawal/deposit silently truncating a fraction of a cent instead of refusing it |
| rejects `"0"`, `"-5"`, `"abc"`, `""`, `"1e3"`, `"1,000"`, `"1.2.3"`, `"."` | Every malformed-amount shape the regex is meant to reject — `"1e3"` specifically guards against JS's own number-parsing leniency |
| `minorToDecimalString` / `formatMinor` round-trip without float artifacts | Display formatting is the one place a float is allowed to exist; this proves it does not feed back into anything stored |
| `divRoundHalfUp`: `5n/2n→3n`, `3n/2n→2n`, `1n/3n→0n` | Half-up rounds away from zero on an exact half, not banker's rounding and not truncation |
| `convertMinor` across USD→JPY, USD→EUR, USD→IDR, JPY→USD | Every direction a decimals-shift can go (fewer, more, and equal decimal places) |
| `convertMinor` on an exact half: `$10.00 @ 0.15 → 1.5 JPY → 2` | Rounding direction specifically at the boundary value, not just "rounds" in general |
| `convertMinor` returns `0` for `1 IDR @ 0.0094 → JPY` | The service layer's `ROUNDS_TO_ZERO` refusal depends on this returning exactly zero, not a rounding error that returns 1 |
| `convertMinor` on `1,000,000,000 IDR @ 0.00653` | Large-amount × small-rate precision — the scenario float arithmetic degrades on first |
| `convertMinor("not-a-rate", ...)` throws `RATE_UNAVAILABLE` | A corrupted rate string is refused, never coerced into `0` or `NaN` and silently applied |

### `errors.ts` — the one error→response mapping (3 tests)

| Test point | What it would catch |
| --- | --- |
| an `AppError` maps to its own status and `{error:{code,message}}` | A route returning the wrong status code, or a body shape that drifts from the documented contract |
| an unexpected `Error` maps to 500 `INTERNAL_ERROR`, and **its message is not in the response** | A stack trace or internal detail (the test uses a fake "database password") leaking to the client on an unhandled exception |
| a non-`Error` throw (a bare string) still maps cleanly | JS allows throwing anything; the mapping must not assume `instanceof Error` |

### `validation.ts` — request parsing (7 tests)

| Test point | What it would catch |
| --- | --- |
| a valid body parses to the typed shape | The zod schema accepting the documented contract |
| malformed JSON → `VALIDATION_FAILED` (400) | A client sending garbage crashing the route instead of getting a clean 400 |
| a missing field → `VALIDATION_FAILED`, **message names the field** | An unhelpful generic error when a specific one is cheap to produce |
| an empty string for a required field is rejected | zod's `min(1)` actually wired up, not just present in the type |
| the two-wallet shape (transfers/conversions) parses correctly | The schema used by the two money-moving routes, separately from the single-wallet one |
| `currencySchema` accepts all 7 supported codes | The curated currency list matches what `/api/rates` actually accepts |
| `currencySchema` rejects `"XXX"`, lowercase, empty, `null`, a number | Every shape of "not a valid currency code," including the easy-to-miss case-sensitivity one |

### `rates.ts` — the Frankfurter client and cache (6 tests)

| Test point | What it would catch |
| --- | --- |
| same currency on both sides returns `"1"` **without calling fetch** | A wasted network call, and incidentally proves the short-circuit is checked before the cache |
| a rate is stored as the **exact string** Frankfurter sent (`"0.893150000001"`), not reformatted | The single most important rates test: this value is not exactly representable as a float, so this is the test that fails first if the raw-text extraction regex were replaced with `JSON.parse` |
| a second lookup for the same pair does not call `fetch` again | The 60s cache is actually consulted, not just present in the code |
| a network failure throws `RATE_UNAVAILABLE` (503) | The "never invent a rate" rule on the transport-failure path |
| a non-2xx response throws `RATE_UNAVAILABLE` | The same rule on the HTTP-status-failure path |
| a 2xx response with an unexpected body throws `RATE_UNAVAILABLE` | The same rule when Frankfurter's contract itself changes shape |

### `repo/memory.ts` — the ledger store (7 tests)

| Test point | What it would catch |
| --- | --- |
| exactly the six documented wallets are seeded | A seed list drifting from the product brief |
| every seed entry is a real `DEPOSIT` transaction, never a bare number | The product rule "no untracked balance exists" enforced at the data layer, not just stated in docs |
| `getWallet` resolves a known id and returns `undefined` (not throws) for an unknown one | The service layer's 404 mapping depends on `undefined`, not an exception, coming back here |
| `append` assigns an id and a parseable ISO `createdAt`, and the entry becomes retrievable | The one write path actually writing something retrievable, not just returning an object |
| a previously returned entry is never mutated by a later `append` | Append-only in practice, not just in the type signature — this is what an in-place array mutation bug would break |
| `listTransactions(walletId)` includes an entry when the wallet is on *either* side | The exact bug class a transfer/conversion filter is prone to: matching only `fromWalletId` and missing credits |
| `listTransactions` returns newest first | The ordering the transaction-history page assumes without re-sorting itself |

### `service/wallet.ts` — every business rule (14 tests)

The layer every route calls into; these are the closest unit tests get to the
acceptance run, but exercise error *types*, not HTTP status codes.

| Test point | What it would catch |
| --- | --- |
| `convert` moves both legs in one entry and stores `rate`/`rateDate` | The core atomicity claim: one write describes both sides |
| `convert` writes nothing when Frankfurter fails (mocked rejection) | Money debited from the source wallet with the conversion never completing |
| `convert` rejects same-currency and overdraft **without writing** | Ledger stays exactly as it was on every refusal path, not just the happy path |
| `transfer` moves funds 1:1 and updates both balances | Transfer math, independent of any rate |
| `transfer` rejects cross-currency, same-wallet, and unknown-wallet | All three transfer-specific refusals in one assertion |
| `deposit` credits the wallet, `fromWalletId` is absent | Half of a deposit accidentally debiting something |
| `deposit` rejects an unknown wallet and a zero amount, writing nothing | Validation ordering — the wallet is checked before the ledger is touched |
| `withdraw` debits the wallet, `toWalletId` is absent | The withdrawal-side mirror of the deposit check |
| `withdraw` refuses to overdraw a zero-balance wallet and writes nothing | No-overdraft enforced at the smallest possible boundary (1 cent over 0) |
| `listWallets` / `getWallet` derive balances matching `balanceMinor` directly | The view layer's balance is never a second, independently-computed number |
| `getWallet` 404s for an unknown id | The exact error code and status the route depends on |
| `listTransactions` filtered to one wallet only returns entries touching it | Same filter-correctness property as the repo test, now through the service's own wrapper |
| `listTransactions("ghost")` and `getTransaction("missing")` both 404 | Both lookup-by-id paths refuse an unknown id the same way |
| a transaction round-trips by id after `deposit` | `getTransaction` returns the same object `deposit` just produced, not a stale copy |

## Deliberately not covered by this run

- **Route handlers and HTTP status codes** — covered instead by
  `acceptance-run-1.md`'s 31 live-server checks, which is the right tool for
  "does the wire contract hold," not a unit test's job.
- **Components** (`WalletActions`, `WalletFilter`, `NavLinks`) — would need
  jsdom + Testing Library, not currently installed; listed in the README's
  "with more time" section.
- **The concurrency re-check in `convert`** (added after the final review pass
  — balance is re-verified immediately before the ledger append, after the
  rate `await`) — provable only with two genuinely concurrent requests against
  the same process, which a synchronous unit test cannot construct. The code
  comment at the call site is the record of why it's there.
