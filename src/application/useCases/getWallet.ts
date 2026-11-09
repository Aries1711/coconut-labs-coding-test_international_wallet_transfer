import type { WalletView } from "@/domain/entities/Wallet";
import { balanceMinorOf, requireWallet, toWalletView, type WalletDeps } from "./shared";

export function makeGetWallet({ wallets }: WalletDeps) {
  return async function getWallet(id: string): Promise<WalletView> {
    const wallet = await requireWallet(wallets, id);
    return toWalletView(wallet, await balanceMinorOf(wallets, id));
  };
}

/** Exposed for callers that need only the number (e.g. tests, guards). */
export function makeGetBalanceMinor({ wallets }: WalletDeps) {
  return function balanceMinor(walletId: string): Promise<number> {
    return balanceMinorOf(wallets, walletId);
  };
}
