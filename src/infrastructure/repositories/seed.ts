import type { Transaction } from "@/domain/entities/Transaction";
import type { Wallet } from "@/domain/entities/Wallet";

/** The wallet set is fixed configuration, shared by every adapter. */
export const SEED_WALLETS: Wallet[] = [
  { id: "usd-main", label: "USD Main", currency: "USD" },
  { id: "usd-savings", label: "USD Savings", currency: "USD" },
  { id: "eur-main", label: "EUR", currency: "EUR" },
  { id: "gbp-main", label: "GBP", currency: "GBP" },
  { id: "jpy-main", label: "JPY", currency: "JPY" },
  { id: "idr-main", label: "IDR", currency: "IDR" },
];

/** Opening balances exist as real DEPOSIT entries, never as untracked state. */
export const SEED_DEPOSITS: Array<{
  walletId: string;
  amountMinor: number;
  currency: Wallet["currency"];
}> = [
  { walletId: "usd-main", amountMinor: 250_000, currency: "USD" }, // $2,500.00
  { walletId: "usd-savings", amountMinor: 100_000, currency: "USD" }, // $1,000.00
  { walletId: "eur-main", amountMinor: 50_000, currency: "EUR" }, // 500.00 EUR
  { walletId: "jpy-main", amountMinor: 75_000, currency: "JPY" }, // 75,000 JPY
];

const SEEDED_AT = new Date("2026-01-01T00:00:00.000Z").toISOString();

export function seedTransactions(): Transaction[] {
  return SEED_DEPOSITS.map((deposit, index) => ({
    id: `seed-${index + 1}`,
    type: "DEPOSIT" as const,
    toWalletId: deposit.walletId,
    amountMinor: deposit.amountMinor,
    currency: deposit.currency,
    createdAt: SEEDED_AT,
  }));
}
