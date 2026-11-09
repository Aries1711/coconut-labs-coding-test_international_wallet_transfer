import type { WalletView } from "@/domain/entities/Wallet";
import { balanceMinorOf, requireWallet, toWalletView, type WalletDeps } from "./shared";

export function makeGetWallet({ wallets }: WalletDeps) {
  return function getWallet(id: string): WalletView {
    const wallet = requireWallet(wallets, id);
    return toWalletView(wallet, balanceMinorOf(wallets, id));
  };
}

/** Exposed for callers that need only the number (e.g. tests, guards). */
export function makeGetBalanceMinor({ wallets }: WalletDeps) {
  return function balanceMinor(walletId: string): number {
    return balanceMinorOf(wallets, walletId);
  };
}
