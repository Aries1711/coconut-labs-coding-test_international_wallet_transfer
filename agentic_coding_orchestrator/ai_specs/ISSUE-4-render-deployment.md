# ISSUE-4 — Host on Render so the reviewer can open a live URL

- **Issue:** https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/issues/4
- **Branch:** `development/feature/render-deployment`
- **PR:** pending
- **Status:** awaiting review

## What was asked

Deploy the app so the interviewer can check it directly instead of running it
locally. The owner first asked about Vercel, then about GitHub Pages.

## Acceptance criteria

- [x] `render.yaml` blueprint with correct build/start commands
- [x] Node version pinned so the host cannot pick one Next 16 rejects
- [x] README documents deployment and the sleep/reset behaviour
- [x] A record of why Pages and Vercel-as-is were rejected
- [x] Production bundle verified via `npm run build` + `npm start`
- [x] Tests, typecheck, lint pass

## Scope changes

| When | Change | Who asked | Why |
| --- | --- | --- | --- |
| 2026-11-09 | Target Render instead of Vercel | owner, after review of the trade-offs | Vercel's serverless model is incompatible with the in-memory ledger without a persistence adapter |
| 2026-11-09 | GitHub Pages investigated and ruled out | owner asked | Static-only; the static export fails on all nine route handlers |

## Decisions while implementing

**GitHub Pages was tested, not assumed.** `output: "export"` was added
temporarily and the build run; it fails collecting page data for the API
routes. The config was restored immediately. Evidence beats assertion, and the
owner deserved a real reason rather than "it won't work".

**Vercel rejected for now, not forever.** It is the natural host for Next.js;
the blocker is that the ledger lives in `globalThis` and serverless gives no
instance affinity. The honest fix is a persistent `WalletRepository` — exactly
the swap the layered architecture exists to make cheap — but it requires the
interface to become async, rippling through use cases and tests. Recorded as a
follow-up rather than rushed in before a deadline.

**Verified the two things Render depends on** before recommending it, against a
local production build: `next start` honours `$PORT` with no `-p` flag, and a
POST is visible both to the next GET and to the server-rendered dashboard.

**Rejected:** changing the `start` script to `next start -p $PORT`. Unnecessary
(Next reads `PORT` itself) and it would break a bare `npm start` locally when
`PORT` is unset.

## Outcome

Pending review and the owner creating the Render service.
