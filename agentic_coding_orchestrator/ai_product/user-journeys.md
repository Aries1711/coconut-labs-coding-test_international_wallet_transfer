# User journeys

What the holder does, what they see, and — the part that matters for a money
product — what they see when it is refused. Refusals name the wallet and the
amounts, because "invalid request" is useless when money is involved.

## Check what I hold

Open `/`. Six wallet cards, each showing the balance formatted in its own
currency, plus the raw minor-unit count underneath. The minor-unit figure is
there so a reviewer can verify the maths without trusting the formatter.

The nav marks where you are; the history is one click away because "what is my
balance" and "why is it that" are the same question.

## Add or remove funds

Pick a wallet, type an amount, submit. The amount field is labelled with the
selected wallet's currency, so it is clear whether decimals are allowed before
anything is typed.

Refusals:

- `0` or a negative amount → *"Amount must be greater than zero."*
- `1.005` into USD → *"USD amounts support at most 2 decimal place(s)."*
- `100.5` into JPY → *"JPY amounts cannot have decimal places."*
- withdrawing more than the balance → *"USD Savings holds $1,000.00, which is
  less than $9,999.00."* The message states both figures so the holder does not
  have to go and look.

## Move money between my own wallets, same currency

USD Main → USD Savings, 1:1, nothing converted. The form says so.

Refusals: the same wallet on both sides (*"The source and target wallet must be
different."*), a cross-currency pair (*"A transfer requires both wallets to hold
the same currency (USD vs EUR). Use a conversion instead."*) and insufficient
funds, as above.

## Convert between currencies

Pick two wallets of different currencies. Before committing, the form shows the
quoted rate and the date it is from — *"1 USD = 158.26 JPY (as of 2026-11-09)"* —
so the holder commits to a rate they have seen. The preview shows the **rate**,
not a computed target amount, because the client is not allowed to do money
maths; the authoritative converted figure comes back with the result and is in
the history.

On success the balances update on both sides and the movement appears in the
history carrying the rate used.

Refusals:

- two wallets of the same currency → *"Both wallets hold USD. Use a transfer instead."*
- insufficient funds in the source wallet
- an amount too small to be worth one unit of the target → *"IDR 0.01 converts to
  less than the smallest JPY unit at the current rate."*
- the rate provider being unreachable → the conversion fails, the balances do not
  move, and **nothing is written to the history**. The holder can retry; there is
  no partially applied state to clean up.

## Double submit

Every submit button disables itself while its request is in flight, so an
impatient second click cannot produce a second deposit. This is the UI's only
money-related responsibility, and it is a guard against the common accident, not
a correctness guarantee — a deliberate replay would still apply twice. Idempotency
keys are the real fix and are listed as future work.

## Audit the history

`/transactions` lists every movement, newest first: when, what kind, which
wallets, the amount, and the rate where one applies. Filter by wallet to answer
"what happened to this balance".

A conversion shows both sides (`$10.00 → ¥1,583`), because showing one side of a
conversion is how a history becomes misleading.

Open any row for the detail view: both amounts in formatted and minor-unit form,
both wallets with their ids, and the rate with its date — everything needed to
recompute the movement by hand. A link to a transaction that does not exist is a
proper 404, not an empty page.

## Filtering by a wallet that no longer exists

The history page falls back to showing everything and says so, rather than
failing — a stale bookmark should not be a dead end. The API is stricter: it
returns a 404, so a typo in a filter is visible to a developer instead of looking
like an empty history.
