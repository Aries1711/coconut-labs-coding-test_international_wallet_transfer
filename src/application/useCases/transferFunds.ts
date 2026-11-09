import { parseAmountToMinor } from "@/domain/entities/Money";
import type { Transaction } from "@/domain/entities/Transaction";
import { AppError } from "@/domain/errors";
import {
  assertSufficientFunds,
  requireDistinctWallets,
  type WalletDeps,
} from "./shared";

/** Same-currency move, 1:1. Both legs are one ledger entry, so it is atomic. */
export function makeTransferFunds({ wallets }: WalletDeps) {
  return async function transferFunds(
    fromWalletId: string,
    toWalletId: string,
    amount: string,
  ): Promise<Transaction> {
    const [source, target] = await requireDistinctWallets(
      wallets,
      fromWalletId,
      toWalletId,
    );
    if (source.currency !== target.currency) {
      throw new AppError(
        "CURRENCY_MISMATCH",
        422,
        `A transfer requires both wallets to hold the same currency (${source.currency} vs ${target.currency}). Use a conversion instead.`,
      );
    }
    const amountMinor = parseAmountToMinor(amount, source.currency);
    await assertSufficientFunds(wallets, source, amountMinor);
    return wallets.append({
      type: "TRANSFER",
      fromWalletId: source.id,
      toWalletId: target.id,
      amountMinor,
      currency: source.currency,
    });
  };
}
