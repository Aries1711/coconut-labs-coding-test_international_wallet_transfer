import type { NewTransaction, Transaction } from "../entities/Transaction";
import type { Wallet } from "../entities/Wallet";

/**
 * Storage boundary, owned by the domain and implemented in infrastructure.
 * `append` is the only write, and it is append-only: a file or SQL adapter can
 * replace the in-memory one without any layer above this interface changing.
 */
export interface WalletRepository {
  listWallets(): Wallet[];
  getWallet(id: string): Wallet | undefined;
  listTransactions(walletId?: string): Transaction[];
  getTransaction(id: string): Transaction | undefined;
  append(entry: NewTransaction): Transaction;
}
