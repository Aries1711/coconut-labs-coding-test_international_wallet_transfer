import type { Currency } from "@/domain/entities/Currency";
import type { ExchangeRate } from "@/domain/entities/ExchangeRate";
import type { ExchangeRateRepository } from "@/domain/repositories/ExchangeRateRepository";

/** Rate preview for the convert form. Does not touch the ledger. */
export function makeGetExchangeRate({ rates }: { rates: ExchangeRateRepository }) {
  return function getExchangeRate(from: Currency, to: Currency): Promise<ExchangeRate> {
    return rates.getRate(from, to);
  };
}
