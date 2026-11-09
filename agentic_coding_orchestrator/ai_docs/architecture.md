# Architecture — layered (clean) architecture

**This is the convention. Any new feature, in any session, follows it.**
If a change seems to need an exception, say so and explain why rather than
quietly putting a file somewhere else.

## The layout

```
/src
  /app                     Next.js routing + HTTP entry points only
    /api/<resource>/route.ts
    /<page>/page.tsx
  /components              React components (presentation only)
  /domain                  The rules. Depends on NOTHING.
    /entities              Currency, Money, Wallet, Transaction, ExchangeRate
    /repositories          Interfaces the outside world must satisfy
    errors.ts              AppError + ErrorCode
  /application             Orchestration. Depends only on /domain.
    /useCases              One file per use case, each a make* factory
  /infrastructure          The outside world. Implements /domain interfaces.
    /repositories          InMemoryWalletRepository, FrankfurterExchangeRateRepository
    /http                  errorResponse.ts, requestValidation.ts
    container.ts           Composition root: wires implementations to use cases
  /test                    Vitest specs, mirroring the layout above
```

## The one rule that matters

Dependencies point **inward**, never outward:

```
app  →  infrastructure  →  application  →  domain
```

- `domain/` imports nothing from the other three. No `next/*`, no `zod`, no
  `fetch`, no `node:*` except where a pure primitive demands it. If you are
  adding an import to a domain file and it is not another domain file, stop —
  it belongs in a layer further out.
- `application/` imports `domain/` only. It never names a concrete
  implementation: use cases receive their dependencies as interfaces.
- `infrastructure/` implements the domain's interfaces and may import anything.
- `app/` is a thin edge: parse the request, call a use case from the container,
  map errors. **No business logic in a route handler or a page.**

The practical payoff: swapping the in-memory ledger for Postgres, or
Frankfurter for another rate source, is a change to `infrastructure/` and
`container.ts` only. Nothing in `domain/` or `application/` moves.

## How to add a feature

Work inward-out, in this order:

1. **Domain** — does this need a new entity, field, or rule? Put pure logic and
   types in `domain/entities/`. New external dependency? Declare the interface
   in `domain/repositories/`, not the implementation.
2. **Application** — add `application/useCases/<verbName>.ts`, exporting a
   factory:

   ```ts
   export function makeDoTheThing({ wallets }: WalletDeps) {
     return function doTheThing(input: string): Result {
       // rules live here, dependencies arrive as interfaces
     };
   }
   ```

   Shared guards (`requireWallet`, `assertSufficientFunds`, `toWalletView`)
   live in `application/useCases/shared.ts` — reuse them rather than
   re-implementing a check.
3. **Infrastructure** — implement any new interface under
   `infrastructure/repositories/`, then wire it in `container.ts`.
4. **App** — add the route handler or page. It should be short enough to read
   in one glance:

   ```ts
   export async function POST(request: Request) {
     try {
       const { walletId, amount } = await parseBody(request, singleWalletSchema);
       return NextResponse.json({ transaction: depositFunds(walletId, amount) }, { status: 201 });
     } catch (error) {
       return toErrorResponse(error);
     }
   }
   ```
5. **Test** — add a spec under `src/test/`, mirroring the path of the file
   under test.

## Conventions

**Naming.** Entities and interfaces are `PascalCase.ts` (`Wallet.ts`,
`WalletRepository.ts`). Use cases are `camelCase.ts` named for the verb
(`depositFunds.ts`, `convertCurrency.ts`). Implementations say what they are:
`InMemoryWalletRepository`, `FrankfurterExchangeRateRepository`.

**Use cases are factories.** `makeX(deps)` returning the callable. This is what
makes them testable without mocking modules — a test passes a fake repository
in, and nothing global is stubbed.

**Errors.** Throw `AppError(code, status, message)` from domain or application.
Only `infrastructure/http/errorResponse.ts` knows how to turn one into an HTTP
response. Never construct a `NextResponse` outside `app/` or
`infrastructure/http/`.

**Validation.** Shape validation (zod) is an HTTP concern and lives in
`infrastructure/http/requestValidation.ts`. *Value* rules — is this a valid
amount for this currency — are domain rules and live in `domain/entities/Money.ts`.

**Imports.** Always use the `@/` alias (`@/domain/entities/Money`), never deep
relative paths. The alias is configured in both `tsconfig.json` and
`vitest.config.mts`, so it works in the app and in tests.

**Money.** Never a float. Integer minor units everywhere, `Intl` for decimals,
BigInt for conversion. The rate stays a decimal string end to end. This rule
outranks convenience.

**The container is the only place implementations are chosen.** If you find
yourself importing `InMemoryWalletRepository` outside `container.ts` or a test,
that is the smell.

## Tests

`src/test/` mirrors `src/`. A spec imports via `@/`, so moving a file does not
break it.

- **Domain** specs are pure: no mocks, no fakes.
- **Application** specs build the use case with `createInMemoryWalletRepository()`
  and a hand-written fake for anything external (see the fake
  `ExchangeRateRepository` in `walletUseCases.test.ts`). Mock at the port, not
  at `global.fetch`.
- **Infrastructure** specs are where real adapters get exercised —
  the Frankfurter client's cache and failure mapping, the repository's
  append-only behaviour.

Run `npm test`, `npm run typecheck` and `npx eslint src` before committing.

## Why this shape

The brief's rules — money never a float, the ledger is the source of truth,
all business logic server-side, storage behind an interface — are easier to
*enforce* than to remember. This layout makes each one structural: money math
lives in a layer that cannot import a framework, the storage interface is
owned by the domain rather than the database, and a route handler has nowhere
to hide a business rule. A reviewer can check the rules by reading the import
graph.
