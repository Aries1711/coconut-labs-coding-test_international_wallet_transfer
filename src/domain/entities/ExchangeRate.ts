import type { Currency } from "./Currency";

/**
 * A mid-market rate as quoted, for a given date. `rate` is a decimal *string*
 * so the quoted value is never degraded by a float round-trip.
 */
export type ExchangeRate = {
  from: Currency;
  to: Currency;
  rate: string;
  date: string;
};
