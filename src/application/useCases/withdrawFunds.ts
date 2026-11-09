import { parseAmountToMinor } from "@/domain/entities/Money";
import type { Transaction } from "@/domain/entities/Transaction";
import { assertSufficientFunds, requireWallet, type WalletDeps } from "./shared";

export function makeWithdrawFunds({ wallets }: WalletDeps) {
  return async function withdrawFunds(
    walletId: string,
    amount: string,
  ): Promise<Transaction> {
    const wallet = await requireWallet(wallets, walletId);
    const amountMinor = parseAmountToMinor(amount, wallet.currency);
    await assertSufficientFunds(wallets, wallet, amountMinor);
    return wallets.append({
      type: "WITHDRAWAL",
      fromWalletId: wallet.id,
      amountMinor,
      currency: wallet.currency,
    });
  };
}
