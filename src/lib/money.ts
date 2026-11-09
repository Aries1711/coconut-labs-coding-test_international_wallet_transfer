import type { Currency } from "./currencies";
import { AppError } from "./errors";

/**
 * Money is always handled as integer minor units (cents, sen, rupiah...).
 * Floats appear in exactly one place: formatting for display.
 */

const decimalsCache = new Map<Currency, number>();

/** Minor-unit exponent for a currency, from the Intl database (JPY=0, USD=2). */
export function decimalsFor(currency: Currency): number {
  const cached = decimalsCache.get(currency);
  if (cached !== undefined) return cached;
  const decimals =
    new Intl.NumberFormat("en-US", { style: "currency", currency })
      .resolvedOptions().maximumFractionDigits ?? 2;
  decimalsCache.set(currency, decimals);
  return decimals;
}

const AMOUNT_PATTERN = /^\d+(\.\d+)?$/;

/**
 * Parses a user-supplied decimal string into minor units without ever
 * constructing a float. Rejects anything that is not a positive amount with
 * at most the currency's number of decimal places.
 */
export function parseAmountToMinor(raw: string, currency: Currency): number {
  const input = raw.trim();
  if (!AMOUNT_PATTERN.test(input)) {
    throw new AppError(
      "INVALID_AMOUNT",
      400,
      `"${raw}" is not a valid amount. Use a positive decimal number, e.g. "10.50".`,
    );
  }

  const decimals = decimalsFor(currency);
  const [whole, fraction = ""] = input.split(".");
  if (fraction.length > decimals) {
    throw new AppError(
      "TOO_MANY_DECIMALS",
      400,
      decimals === 0
        ? `${currency} amounts cannot have decimal places.`
        : `${currency} amounts support at most ${decimals} decimal place(s).`,
    );
  }

  const minor = Number(`${whole}${fraction.padEnd(decimals, "0")}`);
  if (!Number.isSafeInteger(minor)) {
    throw new AppError("AMOUNT_TOO_LARGE", 400, "Amount is too large to process.");
  }
  if (minor <= 0) {
    throw new AppError("INVALID_AMOUNT", 400, "Amount must be greater than zero.");
  }
  return minor;
}

/** Minor units -> plain decimal string, e.g. (1234, "USD") -> "12.34". */
export function minorToDecimalString(minor: number, currency: Currency): string {
  const decimals = decimalsFor(currency);
  const sign = minor < 0 ? "-" : "";
  const digits = Math.abs(minor).toString().padStart(decimals + 1, "0");
  if (decimals === 0) return `${sign}${digits}`;
  return `${sign}${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
}

/** Display only: the float here never feeds back into a stored balance. */
export function formatMinor(minor: number, currency: Currency): string {
  const decimals = decimalsFor(currency);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(minor / 10 ** decimals);
}

/** Integer division rounding half-up. Inputs are non-negative, d > 0. */
export function divRoundHalfUp(n: bigint, d: bigint): bigint {
  return (2n * n + d) / (2n * d);
}

const RATE_PATTERN = /^\d+(\.\d+)?$/;

/**
 * targetMinor = roundHalfUp(sourceMinor * rate * 10^(targetDecimals - sourceDecimals))
 * computed entirely in BigInt so large/low-denomination pairs (USD -> IDR)
 * keep full precision. `rate` stays a decimal string end to end.
 */
export function convertMinor(
  sourceMinor: number,
  rate: string,
  from: Currency,
  to: Currency,
): number {
  if (!RATE_PATTERN.test(rate)) {
    throw new AppError("RATE_UNAVAILABLE", 503, `Received an unusable rate: "${rate}".`);
  }

  const [rateWhole, rateFraction = ""] = rate.split(".");
  const rateScaled = BigInt(`${rateWhole}${rateFraction}`);
  const shift = decimalsFor(to) - decimalsFor(from);

  let numerator = BigInt(sourceMinor) * rateScaled;
  let denominator = 10n ** BigInt(rateFraction.length);
  if (shift >= 0) {
    numerator *= 10n ** BigInt(shift);
  } else {
    denominator *= 10n ** BigInt(-shift);
  }

  return Number(divRoundHalfUp(numerator, denominator));
}
