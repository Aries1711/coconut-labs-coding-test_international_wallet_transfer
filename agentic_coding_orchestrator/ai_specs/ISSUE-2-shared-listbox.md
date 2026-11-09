# ISSUE-2 — Wallet pickers on the Wallets page use native selects

- **Issue:** https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/issues/2
- **Branch:** `development/feature/wallet-filter-click-select` (shared with ISSUE-1; this work extracts the component that fix landed in)
- **PR:** not yet opened
- **Status:** awaiting review

## What was asked

The six wallet pickers in the Deposit/Withdraw/Transfer/Convert forms were
still native `<select>`s, so their panels rendered detached from the field with
tiny OS-scaled text — the defect already fixed on the history filter. Apply the
same solution, and make it hold across desktop and mobile.

## Acceptance criteria

- [x] All six pickers use the same listbox as the history filter
- [x] Panel anchored to its trigger, matching its width, at any viewport
- [x] Option text uses the app's type scale, identical across viewports
- [x] Escape closes; arrow keys move; Enter selects
- [x] Outside click/tap closes without selecting
- [x] The listbox lives in ONE shared component
- [x] DOM-level tests cover the shared component and both usages
- [x] Suite, types, lint and build pass

## Scope changes

| When | Change | Who asked | Why |
| --- | --- | --- | --- |
| 2026-11-09 | Extract `components/Listbox.tsx` rather than copy the pattern | agent's call | The owner asked for "the same solution". Copying it would let the two drift, and this control has already produced three defects. One component, two consumers. |
| 2026-11-09 | Disable the pickers while a request is in flight | agent's call | Consistency with the submit buttons; changing the wallet mid-request was possible before. |

## Decisions while implementing

**Why not a native `<select>` anywhere:** its open panel is rendered by the
OS/browser, so neither its position nor its font size can be controlled by page
CSS. This is now stated at the top of `Listbox.tsx` so the next person does not
reintroduce one.

**Width:** `Listbox` fills its container (`w-full` trigger, panel pinned
`left-0 right-0`) and the caller sets the width — `w-56` for the filter,
full-width inside the form cards. A fixed width inside the component was
rejected: it is what would break again when the layout changes.

**Rejected:** a headless component library. The brief constrains this project to
Tailwind with no component library, and the interaction is ~60 lines.

The `onMouseDown` preventDefault from ISSUE-1 moved into the shared component,
so both usages inherit the fix.

## Outcome

Pending review. Verified in `../ai_reviews/ISSUE-2-acceptance.md`.
