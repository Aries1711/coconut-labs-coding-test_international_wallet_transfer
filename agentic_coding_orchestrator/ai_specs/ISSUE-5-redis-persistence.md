# ISSUE-5 — Persist the ledger in Redis so the app runs correctly on Vercel

- **Issue:** https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/issues/5
- **Branch:** `development/feature/redis-persistence`
- **PR:** https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/pull/7
- **Status:** awaiting review

## What was asked

Move off the Render plan and host on Vercel, applying the Redis persistence
that Vercel's serverless model requires. Supersedes ISSUE-4.

## Acceptance criteria

- [x] `WalletRepository` async; use cases, routes and pages updated
- [x] `RedisWalletRepository` stores and reads back the append-only ledger
- [x] Seeding happens exactly once, not on every cold start
- [x] `container.ts` selects Redis when configured, memory otherwise
- [x] Redis adapter unit tested against a fake client
- [x] Nothing in `domain/` or `application/` imports anything Redis-specific
- [x] Suite, typecheck, lint and production build pass
- [x] Deployment and env vars documented

## Scope changes

| When | Change | Who asked | Why |
| --- | --- | --- | --- |
| 2026-11-09 | Abandon Render, return to Vercel + Redis | owner | Render's setup was judged too complex |
| 2026-11-09 | Throw at startup on Vercel without Redis | agent's call | A silent fallback to memory would make a broken deploy look healthy while losing transactions |
| 2026-11-09 | Extract `repositories/seed.ts` | agent's call | Both adapters need the same seed data; duplicating it would let them drift |
| 2026-11-09 | Cap the Upstash retry policy | agent's call | Five retries with backoff can outlast a serverless request |

## Decisions while implementing

**Depend on a `RedisLike` slice, not on `@upstash/redis`.** The adapter takes a
three-method interface (`rpush`, `lrange`, `set`), so it is fully unit-testable
against a fake and swapping clients touches only the container. The real client
is constructed in `container.ts`.

**Ledger as a Redis list.** `RPUSH` to append, `LRANGE 0 -1` to read.
Append-only falls out of the data structure rather than being a convention.

**Seed guarded by `SET NX`.** Atomic, so concurrent cold starts cannot each
write their own copy of the opening deposits. Getting this wrong would conjure
money out of nothing on every scale-out.

**Rejected: keeping the interface synchronous** with a write-behind cache. It
would have avoided the async ripple through ~15 files, but a cache that lies
about durability in a wallet is precisely the wrong trade.

**Rejected: a per-wallet lock, for now.** The read-balance-then-append sequence
can race across instances. A `SET NX PX` lock or a Lua check-and-append is the
real fix; it is recorded as a known limitation in both the README and
`ai_docs/deployment.md` rather than quietly shipped as "fine".

**Tolerate both response shapes from Upstash.** It returns list members already
parsed when they are JSON, depending on configuration, so the adapter accepts a
string or an object. There is a test for each.

## Outcome

On PR #7 as `0c08fdf`, awaiting manual review before merge. Deployment
still needs the owner to create the Upstash store in Vercel.
