# ISSUE-5 — acceptance run

- **Issue:** https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/issues/5  ·  **Branch:** `development/feature/redis-persistence`
- **Run on:** 2026-11-09, local
- **Result:** 8 passed, 0 failed (deployment itself not performed — needs the owner's Vercel/Upstash account)

## Criteria

| # | Criterion | Command | Result |
| --- | --- | --- | --- |
| 1 | Interface async, call sites updated | `tsc --noEmit` | PASS — clean |
| 2 | Redis adapter stores and reads the ledger | `RedisWalletRepository.test.ts`, 10 cases against a fake client | PASS |
| 3 | Seeding happens exactly once | same suite — repeated reads and a second instance leave the list length unchanged; asserts `SET NX` is used | PASS |
| 4 | Container selects the right adapter | `container.test.ts`, 4 cases | PASS |
| 5 | No silent fallback on Vercel | `container.test.ts` — importing with `VERCEL=1` and no Redis throws; with Redis configured, reads go to Redis and fail against a dead address rather than falling back | PASS |
| 6 | Layers stay clean | `grep -rnE "from \"@upstash\|new Redis\|createRedisWalletRepository" src/domain src/application` | PASS — no imports, no symbols |
| 7 | No behavioural regression | 31-check acceptance script vs `next start` | PASS — **31/31** |
| 8 | Suite, lint, build | `npm test` **83 passed** · `eslint src` clean · `next build` compiled | PASS |

## Evidence for criterion 6

The point of the exercise was that persistence is an infrastructure concern:

```
$ grep -rnE "from \"@upstash|new Redis|createRedisWalletRepository" src/domain src/application
(no matches)
```

No import and no symbol from the Redis world reaches the inner layers. One
*comment* in `WalletRepository.ts` names Redis as an example of why the
interface is async — prose, not a dependency.

The async change is visible in those layers; the storage technology is not.

## Failures and fixes

**Two container tests initially asserted the wrong thing.** They expected
`listWallets()` to resolve when Redis was configured, on the assumption that
wallets are static configuration. They are — but `listWallets` also folds the
ledger, so it does reach the network. Rewritten to assert the call *fails*
against a dead address, which is the stronger claim: reads go to Redis and do
not silently fall back to memory.

**The Upstash client retried five times with backoff**, making those two tests
take ~4.3s each. Capped to two retries in the container — better for tests and
for serverless requests, which must not hang.

## Not covered

- **No real Redis was contacted.** The adapter is tested against a fake
  implementing the same three operations, and Docker cannot help here because
  Upstash speaks HTTP rather than the Redis wire protocol. First contact with
  a real store will happen on deploy; the seeding and read paths are the ones
  to watch.
- **The deployment has not happened** — it needs the owner's Vercel account and
  an Upstash store. No Vercel CLI, token or login exists in this environment.
- **The write race is not fixed**, only documented: two concurrent withdrawals
  can both pass the funds check across instances.
