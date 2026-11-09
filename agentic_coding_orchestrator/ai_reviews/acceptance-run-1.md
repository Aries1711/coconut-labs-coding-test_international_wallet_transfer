# Acceptance run 1 — API + pages

Executed against `npm run dev` (port 3001; 3000 was occupied) with a freshly
seeded store, as a scripted curl pass. 31 checks, **31 passed, 0 failed**.

## Covered

| Area | Checks |
| --- | --- |
| Wallets | list, by id, unknown id → 404 |
| Deposit | valid, >decimals for USD and for JPY, zero, negative, missing field |
| Withdraw | overdraft → 422, valid |
| Transfer | same currency ok, cross-currency → 422, same wallet → 422, unknown wallet → 404 |
| Conversion | USD→JPY recorded with rate + rateDate, same currency → 422, rounds-to-zero → 422, overdraft → 422 |
| Rates | valid pair, unsupported code → 400 |
| Transactions | filtered list, unknown wallet filter → 404, by id, unknown id → 404 |
| Balances | derived values asserted exactly after the full sequence of operations |
| Pages | `/`, `/transactions`, `/transactions/[id]`, unknown transaction → 404 |

## Evidence worth keeping

Conversion of `$10.00` at the live rate `158.26`:

```json
{"type":"CONVERSION","fromWalletId":"usd-main","toWalletId":"jpy-main",
 "amountMinor":1000,"currency":"USD","targetAmountMinor":1583,
 "targetCurrency":"JPY","rate":"158.26","rateDate":"2026-11-09"}
```

`1000 × 158.26 × 10^(0−2) = 1582.6 → 1583` confirms half-up rounding across a
2-decimal → 0-decimal pair, and the rate is stored as the exact quoted string.

Derived balances after deposit `100.50`, transfer `50.00` out and conversion
`10.00` out of a seeded `$2,500.00`: `balanceMinor: 254050` — i.e. the fold over
the ledger, not a stored counter.

## Failures in this run

Four page checks failed on the first attempt (`500`) while all API checks passed.
Both causes and fixes are in `ai_logs/2026-11-09.md`; re-run after the fix gave
31/31.

## Not covered here

Frankfurter timeout and malformed-response paths are covered by unit tests with
`fetch` stubbed (`src/lib/service/wallet.test.ts`), not by this run — the live
endpoint was up throughout. Double-submit is handled in the UI by disabling the
button while a request is in flight and was exercised by hand, not scripted.
