import type { Currency } from "./Currency";

export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "CONVERSION";

/**
 * Append-only ledger entry. The debited wallet is `fromWalletId`, the credited
 * wallet is `toWalletId`. A CONVERSION debits `amountMinor` of `currency` and
 * credits `targetAmountMinor` of `targetCurrency` in the same entry, which is
 * what makes both legs atomic.
 */
export type Transaction = {
  id: string;
  type: TransactionType;
  fromWalletId?: string;
  toWalletId?: string;
  amountMinor: number;
  currency: Currency;
  targetAmountMinor?: number;
  targetCurrency?: Currency;
  rate?: string;
  rateDate?: string;
  createdAt: string;
};

export type NewTransaction = Omit<Transaction, "id" | "createdAt">;

/** Signed effect of one ledger entry on one wallet. */
export function deltaFor(tx: Transaction, walletId: string): number {
  let delta = 0;
  if (tx.fromWalletId === walletId) delta -= tx.amountMinor;
  if (tx.toWalletId === walletId) {
    delta += tx.type === "CONVERSION" ? (tx.targetAmountMinor ?? 0) : tx.amountMinor;
  }
  return delta;
}

/**
 * A wallet's balance is a fold over the ledger, never a stored number. This is
 * the single definition of "balance" in the system.
 */
export function balanceOf(transactions: readonly Transaction[], walletId: string): number {
  return transactions.reduce((total, tx) => total + deltaFor(tx, walletId), 0);
}
