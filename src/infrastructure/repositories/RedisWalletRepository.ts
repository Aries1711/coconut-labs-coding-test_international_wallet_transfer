import { randomUUID } from "node:crypto";
import type { Transaction } from "@/domain/entities/Transaction";
import type { Wallet } from "@/domain/entities/Wallet";
import type { WalletRepository } from "@/domain/repositories/WalletRepository";
import { SEED_DEPOSITS, SEED_WALLETS, seedTransactions } from "./seed";

/**
 * The slice of a Redis client this adapter needs. Depending on this rather
 * than on `@upstash/redis` directly keeps the adapter unit-testable against a
 * fake, and means swapping Redis clients touches only the container.
 */
export type RedisLike = {
  rpush(key: string, ...values: string[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<unknown[]>;
  set(
    key: string,
    value: string,
    options?: { nx?: boolean },
  ): Promise<unknown>;
};

const LEDGER_KEY = "wallet:ledger";
const SEED_LOCK_KEY = "wallet:seeded:v1";

/**
 * Upstash returns list members already parsed when they are JSON. Accept both
 * shapes rather than assuming one.
 */
function toTransaction(entry: unknown): Transaction {
  return typeof entry === "string" ? (JSON.parse(entry) as Transaction) : (entry as Transaction);
}

/**
 * Append-only ledger in a Redis list: RPUSH to append, LRANGE to read it back.
 * The wallet set itself is fixed configuration, so it stays in code.
 */
export function createRedisWalletRepository(redis: RedisLike): WalletRepository {
  /**
   * Writes the opening deposits exactly once, ever. `SET NX` is atomic, so
   * only the first caller to win it seeds -- concurrent cold starts cannot
   * each append their own copy.
   */
  async function ensureSeeded(): Promise<void> {
    const won = await redis.set(SEED_LOCK_KEY, new Date().toISOString(), { nx: true });
    if (!won) return;
    const seeded = seedTransactions();
    if (seeded.length > 0) {
      await redis.rpush(LEDGER_KEY, ...seeded.map((tx) => JSON.stringify(tx)));
    }
  }

  async function allTransactions(): Promise<Transaction[]> {
    await ensureSeeded();
    const entries = await redis.lrange(LEDGER_KEY, 0, -1);
    return entries.map(toTransaction);
  }

  return {
    async listWallets(): Promise<Wallet[]> {
      return [...SEED_WALLETS];
    },

    async getWallet(id) {
      return SEED_WALLETS.find((wallet) => wallet.id === id);
    },

    async listTransactions(walletId) {
      const all = await allTransactions();
      const filtered = walletId
        ? all.filter(
            (tx) => tx.fromWalletId === walletId || tx.toWalletId === walletId,
          )
        : all;
      // Newest first for display; the stored list stays append-ordered.
      return [...filtered].reverse();
    },

    async getTransaction(id) {
      return (await allTransactions()).find((tx) => tx.id === id);
    },

    async append(entry) {
      await ensureSeeded();
      const transaction: Transaction = {
        ...entry,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      await redis.rpush(LEDGER_KEY, JSON.stringify(transaction));
      return transaction;
    },
  };
}

export { LEDGER_KEY, SEED_LOCK_KEY, SEED_DEPOSITS };
