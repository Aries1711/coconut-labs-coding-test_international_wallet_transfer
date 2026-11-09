import { deltaFor } from "@/domain/entities/Transaction";
import type { WalletView } from "@/domain/entities/Wallet";
import { toWalletView, type WalletDeps } from "./shared";

/**
 * Every wallet with its balance derived from the ledger in a single pass,
 * rather than one fold per wallet.
 */
export function makeListWallets({ wallets }: WalletDeps) {
  return async function listWallets(): Promise<WalletView[]> {
    const [all, transactions] = await Promise.all([
      wallets.listWallets(),
      wallets.listTransactions(),
    ]);

    const balances = new Map<string, number>(all.map((wallet) => [wallet.id, 0]));
    for (const tx of transactions) {
      for (const walletId of [tx.fromWalletId, tx.toWalletId]) {
        if (!walletId || !balances.has(walletId)) continue;
        balances.set(walletId, balances.get(walletId)! + deltaFor(tx, walletId));
      }
    }
    return all.map((wallet) => toWalletView(wallet, balances.get(wallet.id) ?? 0));
  };
}
