import { convertMinor, formatMinor, parseAmountToMinor } from "@/domain/entities/Money";
import type { Transaction } from "@/domain/entities/Transaction";
import { AppError } from "@/domain/errors";
import type { ExchangeRateRepository } from "@/domain/repositories/ExchangeRateRepository";
import {
  assertSufficientFunds,
  requireDistinctWallets,
  type WalletDeps,
} from "./shared";

type Deps = WalletDeps & { rates: ExchangeRateRepository };

/** Cross-currency move at the live mid-market rate. Also one ledger entry. */
export function makeConvertCurrency({ wallets, rates }: Deps) {
  return async function convertCurrency(
    fromWalletId: string,
    toWalletId: string,
    amount: string,
  ): Promise<Transaction> {
    const [source, target] = requireDistinctWallets(wallets, fromWalletId, toWalletId);
    if (source.currency === target.currency) {
      throw new AppError(
        "CURRENCY_MATCH_FOR_CONVERSION",
        422,
        `Both wallets hold ${source.currency}. Use a transfer instead.`,
      );
    }
    const amountMinor = parseAmountToMinor(amount, source.currency);
    assertSufficientFunds(wallets, source, amountMinor);

    // Fetched before the append: a rate failure throws and nothing is recorded.
    const rate = await rates.getRate(source.currency, target.currency);
    const targetAmountMinor = convertMinor(
      amountMinor,
      rate.rate,
      source.currency,
      target.currency,
    );
    if (targetAmountMinor <= 0) {
      throw new AppError(
        "ROUNDS_TO_ZERO",
        422,
        `${formatMinor(amountMinor, source.currency)} converts to less than the smallest ${target.currency} unit at the current rate.`,
      );
    }

    // Awaiting the rate yielded the event loop, so re-check funds against the
    // ledger immediately before the append: nothing else may have spent them.
    assertSufficientFunds(wallets, source, amountMinor);

    return wallets.append({
      type: "CONVERSION",
      fromWalletId: source.id,
      toWalletId: target.id,
      amountMinor,
      currency: source.currency,
      targetAmountMinor,
      targetCurrency: target.currency,
      rate: rate.rate,
      rateDate: rate.date,
    });
  };
}
