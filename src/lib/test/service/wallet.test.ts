import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../errors";
import {
  balanceMinor,
  convert,
  deposit,
  getTransaction,
  getWallet,
  listTransactions,
  listWallets,
  transfer,
  withdraw,
} from "../../service/wallet";

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

describe("deposit", () => {
  it("credits the wallet and appends a DEPOSIT entry", () => {
    const before = balanceMinor("eur-main");

    const tx = deposit("eur-main", "12.34");

    expect(tx.type).toBe("DEPOSIT");
    expect(tx.toWalletId).toBe("eur-main");
    expect(tx.fromWalletId).toBeUndefined();
    expect(tx.amountMinor).toBe(1234);
    expect(balanceMinor("eur-main")).toBe(before + 1234);
  });

  it("rejects an unknown wallet and a malformed amount without writing", () => {
    const ledgerBefore = listTransactions().length;
    expect(() => deposit("ghost", "1.00")).toThrowError(
      expect.objectContaining({ code: "WALLET_NOT_FOUND" }) as unknown as Error,
    );
    expect(() => deposit("eur-main", "0")).toThrowError(
      expect.objectContaining({ code: "INVALID_AMOUNT" }) as unknown as Error,
    );
    expect(listTransactions()).toHaveLength(ledgerBefore);
  });
});

describe("withdraw", () => {
  it("debits the wallet and appends a WITHDRAWAL entry", () => {
    const before = balanceMinor("usd-savings");

    const tx = withdraw("usd-savings", "15.00");

    expect(tx.type).toBe("WITHDRAWAL");
    expect(tx.fromWalletId).toBe("usd-savings");
    expect(tx.toWalletId).toBeUndefined();
    expect(tx.amountMinor).toBe(1500);
    expect(balanceMinor("usd-savings")).toBe(before - 1500);
  });

  it("refuses to overdraw and writes nothing", () => {
    const before = balanceMinor("gbp-main"); // seeded at zero, untouched elsewhere
    const ledgerBefore = listTransactions().length;

    expect(() => withdraw("gbp-main", "0.01")).toThrowError(
      expect.objectContaining({ code: "INSUFFICIENT_FUNDS" }) as unknown as Error,
    );
    expect(balanceMinor("gbp-main")).toBe(before);
    expect(listTransactions()).toHaveLength(ledgerBefore);
  });
});

describe("listWallets / getWallet", () => {
  it("derives every wallet's balance from the ledger", () => {
    const wallets = listWallets();
    const usdMain = wallets.find((wallet) => wallet.id === "usd-main");

    expect(wallets).toHaveLength(6);
    expect(usdMain?.balanceMinor).toBe(balanceMinor("usd-main"));
    expect(usdMain?.balanceFormatted).toMatch(/^\$[\d,]+\.\d{2}$/);
  });

  it("404s for an unknown wallet", () => {
    expect(() => getWallet("ghost")).toThrowError(
      expect.objectContaining({ code: "WALLET_NOT_FOUND", status: 404 }) as unknown as Error,
    );
  });
});

describe("listTransactions / getTransaction", () => {
  it("filters to only the entries touching one wallet", () => {
    const filtered = listTransactions("jpy-main");
    expect(filtered.length).toBeGreaterThan(0);
    for (const tx of filtered) {
      expect([tx.fromWalletId, tx.toWalletId]).toContain("jpy-main");
    }
  });

  it("404s listing by an unknown wallet, and fetching an unknown transaction", () => {
    expect(() => listTransactions("ghost")).toThrowError(
      expect.objectContaining({ code: "WALLET_NOT_FOUND" }) as unknown as Error,
    );
    expect(() => getTransaction("does-not-exist")).toThrowError(
      expect.objectContaining({ code: "TRANSACTION_NOT_FOUND", status: 404 }) as unknown as Error,
    );
  });

  it("round-trips a transaction by id", () => {
    const tx = deposit("gbp-main", "1.00");
    expect(getTransaction(tx.id)).toEqual(tx);
  });
});
