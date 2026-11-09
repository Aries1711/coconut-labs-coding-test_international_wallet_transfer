import { randomUUID } from "node:crypto";
import type { Transaction } from "@/domain/entities/Transaction";
import type { Wallet } from "@/domain/entities/Wallet";
import type { WalletRepository } from "@/domain/repositories/WalletRepository";
import { SEED_WALLETS, seedTransactions } from "./seed";

type Store = { wallets: Wallet[]; transactions: Transaction[] };

/**
 * Builds an independent, freshly seeded repository. Tests use this directly so
 * each suite gets its own ledger; local development uses the shared instance
 * below. Not suitable for serverless, where each request may run in a
 * different process -- that is what RedisWalletRepository is for.
 */
export function createInMemoryWalletRepository(): WalletRepository {
  const store: Store = { wallets: [...SEED_WALLETS], transactions: seedTransactions() };

  return {
    async listWallets() {
      return [...store.wallets];
    },

    async getWallet(id) {
      return store.wallets.find((wallet) => wallet.id === id);
    },

    async listTransactions(walletId) {
      const filtered = walletId
        ? store.transactions.filter(
            (tx) => tx.fromWalletId === walletId || tx.toWalletId === walletId,
          )
        : store.transactions;
      // Newest first for display; the underlying array stays append-ordered.
      return [...filtered].reverse();
    },

    async getTransaction(id) {
      return store.transactions.find((tx) => tx.id === id);
    },

    async append(entry) {
      const transaction: Transaction = {
        ...entry,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      store.transactions.push(transaction);
      return transaction;
    },
  };
}

/**
 * The local ledger, held on globalThis so it survives Next.js hot reloads.
 */
const globalForRepository = globalThis as typeof globalThis & {
  __walletRepository?: WalletRepository;
};

export function sharedInMemoryWalletRepository(): WalletRepository {
  globalForRepository.__walletRepository ??= createInMemoryWalletRepository();
  return globalForRepository.__walletRepository;
}
