# Technical plan — multi-currency wallet

> **Superseded in part.** This records the plan as approved during the timed
> test, when the code lived under `src/lib/`. The folder structure was later
> refactored to a layered architecture at the owner's request — see
> `architecture.md`, which is the convention to follow now. Everything below
> about money handling, the ledger and the rate policy still holds; only the
> file layout changed.

Approved before implementation; this is the plan as agreed, with the one contract
change that implementation forced noted at the end.

## Shape

- Next.js App Router. Route handlers are the only API; `src/lib/service/wallet.ts`
  owns every rule. Pages are server components that call the service directly;
  client components only `fetch` and render.
- `WalletRepository` is the storage boundary and exposes exactly one write,
  `append`. In-memory implementation on `globalThis` (survives hot reload).

## Money

Integer minor units everywhere. Decimals per currency from
`Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`.

Parsing is string-only (`"8.70"` → `870`), rejecting anything that is not a
positive decimal with at most that many fraction digits.

Conversion:

```
targetMinor = roundHalfUp(sourceMinor × rate × 10^(targetDecimals − sourceDecimals))
```

computed as a BigInt fraction. Rejected alternative: `number` arithmetic with a
rounding helper — fine for USD/EUR, but USD→IDR at ~18,000 with a 5-decimal rate
puts intermediate products where float error is no longer invisible, and the
whole point of the exercise is that money math is exact.

Second rejected alternative: parsing Frankfurter's rate into a `number`. The
rate is extracted as a **raw decimal token from the response text** so the stored
rate is exactly what was quoted, and the BigInt path consumes it directly.

## Ledger

Append-only `Transaction` log is the source of truth; balances are folded from
it per read. A transfer or conversion is **one** entry carrying both legs, which
is what makes the two sides atomic without any transaction machinery. Rejected
alternative: two entries (debit + credit) — needs a grouping id and makes a
partially-written pair representable, which is exactly the failure mode to avoid.

## Rates

Frankfurter v2 (`/v2/rate/{BASE}/{QUOTE}`), 60s per-pair cache, 5s timeout.
Failure → `AppError("RATE_UNAVAILABLE", 503)` thrown *before* any append, so a
failed conversion leaves no trace. No fallback rate, ever.

## Contract change during implementation

`GET /api/transactions?walletId=` returns **404** for an unknown wallet rather
than an empty list, so a typo in the filter is visible instead of looking like an
empty history. The `/transactions` page tolerates it instead: it falls back to
all transactions and shows a notice, because a bookmarked stale wallet id should
not 500 a page.
