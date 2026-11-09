# ISSUE-8 — Deploy to Vercel, and document the setup so anyone can run it

- **Issue:** [#8](https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/issues/8)
- **Branch:** `development/feature/vercel-deployment`
- **Depends on:** #5 (Redis ledger), merged as `249dd4d`
- **Status:** implemented and verified locally; the deploy itself is blocked on
  credentials the owner holds

## Why this exists

The Redis work introduced the first configuration this project has ever had.
Before it, `npm install && npm run dev` was the entire story. Afterwards the
app's behaviour depends on which environment variables are present — and that
branch point was documented only inside `container.ts` and a PR body. Someone
reading the repository cold could not see it.

The requirement from the owner was two-part: keep the Vercel credentials in a
`.env` file rather than anywhere they could be committed, and put the run
instructions in `README.md` "so everyone knows how to run this project".

## Scope

| In | Out |
| --- | --- |
| `.env.example`, committed, declaring every variable the code reads | Fixing the cross-instance write race (#5 documented it; still open) |
| `.gitignore` exception so the template is not swallowed by `.env*` | Any change to application code — there is none in this branch |
| `README.md`: local run, env var reference, deploy path, failure mode | Idempotency keys, a quote endpoint (README § *With more time*) |
| Proof that the Vercel-without-Redis failure is loud and legible | |

## Decisions

### `.env.local`, not `.env`

Both are read by Next.js and both are gitignored here. `.env.local` was chosen
because **`vercel env pull` writes to that exact filename by default**. Pick
`.env` instead and the first person to pull the real configuration down ends up
with two files that disagree, with `.env.local` silently winning. The README
says `.env` also works, for anyone who prefers it.

### The template is annotated, not minimal

A bare list of names tells a reader what to set but not where to get it. Each
block in `.env.example` names its source (Vercel Storage, the Upstash console,
Vercel → Account → Tokens) and what happens when it is absent.

One warning earned its place: **the adapter speaks Upstash's HTTP REST API, not
the Redis wire protocol**, so a local `redis-server` or the `redis` Docker image
cannot stand in. That cost real time to discover in #5 and is exactly the wrong
assumption a competent engineer would make unprompted.

### `VERCEL` is documented as "never set this yourself"

It appears in the table because the code reads it and a reader will find it. But
setting it locally makes local development refuse to start, for the same reason
it is meant to protect production. Listing it without that warning would be a
trap.

### Two audiences, separated

The old README had one paragraph covering both. They need opposite things:

- running it locally needs **no credentials at all**
- deploying needs **both**, and in a specific order

Documenting only the deploy path would imply a reviewer needs an Upstash
account to run the tests. That is false, and it would cost an interviewer time
for nothing.

## Two corrections made along the way

Both were found by checking a claim rather than trusting it.

1. **The build failure's reason is buried.** The README first said the failure
   comes "with the reason in the build log". Running it showed Next prints a
   generic `Failed to collect page data for /api/transfers` headline, with the
   real message one line below under `[cause]`. The README now quotes the actual
   output, so whoever hits it knows to look down a line.

2. **A stale README bullet contradicted the Redis change.** *"Concurrency is
   only as safe as one Node process"* survived #5 three bullets below the
   Redis-aware *"Concurrent writes can race"*, which says the opposite. Removed.
   The *"Storage sits behind an interface"* paragraph still promised that "a
   file or SQL adapter can replace it without touching the service layer" — a
   promise #5 actually kept, so it now states the tested outcome instead of the
   aspiration.

## Acceptance

Full evidence in [`../ai_reviews/ISSUE-8-acceptance.md`](../ai_reviews/ISSUE-8-acceptance.md).

## Outcome

**Live:** <https://coconut-labs-coding-test-internatio.vercel.app/>

Deployed from `main` at `249dd4d` through the Vercel dashboard, with Upstash
attached via the Marketplace integration against the owner's existing account.
All eight acceptance criteria met; the URL is now in the README.

Verified against the real service for the first time: seeding ran exactly once
on a cold start (`seed-1`..`seed-4`, no duplicates), a deposit written by one
request was read back by another, and a live-rate USD→IDR conversion produced a
single two-legged ledger entry at the quoted rate.

**Deploying also exposed a defect, which is the most valuable thing this issue
produced.** `decimalsFor` derives a currency's minor-unit exponent from the
runtime's CLDR data, and local Node 22.2.0 gives IDR 2 fraction digits while
Vercel's runtime gives 0. Each environment is self-consistent; a *shared* ledger
is not, so the same stored integer is off by 100× across them. Latent until #5
made the ledger persistent. Documented in the README under *Known limitations*
and in full in the acceptance record; the fix reverses an instruction in the
brief and is therefore the owner's decision.

Follow-up worth opening as its own issue: pin the minor-unit exponent per
currency and record it on each ledger entry.
