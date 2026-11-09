import type { Transaction } from "@/domain/entities/Transaction";
import { requireWallet, type WalletDeps } from "./shared";

export function makeListTransactions({ wallets }: WalletDeps) {
  return function listTransactions(walletId?: string): Transaction[] {
    if (walletId) requireWallet(wallets, walletId);
    return wallets.listTransactions(walletId);
  };
}
