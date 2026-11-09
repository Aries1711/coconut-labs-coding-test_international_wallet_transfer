# AGENTS.md

Operating instructions for any agent working in this repository. Vendor-neutral
and the single source of truth — `CLAUDE.md` exists only so Claude Code loads
this automatically.

## What this is

A simulated multi-currency digital wallet. One user, no auth, holds wallets in
several currencies and can deposit, withdraw, transfer between same-currency
wallets, and convert between currencies at a live mid-market rate from
Frankfurter. Every movement lands in an append-only ledger, and balances are
derived from it.

Funds are simulated: a "deposit" creates money and a "withdrawal" destroys it.
There are no payment rails, no accounts, no KYC, and no persistence beyond
process memory. The point of the project is **demonstrably correct money
handling**, so a reviewer can add up the ledger by hand and recompute any
conversion from the rate stored next to it.

Product intent, domain vocabulary and the decisions behind the rules are in
`agentic_coding_orchestrator/ai_product/`.

## Stack

| | |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript, `strict`, target ES2020 (BigInt literals) |
| Styling | Tailwind CSS **v3** only — no component library |
| Validation | zod, at the HTTP edge only |
| Tests | Vitest 3 |
| Storage | Redis (Upstash) in production, in-memory locally — both behind `WalletRepository` |
| External API | Frankfurter v2 — `https://api.frankfurter.dev/v2/rate/{BASE}/{QUOTE}`, no key |
| Node | 22.2.0 (see the Tailwind gotcha below before changing this) |

Do not add a dependency without saying why in `ai_logs/`. Do not introduce a
component library, a state manager, or an ORM.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000 (picks another port if taken)
npm test             # Vitest, 50 specs
npm run typecheck    # tsc --noEmit
npx eslint src       # lint
npm run build        # production build
```

Run `npm test`, `npm run typecheck` and `npx eslint src` before every handover.

## Repository layout

```
.github/
  ISSUE_TEMPLATE/feature_request.md    required by workflow step 1
  ISSUE_TEMPLATE/bug_report.md
  pull_request_template.md             required by workflow step 7 (needs a mermaid diagram)

src/
  app/                   Next.js routing + HTTP edge only. No business logic.
    api/<resource>/route.ts
    <page>/page.tsx
  components/            React components; presentation and fetch only
  domain/                the rules. Depends on NOTHING outward.
    entities/            Currency, Money, Wallet, Transaction, ExchangeRate
    repositories/        WalletRepository, ExchangeRateRepository (interfaces)
    errors.ts            AppError + ErrorCode
  application/
    useCases/            one file per use case, each a make* factory
  infrastructure/        implements the domain's interfaces
    repositories/        InMemoryWalletRepository, FrankfurterExchangeRateRepository
    http/                errorResponse.ts, requestValidation.ts
    container.ts         composition root — the only place implementations are chosen
  test/                  Vitest specs, mirroring the layout above

agentic_coding_orchestrator/   the working record (see below)
```

Dependencies point inward only: `app → infrastructure → application → domain`.
The full convention, including how to add a feature, is in
**`agentic_coding_orchestrator/ai_docs/architecture.md`** — read it before
writing code.

## Workflow - follow strictly

1. **Create a GitHub Issue first**, using `.github/ISSUE_TEMPLATE/feature_request.md`. Open `agentic_coding_orchestrator/ai_specs/ISSUE-<n>-<slug>.md` at the same time.
2. **Branch from main**: `development/feature/<slug>`. Never push to `main`.
3. Implement. Record decisions and corrections in `ai_logs/<today>.md` as they happen.
4. **Verify**, and write the run up in `ai_reviews/ISSUE-<n>-acceptance.md` — every criterion, the command, the real output.
5. ### ⛔ STOP. Hand over for review.
   Post the results and state plainly that **nothing is committed and you are awaiting review**. Do not run `git commit`. Do not open a PR. Wait for the user to respond.

   **This step is breached most often when the work went well.** A clean verification table feels like a finish line; it is the point to hand over. It has been broken before on a previous project (Issue 6 / PR #12) — the work had passed every criterion, and the momentum carried straight through the gate.

   Planning and documentation commits may proceed once the user says "approved". Implementation always waits.
6. Commit in meaningful chunks that tell the story — not one large commit.
7. Open a PR using `.github/pull_request_template.md` (it requires a mermaid diagram).
8. Wait for manual review before merging. Close out the `ai_specs` file with the outcome.

Roadmap and issue ordering live in `agentic_coding_orchestrator/ai_docs/phase-1-plan.md` §8 — that file does not exist yet; create it when the first roadmap is planned.

## Keep the working record

`agentic_coding_orchestrator/` holds the reasoning the code and git history cannot show. Write it **during** the work, not reconstructed afterwards.

| Folder | What goes in it |
| --- | --- |
| `ai_docs/` | Durable design documents — the technical plan |
| `ai_specs/` | One file per issue: creation, scope changes, decisions, merge |
| `ai_reviews/` | Acceptance runs: what was executed, what passed, what failed, how it was fixed |
| `ai_logs/` | Dated decisions, corrections and mistakes |

Each folder has a README describing its format, and `ai_specs` and `ai_reviews` have templates.

**Keep them terse.** Record what a future reader could not reconstruct — decisions, rejected alternatives, failures and their causes. Not a narration of every command, and not a restatement of the diff. A review recording only passes is not worth keeping; the valuable entries are the criteria that failed.

(`ai_product/` also exists, holding product intent: the brief, domain glossary,
user journeys and product decisions.)

## Backend conventions

### Domain rules — non-negotiable

- **Money is never a float.** Every amount is an integer count of minor units.
  Decimals come from `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`,
  never a hand-written table. Decimal strings are parsed by string
  manipulation, so `"8.70"` is exactly `870`. The only float in the system is
  inside `formatMinor`, for display, and it never feeds back into stored state.
- **The ledger is the source of truth.** `Transaction` entries are append-only;
  balances are folded from them on every read. Nothing is ever edited or
  deleted — a mistake is corrected with a new, opposite entry.
- **A transfer or conversion is ONE ledger entry** describing both legs. That
  is what makes the two sides atomic; never write a debit and a credit as two
  entries.
- **TRANSFER = same currency, 1:1. CONVERSION = different currencies, live
  rate.** Asking for the wrong one is refused with a message naming the right
  one. Never silently reinterpret the request.
- **Conversion**: `targetMinor = roundHalfUp(sourceMinor × rate × 10^(targetDecimals − sourceDecimals))`,
  computed in BigInt. The rate stays a **decimal string** end to end — it is
  extracted from Frankfurter's raw response text, never via `JSON.parse`'s
  number. Mid-market only; no fee or spread.
- **No overdraft.** Check funds against the ledger at the point of use. In
  `convertCurrency` the check is repeated after the rate `await`, because that
  await yields the event loop.
- **If the rate cannot be fetched, the operation fails with 503 and nothing is
  written.** No fallback, no last-known-good beyond the 60s cache, no estimate.
- A conversion that rounds to zero in the target currency is refused
  (`ROUNDS_TO_ZERO`), not written as a zero-value movement.

### Code conventions

- **Layering.** Rules in `domain/`, orchestration in `application/useCases/`,
  adapters in `infrastructure/`. A route handler parses, calls a use case from
  `container.ts`, and maps errors — nothing more.
- **Use cases are factories**: `makeDoThing(deps)` returning the callable, with
  dependencies arriving as interfaces. Never import a concrete implementation
  outside `container.ts` or a test.
- **Errors**: throw `AppError(code, status, message)`. Only
  `infrastructure/http/errorResponse.ts` turns one into a response. The API
  error shape is always `{error: {code, message}}`.
- **Validation**: shape validation (zod) at the HTTP edge; *value* rules (is
  this a valid amount for this currency) in `domain/entities/Money.ts`.
- **Imports**: always the `@/` alias, never deep relative paths.
- **The repository interface is async.** Every `WalletRepository` method
  returns a `Promise`, because an implementation may be network-backed. Await
  use cases in routes and server components — `NextResponse.json()` accepts
  `any`, so a forgotten `await` serialises as `{}` without a type error.
- **Tests** live in `src/test/`, mirroring the source path. Domain specs are
  pure; application specs inject `createInMemoryWalletRepository()` and a fake
  port; mock at the port, never at `global.fetch`.

### Known gotchas

- **Tailwind is pinned to v3.** v4's compiler `require()`s an ESM module, which
  fails on Node < 22.12. Do not "upgrade" it without raising Node first.
- **Tailwind content globs cover only `app/` and `components/`.** Scanning the
  whole of `src/` made its content tracker `statSync` deleted test files after
  a refactor, which broke `globals.css` and 500'd every route.
- **Next 16 `cacheComponents` is off deliberately** — it rejects
  `export const dynamic = "force-dynamic"`, and every page reads a per-request
  in-memory ledger, so caching components is wrong here.
- **Next 16 refuses a second `next dev` for the same directory.** If a server
  is already running, stop it; a second one exits immediately and every request
  fails to connect.
- **After moving or deleting files, `rm -rf .next`** before trusting a dev run.
- **Vitest needs `vitest.config.mts`** for the `@/` alias — it is not read from
  `tsconfig.json`. The `.mts` extension avoids Vite's CJS deprecation warning.
- **CLDR gives IDR two fraction digits**, so IDR is held in sen and `"1"` means
  `IDR 0.01`. This follows the brief's rule of taking decimals from `Intl`; do
  not special-case it.
- **Port 3000 may be occupied.** Read the dev server's ready line for the real
  port instead of assuming.
- **No Redis is needed locally.** With no `KV_REST_API_*` /
  `UPSTASH_REDIS_REST_*` variables set, the in-memory ledger is used. On Vercel
  without them the app throws at startup on purpose — never add a silent
  fallback to memory there, it would lose transactions invisibly.
- **A failed or experimental build leaves `.next` unusable.** Rebuild before
  trusting `next start`.

## Frontend conventions

- **The client never computes money.** No parsing, rounding, or converting in a
  component. Amounts are sent as decimal strings exactly as typed; every figure
  rendered comes from the server. The convert form shows the quoted *rate*, not
  a computed target amount, for this reason.
- **Server components read through `container.ts`** directly (not over HTTP).
  Client components `fetch` the API and re-render via `router.refresh()`.
- Pages that read the ledger set `export const dynamic = "force-dynamic"`.
- **Tailwind utility classes only.** No component library, no CSS-in-JS, no
  stylesheet beyond `globals.css`.
- **Do not use a native `<select>` for anything that matters visually.** Its
  open panel is positioned and font-scaled by the OS, not by page CSS — that
  caused a real defect. `components/WalletFilter.tsx` is the hand-built
  listbox pattern to copy: button + `role="listbox"`, Escape to close, arrow
  keys, outside `pointerdown` to close.
- **Disable the submit control while a request is in flight.** Double-submit
  protection is the UI's one money-related responsibility.
- **URL is the source of truth for view state** (e.g. the transaction filter),
  so a view stays shareable and survives reload.
- **Responsive**: check narrow viewports. Side padding is `px-4 sm:px-6`, grids
  stack by default, wide tables get an `overflow-x-auto` wrapper.
- Accessibility is not optional: label every control, set `aria-current` on the
  active nav tab, and never signal state by colour alone.

## Github workflow

- **Never push to `main`.** Branch `development/feature/<slug>` from `main`.
- `main` is the default branch; the remote is `origin`
  (`Aries1711/coconut-labs-coding-test_international_wallet_transfer`), over
  HTTPS authenticated by `gh` — SSH is not configured in this environment.
- Commit in meaningful chunks that tell the story of the change. Commit
  messages: a short imperative subject, then a body explaining *why*, including
  the alternative rejected where there was one.
- Every PR uses `.github/pull_request_template.md` and **must include a
  mermaid diagram** of the flow it changes.
- Reference the issue the PR closes, and list the commits in the changelog
  section.
- Wait for manual review before merging. Do not merge your own PR.
- After merge, close out `ai_specs/ISSUE-<n>-<slug>.md` with the outcome.
- Do not commit or push unless the user has said so — see workflow step 5.
