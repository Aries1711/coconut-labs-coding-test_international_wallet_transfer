/** Curated set of supported currencies. Frankfurter supports all of these. */
export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "SGD",
  "AUD",
  "IDR",
] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export function isCurrency(value: unknown): value is Currency {
  return (
    typeof value === "string" &&
    (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
  );
}
