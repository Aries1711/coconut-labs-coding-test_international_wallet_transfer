# ISSUE-1 — acceptance run

- **Issue:** https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/issues/1  ·  **Branch:** `development/feature/wallet-filter-click-select`
- **Run on:** 2026-11-09, working tree (uncommitted, awaiting review)
- **Result:** 6 passed, 0 failed

## Criteria

| # | Criterion | Command | Result |
| --- | --- | --- | --- |
| 1 | Clicking an option filters and updates the URL | `npx vitest run src/test/components` — *"applies the selection when an option is clicked"* asserts `push("/transactions?walletId=jpy-main")` | PASS |
| 2 | "All wallets" returns to the unfiltered view | same suite — asserts `push("/transactions")` | PASS |
| 3 | Outside click closes without selecting | same suite — listbox unmounts, `push` not called | PASS |
| 4 | Escape closes; arrow keys + Enter select | same suite — two cases | PASS |
| 5 | DOM-level test exists so this cannot regress again | `src/test/components/WalletFilter.test.tsx`, 7 cases | PASS |
| 6 | Suite, types, lint, build | `npm test` 57 passed · `tsc --noEmit` clean · `eslint src` clean · `next build` compiled | PASS |

## The test was written before the fix, and failed

This is the evidence that matters, given the control has now broken three times:

```
 Tests  2 failed | 5 passed (7)
 FAIL  > applies the selection when an option is clicked
 FAIL  > returns to the unfiltered view when 'All wallets' is clicked
 AssertionError: expected "spy" to be called with arguments: [ '/transactions' ]
 Number of calls: 0
```

Exactly the two mouse-selection cases failed while keyboard, Escape and
outside-click passed — which is the fingerprint of the root cause rather than a
guess at it. After the one-line fix: `Tests 7 passed (7)`.

## Failures and fixes

**Root cause.** The container's `onBlur` guard closed the list whenever focus
left the component. An `<li>` is not focusable, so pressing the mouse on an
option blurred the trigger button with `relatedTarget === null`; the guard read
that as leaving the component and unmounted the list on **mousedown**, before
the option's `click` handler could run. The selection was dropped silently.

**Fix.** `onMouseDown={(event) => event.preventDefault()}` on the `<ul>`. Focus
never leaves the trigger, so no blur fires, the list stays mounted, and the
click lands. The `onBlur` guard is untouched and still closes the panel when a
keyboard user tabs away.

## Live check

Against the running dev server, URL-driven filtering is unchanged
(`?walletId=` → 11 rows, `usd-main` → 6, `jpy-main` → 2) and the trigger
renders with `aria-haspopup="listbox"` / `aria-expanded="false"`.

## Not covered

- **No real browser.** jsdom simulates the event sequence faithfully enough to
  catch this class of bug — it reproduced the defect before the fix — but it is
  not a human clicking in Safari or Chrome. Worth one manual click to confirm.
- **Touch.** The outside-close handler listens for `pointerdown`, which covers
  touch, but jsdom's pointer emulation is not a real touch device.
