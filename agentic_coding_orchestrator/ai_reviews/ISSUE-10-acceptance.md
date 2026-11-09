# ISSUE-10 acceptance — pin the minor-unit exponent

- **Issue:** [#10](https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/issues/10)
- **Branch:** `development/feature/pin-minor-unit-exponent` (from `main` at `891f0d0`)
- **Spec:** [`../ai_specs/ISSUE-10-pin-minor-unit-exponent.md`](../ai_specs/ISSUE-10-pin-minor-unit-exponent.md)
- **Date:** 2026-11-09
- **Environment:** macOS, Node 22.2.0, Next.js 16.4.5

## Result

| # | Criterion | Verdict |
| --- | --- | --- |
| 1 | `decimalsFor` reads a constant table, not `Intl` | ✅ |
| 2 | Table covers every supported currency, enforced by the type system | ✅ proven by a deliberate compile error |
| 3 | `decimalsFor("IDR") === 0` on this runtime, where it previously returned `2` | ✅ |
| 4 | `formatMinor` still correct for all seven currencies | ✅ |
| 5 | The exponent-2 assertions recomputed and justified arithmetically | ✅ 4 of them |
| 6 | A test documents why the table is pinned | ✅ |
| 7 | Local output matches production for the live IDR row | ✅ byte-identical |
| 8 | `npm test`, `typecheck`, `lint`, `build` pass | ✅ 84/84, clean |
| 9 | README and `AGENTS.md` corrected | ✅ |

## 1, 3 — the failing test came first

The test was written and run **before** `Money.ts` was touched, so the failure
is evidence of the bug on this machine rather than a description of it:

```
× decimalsFor > returns the pinned exponent for every supported currency
  → expected [ 2, 2, 2, +0, 2, 2, 2 ] to deeply equal [ 2, 2, 2, +0, 2, 2, +0 ]
× decimalsFor > does not follow the runtime when Intl disagrees with the table
  → expected 2 to be +0
× convertMinor > converts across differing decimal places
  → expected 18116000 to be 181160
× convertMinor > keeps full precision on large low-denomination amounts
  → expected 6530000 to be 653000000

Tests  4 failed | 80 passed (84)
```

The last element of that first array — `2` where the table says `0` — **is** the
defect, printed by the runtime that has it. Note that exactly four tests failed
and all four are IDR; nothing else in the suite depended on the exponent being
derived.

## 5 — the recomputed values were derived, not copied from a run

Copying a new expected value out of a failing test run proves only that the code
agrees with itself. Each was recomputed from
`targetMinor = roundHalfUp(sourceMinor × rate × 10^(targetDec − sourceDec))`:

| Case | At exponent 0 for IDR | Sanity check |
| --- | --- | --- |
| `convertMinor(1000, "18116", "USD", "IDR")` | `1000 × 18116 × 10^(0−2)` = **181,160** | $10.00 at 18,116 IDR/USD = IDR 181,160 ✅ |
| `convertMinor(1e9, "0.00653", "IDR", "USD")` | `1e9 × 653 × 10^(2−0) / 10^5` = **653,000,000** | IDR 1bn at 0.00653 = $6,530,000.00 ✅ |
| `convertMinor(1, "0.0094", "IDR", "JPY")` | `(2×94 + 10^4) / (2×10^4)` = **0** | unchanged — correct before and after |

The third is worth noting: it did **not** change, because IDR and JPY both have
exponent 0 so the shift is zero either way. A blanket "update the IDR tests"
would have changed it anyway and hidden that.

## A knock-on the suite caught on its own

After the fix, one further test failed — not one that was edited:

```
FAIL  walletUseCases > convertCurrency > refuses a conversion that rounds away to nothing
AppError: IDR amounts cannot have decimal places.
  ❯ parseAmountToMinor src/domain/entities/Money.ts:67:11
```

It deposited `"0.01"` IDR, which was valid at exponent 2 and is correctly
rejected at exponent 0. The test's *intent* is to exercise `ROUNDS_TO_ZERO`, so
it now uses `"1"` — the smallest IDR unit there is. `IDR 1 × 0.0094 = 0.0094`
JPY still rounds to nothing, so the case it was written to cover is intact.

This is the behaviour change predicted in the issue as a risk ("IDR amounts with
decimal places stop being accepted"), surfacing exactly where expected.

## 2 — totality is enforced by the compiler, not by a test

Claiming "the type system prevents a missing exponent" is cheap. It was proven
by temporarily adding an eighth currency with no entry in the table:

```
$ # added "CHF" to SUPPORTED_CURRENCIES, nothing else
$ npm run typecheck
src/domain/entities/Money.ts(30,7): error TS2741: Property 'CHF' is missing in
type '{ USD: number; EUR: number; GBP: number; JPY: number; SGD: number;
AUD: number; IDR: number; }' but required in type
'Record<"USD" | "EUR" | "GBP" | "JPY" | "SGD" | "AUD" | "IDR" | "CHF", number>'.
```

Reverted immediately; `git diff` on `Currency.ts` is empty and `tsc` is clean.
This is also why the old `?? 2` fallback was dropped — it would have turned a
missing currency into silently wrong money instead of a build failure.

## 7 — local now matches production byte for byte

The strongest available check, using the exact value that exposed the bug. The
same amount was deposited into the local IDR wallet and compared with the
production row:

```
LOCAL (after the fix):
{"wallet":{"id":"idr-main",...,"balanceMinor":1811400,"balanceFormatted":"IDR 1,811,400"}}

PRODUCTION (still running the unfixed main):
{"wallet":{"id":"idr-main",...,"balanceMinor":1811400,"balanceFormatted":"IDR 1,811,400"}}
```

Identical. Before the fix the local line read `IDR 18,114.00`.

Production agreeing *before* it has the fix is the point: production was never
wrong on its own, and pinning to `0` was chosen so the live ledger stays correct
with no migration.

## 4 — every currency still formats correctly

Live from the dev server, all six seeded wallets:

```
USD Main      $2,512.34      EUR    €500.00      JPY  ¥75,000
USD Savings   $1,000.00      GBP    £0.00        IDR  IDR 1,811,400
```

Symbols, grouping and fraction digits are all intact; JPY still shows no
decimals, and IDR now matches it. (USD Main is above its seeded `$2,500.00`
because the local in-memory ledger carries this session's test deposits.)

## 8 — standing checks

```
$ npm test
 Test Files  11 passed (11)
      Tests  84 passed (84)        # was 83; the pinning rationale test is new

$ npm run typecheck   # clean
$ npm run lint        # clean
$ npm run build       # compiled, 13 routes, only /_not-found static
```

## 9 — the documentation was the real risk

`AGENTS.md` is loaded by every future session, and it said:

> Decimals come from `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`,
> **never a hand-written table.**

and, in the gotchas:

> **CLDR gives IDR two fraction digits**, so IDR is held in sen […] **do not
> special-case it.**

Left alone, the next agent would have read those two instructions and reverted
this fix as if it were a bug — correctly, by the rules it was given. Both are
now inverted and cite #10, and the `Money.ts` comment and the pinning test both
say plainly: a runtime disagreeing with the table is the point, not a failure.

`ai_docs/original-brief.md` and `ai_docs/technical-plan.md` still describe the
`Intl`-derived approach and were **deliberately left unchanged** — they are
historical records of what was asked for and planned, and rewriting them would
destroy the evidence that this was a considered deviation.

## Not covered

- **Ledger rows still do not record their own exponent.** Changing an entry in
  the table would silently reinterpret existing rows. Safe today because the
  table is ours and IDR was pinned to the value production had already written.
  Documented in the README; worth doing if a currency is ever added.
- **The cross-instance write race from #5 is untouched** and still open.
- Production is still running the unfixed `main`; it behaves correctly because
  its runtime already resolved IDR to 0. Merging changes nothing observable
  there — the point is that it no longer *depends* on that.
