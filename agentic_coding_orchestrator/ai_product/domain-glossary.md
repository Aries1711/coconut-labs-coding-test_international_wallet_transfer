# Domain glossary

The code is named after these terms. Where a rule is non-negotiable it says so;
those are the ones a change request cannot casually override.

## Wallet

A named container holding exactly one currency, e.g. "USD Main" / `USD`. A wallet
has **no stored balance** — its balance is a question answered from the history,
not a field. Two wallets may share a currency (USD Main and USD Savings), which
is what makes a transfer distinct from a conversion.

## Minor units

Money is always an **integer count of the currency's smallest unit** — cents for
USD, yen for JPY, sen for IDR. `$10.50` is `1050`, never `10.5`.

The number of decimal places per currency comes from the platform's own currency
data (`Intl`), not a hand-written table. **Non-negotiable:** no amount is ever a
floating-point number anywhere in the money path. A float appears only when a
number is turned into text for display.

Consequence worth knowing: that data gives **IDR two decimals**, so IDR is held
in sen and `"1"` means `IDR 0.01`. Surprising for Indonesian amounts in practice,
but it is the platform's answer and overriding it per currency is exactly the
kind of table that drifts.

## Amount (as the API sees it)

A **decimal string**, `"10.50"`. The client never converts an amount; it sends
what was typed and the server parses it. An amount is rejected if it is not a
positive decimal, or if it carries more decimal places than the currency has
(`100.5` is not a JPY amount).

## Ledger / transaction

The append-only list of movements. **Non-negotiable: the ledger is the source of
truth and balances are derived from it.** Nothing is ever edited or deleted; a
mistake is corrected by a new, opposite movement, never by rewriting history.

Four kinds of movement:

| Type | Moves | Notes |
| --- | --- | --- |
| `DEPOSIT` | into one wallet | Simulated funds appear. Also how opening balances exist. |
| `WITHDRAWAL` | out of one wallet | Simulated funds disappear. |
| `TRANSFER` | between two wallets | **Same currency only**, 1:1, nothing is converted. |
| `CONVERSION` | between two wallets | **Different currencies only**, at the live rate. |

A transfer and a conversion are *one* ledger entry describing both sides, which
is why a half-finished move cannot exist: there is one write, or none.

Asking for the wrong one is an error with a message that names the right one —
same-currency conversions and cross-currency transfers are both refused rather
than silently reinterpreted, because guessing the holder's intent with money is
worse than asking again.

## Rate and rate date

The **mid-market rate**: the midpoint between buy and sell, with no fee or spread
added. Published by the European Central Bank once per working day and served via
Frankfurter, so a rate is "as of" a date, not a moment — a conversion at 02:00
uses the previous working day's close, and weekend rates are Friday's.

Both the rate and its date are **stored on the conversion** so the result stays
reproducible after the rate moves. A conversion in the history can always be
recomputed from the numbers printed next to it.

**Non-negotiable:** if the rate cannot be fetched, the conversion fails and
nothing is recorded. There is no fallback, no last-known-good beyond the short
cache, no estimate. An invented rate is worse than a refusal.

## Insufficient funds

A wallet cannot go negative — there is no overdraft, credit or settlement delay
in this product. The check is against the balance derived from the ledger at the
moment of the write.

## Rounds to zero

A conversion so small that the result is less than one unit of the target
currency (one sen of IDR into JPY). Refused rather than written as a zero-value
movement, which would take the holder's money and give nothing back.

## Derived balance

The fold of every movement touching a wallet: credits in, debits out, with a
conversion crediting its *target* amount. Stated plainly because it is the
product's central claim — a balance is never stored, so it can never disagree
with the history.
