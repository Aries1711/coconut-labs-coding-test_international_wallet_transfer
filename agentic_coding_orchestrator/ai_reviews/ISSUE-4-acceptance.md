# ISSUE-4 — acceptance run

- **Issue:** https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/issues/4  ·  **Branch:** `development/feature/render-deployment`
- **Run on:** 2026-11-09, local production build
- **Result:** 6 passed, 0 failed (deployment itself not yet performed — needs the owner's Render account)

## Criteria

| # | Criterion | Command | Result |
| --- | --- | --- | --- |
| 1 | Production bundle builds | `rm -rf .next && npm run build` | PASS — compiled, 13 routes |
| 2 | Full API + pages work against the production server | `npx next start` + the 31-check acceptance script | PASS — **31/31** |
| 3 | `next start` binds the host's `$PORT` with no `-p` | `PORT=3011 npx next start` → log reads `Local: http://localhost:3011` | PASS |
| 4 | State is consistent across requests in one process | `POST /api/deposits` 42.00 GBP → `GET /api/wallets/gbp-main` → `GET /` | PASS — `£42.00` from the API *and* in the dashboard HTML |
| 5 | GitHub Pages ruled out on evidence | temporary `output: "export"` build | PASS — fails on all nine route handlers; config restored |
| 6 | Suite, types, lint | `npm test` 69 passed · `tsc --noEmit` clean · `eslint src` clean | PASS |

## Evidence for criterion 4

This is the whole reason for choosing a long-lived process over serverless:

```
POST deposit 42.00 GBP -> 201
GET  balance after     -> £42.00
dashboard HTML shows   -> £42.00
```

The write, the API read and the server-rendered page all agree, because they
share one process's memory. On a serverless host there is no such guarantee.

## Failures and fixes

**The static-export probe left `.next` unusable**, so the first `next start`
after it failed with "Could not find a production build". Not a defect in the
app — a failed export build overwrites the output directory. Fixed by
rebuilding. Worth knowing: after any aborted or experimental build, rebuild
before trusting `next start`.

## Not covered

- **The deployment itself has not happened.** It needs the owner's Render
  account; no Render CLI, API key or login exists in this environment. Criteria
  above verify the app is deployable, not that it is deployed. The live URL
  must be checked once the service exists.
- Cold-start timing and sleep/wake behaviour on the free tier are described
  from Render's documented behaviour, not measured.
