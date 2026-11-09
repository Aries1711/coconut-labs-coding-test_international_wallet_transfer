import type { NewTransaction, Transaction } from "../entities/Transaction";
import type { Wallet } from "../entities/Wallet";

/**
 * Storage boundary, owned by the domain and implemented in infrastructure.
 * `append` is the only write, and it is append-only.
 *
 * Every method is async because an implementation may be network-backed
 * (Redis, SQL). The in-memory implementation satisfies it trivially; nothing
 * above this interface knows or cares which one is in use.
 */
export interface WalletRepository {
  listWallets(): Promise<Wallet[]>;
  getWallet(id: string): Promise<Wallet | undefined>;
  listTransactions(walletId?: string): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  append(entry: NewTransaction): Promise<Transaction>;
}
