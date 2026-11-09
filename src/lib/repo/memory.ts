import { randomUUID } from "node:crypto";
import type { NewTransaction, Transaction, Wallet } from "../types";
import type { WalletRepository } from "./WalletRepository";

type Store = { wallets: Wallet[]; transactions: Transaction[] };

const SEED_WALLETS: Wallet[] = [
  { id: "usd-main", label: "USD Main", currency: "USD" },
  { id: "usd-savings", label: "USD Savings", currency: "USD" },
  { id: "eur-main", label: "EUR", currency: "EUR" },
  { id: "gbp-main", label: "GBP", currency: "GBP" },
  { id: "jpy-main", label: "JPY", currency: "JPY" },
  { id: "idr-main", label: "IDR", currency: "IDR" },
];

/** Opening balances exist as real DEPOSIT entries, never as untracked state. */
const SEED_DEPOSITS: Array<{ walletId: string; amountMinor: number; currency: Wallet["currency"] }> = [
  { walletId: "usd-main", amountMinor: 250_000, currency: "USD" }, // $2,500.00
  { walletId: "usd-savings", amountMinor: 100_000, currency: "USD" }, // $1,000.00
  { walletId: "eur-main", amountMinor: 50_000, currency: "EUR" }, // 500.00 EUR
  { walletId: "jpy-main", amountMinor: 75_000, currency: "JPY" }, // 75,000 JPY
];

function createStore(): Store {
  const seededAt = new Date("2026-01-01T00:00:00.000Z").toISOString();
  return {
    wallets: SEED_WALLETS,
    transactions: SEED_DEPOSITS.map((deposit, index) => ({
      id: `seed-${index + 1}`,
      type: "DEPOSIT" as const,
      toWalletId: deposit.walletId,
      amountMinor: deposit.amountMinor,
      currency: deposit.currency,
      createdAt: seededAt,
    })),
  };
}

/**
 * Held on globalThis so the ledger survives Next.js hot reloads in dev.
 */
const globalForStore = globalThis as typeof globalThis & {
  __walletStore?: Store;
};

function store(): Store {
  globalForStore.__walletStore ??= createStore();
  return globalForStore.__walletStore;
}

export const memoryWalletRepository: WalletRepository = {
  listWallets() {
    return [...store().wallets];
  },

  getWallet(id) {
    return store().wallets.find((wallet) => wallet.id === id);
  },

  listTransactions(walletId) {
    const all = store().transactions;
    const filtered = walletId
      ? all.filter((tx) => tx.fromWalletId === walletId || tx.toWalletId === walletId)
      : all;
    // Newest first for display; the underlying array stays append-ordered.
    return [...filtered].reverse();
  },

  getTransaction(id) {
    return store().transactions.find((tx) => tx.id === id);
  },

  append(entry) {
    const transaction: Transaction = {
      ...entry,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    store().transactions.push(transaction);
    return transaction;
  },
};
