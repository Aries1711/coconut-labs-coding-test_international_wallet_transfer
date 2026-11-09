# ISSUE-1 — Wallet filter on /transactions drops the selected option

- **Issue:** https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/issues/1
- **Branch:** `development/feature/wallet-filter-click-select`
- **PR:** not yet opened
- **Status:** in progress

## What was asked

Clicking a wallet in the "Filter by wallet" dropdown on `/transactions` does
nothing — the list closes and neither the table nor the URL changes.

## Acceptance criteria

- [ ] Clicking an option filters the table and updates the URL to `?walletId=<id>`
- [ ] Choosing "All wallets" returns to the unfiltered view
- [ ] Clicking outside the panel still closes it without selecting
- [ ] Escape still closes it; arrow keys + Enter still select
- [ ] A DOM-level test covers click-to-select
- [ ] `npm test`, `npm run typecheck` and `npx eslint src` pass

## Scope changes

| When | Change | Who asked | Why |
| --- | --- | --- | --- |
| 2026-11-09 | Add jsdom + Testing Library as dev dependencies | agent's call | The component cannot be verified any other way in this environment, and this is the control's third defect. Recorded per AGENTS.md § Stack. |

## Decisions while implementing

**Root cause** is the container's `onBlur` guard: a `<li>` is not focusable, so
mousedown on an option blurs the trigger with `relatedTarget === null`, the
guard reads that as focus leaving the component, and the list unmounts on
mousedown — before the option's `click` can fire.

**Rejected:** selecting on `mousedown` instead of `click`. It would work, but it
breaks the expected press-and-drag-off-to-cancel behaviour and diverges from
how a real listbox behaves.

**Rejected:** deleting the `onBlur` guard. It is what closes the panel when a
keyboard user tabs away; removing it trades one accessibility bug for another.

**Chosen:** `onMouseDown={preventDefault}` on the list, the standard listbox
technique. Focus never leaves the trigger, so no blur fires, the list stays
mounted and the `click` lands. The `onBlur` guard is kept intact for genuine
tab-away.

See `../ai_logs/2026-11-09.md`.

## Outcome

Pending review.
