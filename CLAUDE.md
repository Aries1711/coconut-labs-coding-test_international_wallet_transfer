# CLAUDE.md — Coconut Labs Coding Test (AI-Fullstack Developer)

You are my engineering partner for a Coconut Labs coding test (AI-Fullstack Developer role). This is a real job application. The reviewers judge code quality, correctness, completeness, and how I work with an AI agent. HARD TIME LIMIT: 30 minutes total. Scope discipline matters more than polish.

First action: save this entire prompt as CLAUDE.md in the project root so the context lives in the repo.

## The project
A simple multi-currency digital wallet. One simulated user (no auth) holds wallets in several currencies. The user can:
- deposit simulated funds
- withdraw funds
- convert between currencies (live rate from Frankfurter)
- transfer funds between wallets
- inspect balances
- view transaction history and individual transactions
No real payments, auth, bank integration, or KYC.

## Tech stack (fixed, do not deviate)
- Next.js (App Router) + TypeScript, scaffolded with create-next-app
- Tailwind CSS only, no component library
- Next.js Route Handlers as the API layer (all business logic on the server, never in the client)
- zod for request validation
- NO database: in-memory store held on a globalThis singleton (so it survives hot reload), behind a small WalletRepository interface so a file or DB adapter could replace it later
- Run with `npm run dev`. No Docker.
- External API: Frankfurter v2 (https://api.frankfurter.dev/v2/rate/{BASE}/{QUOTE}), no key. Do not use v1.

## Domain rules (non-negotiable)
- Money is NEVER a float. Store integer minor units. Get each currency's decimals from Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits (JPY=0, USD=2). The API accepts amounts as decimal strings and parses them to minor units on the server; reject amounts with too many decimals.
- Conversion: targetMinor = round half-up(sourceMinor * rate * 10^(targetDecimals - sourceDecimals)). Use the mid-market rate, no fees or spread. Store the rate and the rate date on the transaction.
- Supported currencies (curated): USD, EUR, GBP, JPY, SGD, AUD, IDR.
- Seed wallets: USD Main, USD Savings, EUR, GBP, JPY, IDR. Seed with zero balances (or a small initial deposit recorded as a DEPOSIT transaction, never an untracked balance).
- The transaction log is append-only and is the source of truth. Balances are derived from it.
- Transaction types: DEPOSIT, WITHDRAWAL, TRANSFER, CONVERSION. Fields: id, type, fromWalletId?, toWalletId?, amountMinor, currency, targetAmountMinor?, targetCurrency?, rate?, rateDate?, createdAt.
- TRANSFER = between two wallets of the SAME currency at 1:1. CONVERSION = between wallets of DIFFERENT currencies at the live rate. Reject the wrong combination with a clear error.
- Convert and transfer move both sides together in one operation: either both apply or neither does.
- Cache Frankfurter rates server-side for 60s. If Frankfurter fails, return 503 and record no transaction. Never fall back to an invented rate.

## Edge cases to handle
amount <= 0 · too many decimals for the currency · insufficient funds (no overdraft) · same wallet as source and target · unknown wallet (404) · conversion that rounds to 0 in the target currency · Frankfurter down or timing out · double submit (disable the button while a request is pending)

## API contract (adjust in the plan if needed)
GET  /api/wallets                 GET /api/wallets/[id]
POST /api/deposits    {walletId, amount}
POST /api/withdrawals {walletId, amount}
POST /api/transfers   {fromWalletId, toWalletId, amount}
POST /api/conversions {fromWalletId, toWalletId, amount}
GET  /api/rates?from=USD&to=EUR   (preview before converting)
GET  /api/transactions?walletId=  GET /api/transactions/[id]
Errors: consistent JSON shape {error: {code, message}} with correct status codes.

## Pages
/ = wallet balances + forms for deposit, withdraw, transfer, convert (the convert form shows a live rate preview)
/transactions = history, filterable by wallet
/transactions/[id] = transaction detail

## How we work
- git init at the start. Commit after each feature with meaningful messages. The commit history is part of the submission.
- Model per phase: Opus for Plan, Sonnet for Implementation, Opus for the final review. I switch with /model; remind me at each phase boundary.
- I am a Senior Full-Stack Engineer (8+ yrs; Next.js, TS, React are production-familiar). Don't explain basics. Decide confidently, and flag only non-obvious tradeoffs.

## Phases (time-boxed)

### Phase 1: Plan (~5 min, Opus)
Output ONE concise screen:
1. Folder structure
2. Domain types + repository interface
3. Money/conversion module design (rounding, decimals)
4. Final API contract
5. Feature roadmap in implementation order, with a minute estimate per feature (must fit ~20 min)
6. What gets cut first if time runs short
Do NOT write code until I approve.

### Phase 2: Implementation (~20 min, Sonnet)
Build in this order, committing after each step:
scaffold → money module → repository + seed → Frankfurter client → API routes → dashboard page → transactions pages.
Keep the UI plain and functional. After each step, tell me in one line what's done and what's next.

### Phase 3: Finalization (~5 min, Opus)
- If time allows: a Vitest test for the money/conversion math (with Frankfurter mocked)
- README: how to run (npm install && npm run dev), design decisions (minor units, append-only ledger, in-memory store behind an interface, Frankfurter v2 + cache), known limitations (data resets on restart, single user, daily mid-market rates), and what I'd do with more time
- Final review pass: money handling, error paths, and server-only logic. Report issues; don't silently refactor.
- Final commit.

## Start now
Save CLAUDE.md, then begin Phase 1.

---

## Architecture (added after the timed test, by the project owner's request)

The `src/` tree follows a layered (clean) architecture: `domain` /
`application` / `infrastructure`, with `app` and `components` as the edge.

**Before adding or changing a feature, read
`agentic_coding_orchestrator/ai_docs/architecture.md` and follow it.** It
defines where each kind of file goes, the inward-only dependency rule, the
use-case factory pattern, and the testing conventions.
