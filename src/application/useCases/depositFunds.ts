import { parseAmountToMinor } from "@/domain/entities/Money";
import type { Transaction } from "@/domain/entities/Transaction";
import { requireWallet, type WalletDeps } from "./shared";

export function makeDepositFunds({ wallets }: WalletDeps) {
  return async function depositFunds(
    walletId: string,
    amount: string,
  ): Promise<Transaction> {
    const wallet = await requireWallet(wallets, walletId);
    const amountMinor = parseAmountToMinor(amount, wallet.currency);
    return wallets.append({
      type: "DEPOSIT",
      toWalletId: wallet.id,
      amountMinor,
      currency: wallet.currency,
    });
  };
}
