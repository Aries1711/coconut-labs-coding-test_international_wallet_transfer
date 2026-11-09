import { describe, expect, it } from "vitest";
import { AppError } from "../errors";
import type { ErrorCode } from "../errors";
import {
  convertMinor,
  decimalsFor,
  divRoundHalfUp,
  formatMinor,
  minorToDecimalString,
  parseAmountToMinor,
} from "../money";

/** Asserts the thrown AppError carries the expected domain code. */
function expectErrorCode(run: () => unknown, code: ErrorCode): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return;
  }
  throw new Error(`expected an AppError with code ${code}, but nothing was thrown`);
}

describe("decimalsFor", () => {
  it("reads minor-unit exponents from Intl", () => {
    expect(decimalsFor("USD")).toBe(2);
    expect(decimalsFor("EUR")).toBe(2);
    expect(decimalsFor("JPY")).toBe(0);
    // CLDR gives IDR two fraction digits, so IDR balances are held in sen.
    expect(decimalsFor("IDR")).toBe(2);
  });
});

describe("parseAmountToMinor", () => {
  it("parses decimal strings into minor units", () => {
    expect(parseAmountToMinor("10.50", "USD")).toBe(1050);
    expect(parseAmountToMinor("0.01", "USD")).toBe(1);
    expect(parseAmountToMinor("1000", "USD")).toBe(100_000);
    expect(parseAmountToMinor("7", "JPY")).toBe(7);
    expect(parseAmountToMinor(" 2.5 ", "USD")).toBe(250);
  });

  it("does not lose precision on values that are inexact as floats", () => {
    // 0.1 + 0.2 territory: 8.70 must be exactly 870 minor units.
    expect(parseAmountToMinor("8.70", "USD")).toBe(870);
  });

  it("rejects more decimals than the currency allows", () => {
    expectErrorCode(() => parseAmountToMinor("1.005", "USD"), "TOO_MANY_DECIMALS");
    expectErrorCode(() => parseAmountToMinor("100.5", "JPY"), "TOO_MANY_DECIMALS");
  });

  it("rejects non-positive and malformed amounts", () => {
    for (const bad of ["0", "0.00", "-5", "abc", "", "1e3", "1,000", "1.2.3", "."]) {
      expect(() => parseAmountToMinor(bad, "USD")).toThrow(AppError);
    }
  });
});

describe("minorToDecimalString / formatMinor", () => {
  it("renders minor units without float artifacts", () => {
    expect(minorToDecimalString(1050, "USD")).toBe("10.50");
    expect(minorToDecimalString(5, "USD")).toBe("0.05");
    expect(minorToDecimalString(0, "USD")).toBe("0.00");
    expect(minorToDecimalString(75_000, "JPY")).toBe("75000");
    expect(minorToDecimalString(-250, "USD")).toBe("-2.50");
    expect(formatMinor(254_050, "USD")).toBe("$2,540.50");
    expect(formatMinor(75_000, "JPY")).toBe("¥75,000");
  });
});

describe("divRoundHalfUp", () => {
  it("rounds halves away from zero and leaves others alone", () => {
    expect(divRoundHalfUp(5n, 2n)).toBe(3n); // 2.5 -> 3
    expect(divRoundHalfUp(3n, 2n)).toBe(2n); // 1.5 -> 2
    expect(divRoundHalfUp(4n, 2n)).toBe(2n); // 2.0 -> 2
    expect(divRoundHalfUp(1n, 3n)).toBe(0n); // 0.33 -> 0
    expect(divRoundHalfUp(2n, 3n)).toBe(1n); // 0.67 -> 1
  });
});

describe("convertMinor", () => {
  it("converts across differing decimal places", () => {
    // $10.00 at 158.26 -> 1582.6 JPY -> 1583 (half-up)
    expect(convertMinor(1000, "158.26", "USD", "JPY")).toBe(1583);
    // $10.00 at 0.89315 -> 893.15 cents -> 893
    expect(convertMinor(1000, "0.89315", "USD", "EUR")).toBe(893);
    // $10.00 at 18116 -> IDR 181,160.00 exactly (18,116,000 sen)
    expect(convertMinor(1000, "18116", "USD", "IDR")).toBe(18_116_000);
    // 75,000 JPY at 0.0063 -> $472.50 -> 47250 cents
    expect(convertMinor(75_000, "0.0063", "JPY", "USD")).toBe(47_250);
  });

  it("rounds exact halves up", () => {
    // 1000 cents * 0.15 * 10^-2 = 1.5 JPY -> 2
    expect(convertMinor(1000, "0.15", "USD", "JPY")).toBe(2);
  });

  it("returns zero when the amount is smaller than one target unit", () => {
    // IDR 0.01 (1 sen) at 0.0094 -> 0.0000094 JPY -> 0, which the service rejects.
    expect(convertMinor(1, "0.0094", "IDR", "JPY")).toBe(0);
  });

  it("keeps full precision on large low-denomination amounts", () => {
    // IDR 10,000,000.00 (1e9 sen) at 0.00653 -> $65,300.00 (6,530,000 cents)
    expect(convertMinor(1_000_000_000, "0.00653", "IDR", "USD")).toBe(6_530_000);
  });

  it("refuses an unusable rate instead of inventing one", () => {
    expectErrorCode(() => convertMinor(1000, "not-a-rate", "USD", "EUR"), "RATE_UNAVAILABLE");
  });
});
