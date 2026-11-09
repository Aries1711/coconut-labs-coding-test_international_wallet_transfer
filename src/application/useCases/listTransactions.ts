import type { Transaction } from "@/domain/entities/Transaction";
import { requireWallet, type WalletDeps } from "./shared";

export function makeListTransactions({ wallets }: WalletDeps) {
  return async function listTransactions(walletId?: string): Promise<Transaction[]> {
    if (walletId) await requireWallet(wallets, walletId);
    return wallets.listTransactions(walletId);
  };
}
