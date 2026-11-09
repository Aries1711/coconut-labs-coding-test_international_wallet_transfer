import { AppError } from "../errors";
import type { Currency } from "./Currency";

/**
 * Money is always handled as integer minor units (cents, rupiah, yen...).
 * Floats appear in exactly one place: formatting for display.
 *
 * The minor-unit exponent is pinned here, not derived from the runtime -- see
 * MINOR_UNIT_EXPONENT below for why that distinction is load-bearing.
 */

/**
 * Minor-unit exponents, pinned deliberately rather than read from `Intl`.
 *
 * The exponent decides what a stored `amountMinor` integer *means*. `Intl`'s
 * answer comes from the CLDR data bundled with the Node build, and CLDR moved
 * IDR from 2 fraction digits to 0 -- so local Node 22.2.0 says 2 while the
 * deployed runtime says 0. Each environment was self-consistent and therefore
 * looked correct alone, but the same ledger row read by the other runtime was
 * off by 100x. See issue #10.
 *
 * Deriving a *rendering* from a library is fine; the library improving is a
 * feature. Deriving the *meaning of persisted data* from one is not, because
 * the library can change underneath data that was already written.
 *
 * `Record<Currency, number>` makes the table total: adding a currency to
 * SUPPORTED_CURRENCIES without an exponent here is a compile error rather than
 * a silent `undefined` propagating into money arithmetic.
 */
const MINOR_UNIT_EXPONENT: Record<Currency, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  SGD: 2,
  AUD: 2,
  // Rupiah are not subdivided in practice -- sen left circulation decades ago.
  // 0 also matches the deployed runtime, so the live ledger needs no migration.
  IDR: 0,
};

/** Minor-unit exponent for a currency (JPY=0, USD=2, IDR=0). */
export function decimalsFor(currency: Currency): number {
  return MINOR_UNIT_EXPONENT[currency];
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
