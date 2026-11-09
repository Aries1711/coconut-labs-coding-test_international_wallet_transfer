import type { Currency } from "../entities/Currency";
import type { ExchangeRate } from "../entities/ExchangeRate";

/**
 * Read-only access to published exchange rates, owned by the domain and
 * implemented in infrastructure (currently Frankfurter). Implementations must
 * throw rather than ever return an invented or stale-beyond-policy rate.
 */
export interface ExchangeRateRepository {
  getRate(from: Currency, to: Currency): Promise<ExchangeRate>;
}
