import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../errors";
import { balanceMinor, convert, listTransactions, transfer } from "./wallet";

function mockFrankfurter(rate: number, date = "2026-11-09") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ date, base: "USD", quote: "JPY", rate }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("convert", () => {
  it("moves both legs in one ledger entry and stores the rate", async () => {
    mockFrankfurter(158.26);
    const usdBefore = balanceMinor("usd-main");
    const jpyBefore = balanceMinor("jpy-main");

    const tx = await convert("usd-main", "jpy-main", "10.00");

    expect(tx.type).toBe("CONVERSION");
    expect(tx.amountMinor).toBe(1000);
    expect(tx.targetAmountMinor).toBe(1583); // 1000 * 158.26 * 10^-2, half-up
    expect(tx.rate).toBe("158.26");
    expect(tx.rateDate).toBe("2026-11-09");
    expect(balanceMinor("usd-main")).toBe(usdBefore - 1000);
    expect(balanceMinor("jpy-main")).toBe(jpyBefore + 1583);
  });

  it("records nothing when Frankfurter is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("socket hang up"); }));
    const ledgerBefore = listTransactions().length;
    const usdBefore = balanceMinor("usd-main");

    // A pair not already in the 60s cache, so the failing fetch is reached.
    await expect(convert("usd-main", "gbp-main", "10.00")).rejects.toMatchObject({
      code: "RATE_UNAVAILABLE",
      status: 503,
    });
    expect(listTransactions()).toHaveLength(ledgerBefore);
    expect(balanceMinor("usd-main")).toBe(usdBefore);
  });

  it("rejects a same-currency pair and an overdraft without writing", async () => {
    mockFrankfurter(158.26);
    const ledgerBefore = listTransactions().length;

    await expect(convert("usd-main", "usd-savings", "1.00")).rejects.toBeInstanceOf(AppError);
    await expect(convert("usd-main", "jpy-main", "9999999.00")).rejects.toMatchObject({
      code: "INSUFFICIENT_FUNDS",
    });
    expect(listTransactions()).toHaveLength(ledgerBefore);
  });
});

describe("transfer", () => {
  it("moves funds 1:1 between same-currency wallets", () => {
    const fromBefore = balanceMinor("usd-main");
    const toBefore = balanceMinor("usd-savings");

    const tx = transfer("usd-main", "usd-savings", "25.50");

    expect(tx.amountMinor).toBe(2550);
    expect(balanceMinor("usd-main")).toBe(fromBefore - 2550);
    expect(balanceMinor("usd-savings")).toBe(toBefore + 2550);
  });

  it("refuses a cross-currency pair, the same wallet, and unknown wallets", () => {
    expect(() => transfer("usd-main", "eur-main", "1.00")).toThrowError(AppError);
    expect(() => transfer("usd-main", "usd-main", "1.00")).toThrowError(AppError);
    expect(() => transfer("ghost", "usd-main", "1.00")).toThrowError(AppError);
  });
});
