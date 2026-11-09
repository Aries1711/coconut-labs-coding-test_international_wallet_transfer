# ISSUE-2 — acceptance run

- **Issue:** https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/issues/2  ·  **Branch:** `development/feature/wallet-filter-click-select`
- **Run on:** 2026-11-09, working tree (uncommitted, awaiting review)
- **Result:** 8 passed, 0 failed

## Criteria

| # | Criterion | Command | Result |
| --- | --- | --- | --- |
| 1 | No native `<select>` left in the app | `grep -rn "<select" src --include="*.tsx"` → only comments; `WalletActions.test.tsx` asserts `querySelectorAll("select")` is empty | PASS |
| 2 | All six pickers are listbox triggers | `WalletActions.test.tsx` counts `aria-haspopup="listbox"` → 6 | PASS |
| 3 | Panel anchored to trigger, matching width | `Listbox` panel is `absolute left-0 right-0` inside a `relative` wrapper — it cannot detach from or mismatch its trigger | PASS (structural) |
| 4 | Option text uses the app's type scale | panel and options are `text-sm`, same as the rest of the UI; nothing OS-rendered | PASS (structural) |
| 5 | Keyboard: Escape, arrows, Enter | `Listbox.test.tsx` — three cases | PASS |
| 6 | Outside click closes without selecting | `Listbox.test.tsx` | PASS |
| 7 | One shared component | `components/Listbox.tsx`, consumed by `WalletFilter.tsx` and `WalletActions.tsx` | PASS |
| 8 | Suite, types, lint, build | `npm test` **69 passed** · `tsc --noEmit` clean · `eslint src` clean · `next build` compiled | PASS |

## Evidence the refactor did not change behaviour

ISSUE-1's seven `WalletFilter` tests were written against the old inline
implementation and were **not modified**. They still pass against the extracted
shared component, which is what makes this a refactor rather than a rewrite.

Component suite: 19 tests (Listbox 8, WalletFilter 7, WalletActions 4).

## Live check

Against the running dev server:

```
/              -> 200
/transactions  -> 200
native <select> elements served on / : 0
aria-haspopup="listbox" triggers on / : 6
```

## Failures and fixes

None in this run. The underlying defect (mousedown blur dropping the click) was
found and fixed under ISSUE-1; this issue moved that fix into shared code so
the Wallets page inherits it.

## Not covered

- **No real browser or real device.** Criteria 3 and 4 are verified
  structurally — by what the markup and classes can do — not by a screenshot at
  440px. jsdom has no layout engine, so "does not jump" cannot be asserted by
  measurement here. What *can* be said is that the OS-rendered panel, which was
  the cause, no longer exists anywhere in the app.
- Pointer-capture behaviour on a physical touch device.
