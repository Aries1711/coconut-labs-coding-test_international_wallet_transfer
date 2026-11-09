import type { NewTransaction, Transaction, Wallet } from "../types";

/**
 * Storage boundary. The in-memory implementation can be swapped for a file or
 * database adapter without touching the service layer: `append` is the only
 * write, and it is append-only.
 */
export interface WalletRepository {
  listWallets(): Wallet[];
  getWallet(id: string): Wallet | undefined;
  listTransactions(walletId?: string): Transaction[];
  getTransaction(id: string): Transaction | undefined;
  append(entry: NewTransaction): Transaction;
}
