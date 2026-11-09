# Product brief — multi-currency wallet

## What it is

A single-user digital wallet that holds money in several currencies at once, and
moves money between those currencies at a real published exchange rate. It is a
**demonstration of correct money handling**, not a payments product: funds are
simulated, created out of thin air by a "deposit", and destroyed by a
"withdrawal".

## Who it serves

One simulated account holder, already authenticated by assumption. There is no
sign-in, no second user to pay, and no notion of ownership — whoever opens the
app is the account holder. Every wallet on the dashboard belongs to them.

The real audience is a reviewer: the product exists to make the money rules
visible and checkable.

## The job it does

The holder keeps balances in the currencies they actually deal in, and can:

- **see** what they hold, per wallet, in that wallet's own currency
- **add or remove** simulated funds (deposit / withdrawal)
- **move** money between two wallets of the same currency, unchanged (transfer)
- **convert** money between two currencies at the live mid-market rate, seeing
  the rate before committing (conversion)
- **audit** every movement afterwards, including the exact rate a conversion used

Auditability is a feature, not a debug view: the history is the product's answer
to "why is this balance what it is?".

## Seeded world

Six wallets, because two of them share a currency — that is what makes a
same-currency transfer demonstrable at all:

| Wallet | Currency | Opening balance |
| --- | --- | --- |
| USD Main | USD | $2,500.00 |
| USD Savings | USD | $1,000.00 |
| EUR | EUR | €500.00 |
| GBP | GBP | £0.00 |
| JPY | JPY | ¥75,000 |
| IDR | IDR | IDR 0.00 |

Opening balances are **deposits in the history**, not starting numbers. There is
no balance anywhere in this product that cannot be traced to a movement.

Zero-balance wallets are deliberate: GBP and IDR exist so a reviewer immediately
has an empty target to convert into, and an empty source to try to overdraw.

`SGD` and `AUD` are supported for rates and conversions but no wallet holds them
— the currency list is wider than the seeded wallets on purpose, so adding a
wallet needs no code change to the money layer.

## In scope

Balances, the four movements, a rate preview, and a complete history with
per-transaction detail. Every rule enforced on the server, so the API alone is a
usable product surface.

## Not in scope, deliberately

- **Real money.** No payment rails, no bank or card integration, no settlement.
- **Authentication, accounts, KYC.** One implicit user; nothing to log into.
- **Fees, spreads, margin.** Conversions use the mid-market rate exactly. Every
  real provider charges here; modelling it would be inventing a price.
- **Payments to other people.** Both sides of every movement are the holder's
  own wallets.
- **Durability.** The ledger lives in memory and resets when the server does.
  That is a stated limitation, not a defect to be worked around in the UI.
- **Multi-currency wallets.** One wallet holds exactly one currency; a holder who
  wants two currencies has two wallets.

## What "correct" means here

The product is successful if, after any sequence of operations, a reviewer can:

1. add up the history by hand and get the displayed balance,
2. recompute any conversion from the stored rate and get the stored result, and
3. find no movement that half-happened.

Everything else — styling, number of wallets, which currencies — is negotiable.
