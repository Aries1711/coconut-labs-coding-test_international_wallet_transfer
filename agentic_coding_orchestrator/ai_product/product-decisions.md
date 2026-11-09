# Product decisions

Judgement calls, not implementation details. Each one could reasonably have gone
the other way, so the alternative and the reason are recorded; the technical
counterparts live in `../ai_docs/technical-plan.md`.

## Opening balances are deposits, not starting numbers

**Rejected:** seeding wallets with a balance field.
A product whose central claim is "every balance is explained by the history"
cannot have money that predates the history. Seeded wallets are seeded
*deposits*, so the claim holds from the first screen a reviewer sees.

## Two USD wallets

**Rejected:** one wallet per currency.
Without two wallets sharing a currency, a same-currency transfer has nowhere to
go and the transfer/conversion distinction — the most interesting rule in the
domain — is undemonstrable.

## Wrong-operation requests are refused, not reinterpreted

**Rejected:** routing a same-currency "conversion" through the transfer path, and
vice versa.
It would be friendlier and is defensible. It was refused because silently doing
something adjacent to what was asked is a bad habit to establish in a money
product; the error names the operation that would work, which costs one click and
keeps intent explicit.

## The rate preview shows a rate, not a converted amount

**Rejected:** previewing "you will receive ¥1,583".
Clearer for the holder, but it requires either money arithmetic in the client —
forbidden — or a second server round trip per keystroke. The rate plus its date
is enough to commit to, and the exact figure is authoritative in the result. A
server-side quote endpoint is the right version of this and is listed as future
work in the README.

## A failed rate lookup refuses the whole conversion

**Rejected:** falling back to the last known rate, or queuing the conversion.
A stale rate silently gives the holder a different deal than the one shown; a
queued conversion executes at a rate nobody has seen. Refusing is the only option
that cannot mislead. The 60-second cache is a performance measure, not a
fallback, and the product says "try again" rather than guessing.

## No fees or spread

**Rejected:** modelling a small spread for realism.
Any number chosen would be fictional, and it would make conversions
non-reproducible from published rates — which is how a reviewer checks the maths.
Mid-market only, stated plainly as a limitation.

## Minor units are shown next to formatted balances

The raw integer beside `$2,540.50` is developer-facing detail on a holder-facing
screen. Kept, because the product's purpose is to make the money handling
*checkable* — this is the one place the implementation is deliberately visible.
A consumer version would drop it.

## Currency list is wider than the seeded wallets

SGD and AUD are supported with no wallet holding them. Adding a wallet is then a
data change, not a code change, and the gap makes clear that the currency set and
the wallet set are separate concerns.

## Open questions for a product owner

- **Correcting a mistake.** The ledger is append-only, so a mistaken deposit is
  cancelled by an opposite movement. Should that be a first-class `REVERSAL`
  linked to the original, rather than an unexplained opposite entry?
- **Rate staleness over a weekend.** A Friday rate applied on Sunday is correct
  but can look wrong. Should the UI say how old the rate is, or refuse to convert
  outside working days?
- **Who may deposit.** "Deposit" currently means "create money", which no real
  product allows. If this ever grows a funding source, deposit and withdrawal
  become asynchronous and the history needs pending states.
- **Rounding ownership.** Half-up on the smallest target unit favours the holder
  on the half-cent. A real provider rounds in its own favour and discloses it;
  the policy should be a stated product rule, not a maths detail.
