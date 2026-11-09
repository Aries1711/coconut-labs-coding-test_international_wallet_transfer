import type { Currency } from "./currencies";

export type Wallet = {
  id: string;
  label: string;
  currency: Currency;
};

/** A wallet plus its balance derived from the ledger. */
export type WalletView = Wallet & {
  balanceMinor: number;
  balanceFormatted: string;
};

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
