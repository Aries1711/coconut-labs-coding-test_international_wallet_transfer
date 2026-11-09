# ISSUE-10 — Pin the minor-unit exponent

- **Issue:** [#10](https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/issues/10)
- **Branch:** `development/feature/pin-minor-unit-exponent` (from `main` at `891f0d0`)
- **Found by:** #8, by deploying — no local test could have caught it
- **Status:** implemented and verified

## The defect in one line

`amountMinor` is an integer whose meaning depends on an exponent that was never
written down — it was recomputed from a library at every read.

## Why it hid

`decimalsFor` read
`Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`, which the
brief explicitly asks for. That value ships with the Node build's CLDR data, and
CLDR moved IDR from 2 fraction digits to 0.

| Runtime | `decimalsFor("IDR")` | Stored `1811400` renders as |
| --- | --- | --- |
| Local, Node 22.2.0 | `2` | `IDR 18,114.00` |
| Vercel production | `0` | `IDR 1,811,400` |

**Each environment was internally self-consistent**, so each looked correct in
isolation, and every test passed on whichever runtime ran it. The bug required
**two runtimes and one shared ledger** to become observable. Until #5 there was
no shared ledger, so it was unreachable; #5 did not introduce the flaw, it
promoted it. The README's own `vercel env pull` workflow — point local
development at the production store — is precisely the configuration that
reaches it.

## The fix

`decimalsFor` now reads `MINOR_UNIT_EXPONENT`, a constant
`Record<Currency, number>` in `Money.ts`. Four call sites, all inside that one
file, so the blast radius was a single function.

`formatMinor` still uses `Intl` for symbol and grouping; it already received its
fraction digits as explicit arguments, so it follows the table with no change.

### Decisions

**IDR pinned to `0`, and that choice is load-bearing.**

- It matches the deployed runtime, so **the live ledger needed no migration**.
  The one IDR row in production was written at exponent 0 and remains correct.
- Pinning `2` instead would have reinterpreted live data by 100× and required a
  migration, for no benefit.
- It matches how rupiah are actually written. Sen left circulation decades ago.
  The README had carried a *Known limitations* bullet complaining about exactly
  this since the first version — the correct exponent and the realistic one
  turned out to be the same number.

**This contradicts a literal instruction in the brief**, which says to take
decimals from `Intl`. The argument for deviating: the brief's rule is right for
*display* and wrong for *stored* money, and the two were never separated.
`Intl` remains the source of truth for how an amount is rendered; it stops being
the source of truth for what a stored integer means. Stated in the PR as an
argued deviation rather than buried in a diff.

**The table is typed `Record<Currency, number>` rather than a lookup with a
fallback.** A `?? 2` default would turn a missing currency into silently wrong
money. Totality was verified, not assumed — see the acceptance record.

**Rejected: recording the exponent on every ledger entry.** It would make
historical rows self-describing, but `balanceOf` and `deltaFor` would then have
to normalise rows with differing exponents, and rescaling downward loses
precision. Several hours of work and real design risk, to hedge against a table
that is under our own control. Revisit when a currency is actually added. The
residual risk is now documented in the README rather than dropped.

## Scope

| In | Out |
| --- | --- |
| `Money.ts`: the table and `decimalsFor` | Any change to how `formatMinor` renders |
| 4 test assertions that encoded exponent-2 IDR | The cross-instance write race (#5, still open) |
| `README.md`, `AGENTS.md` corrections | `ai_docs/original-brief.md` and `technical-plan.md` — historical records, deliberately left as written |

**`AGENTS.md` mattered more than the code here.** Its domain rules said decimals
come from `Intl` "never a hand-written table", and its gotchas said IDR is held
in sen and to "not special-case it". Left alone, the next session would have
read those and reverted this fix as a bug. Both are now inverted and point at
#10.

## Acceptance

Full evidence in [`../ai_reviews/ISSUE-10-acceptance.md`](../ai_reviews/ISSUE-10-acceptance.md).

## Outcome

_To be completed when the branch is reviewed and merged._
