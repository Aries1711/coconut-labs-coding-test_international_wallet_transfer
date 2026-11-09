import { describe, expect, it } from "vitest";
import { AppError } from "@/domain/errors";
import type { ExchangeRateRepository } from "@/domain/repositories/ExchangeRateRepository";
import { makeConvertCurrency } from "@/application/useCases/convertCurrency";
import { makeDepositFunds } from "@/application/useCases/depositFunds";
import { makeGetTransaction } from "@/application/useCases/getTransaction";
import { makeGetBalanceMinor, makeGetWallet } from "@/application/useCases/getWallet";
import { makeListTransactions } from "@/application/useCases/listTransactions";
import { makeListWallets } from "@/application/useCases/listWallets";
import { makeTransferFunds } from "@/application/useCases/transferFunds";
import { makeWithdrawFunds } from "@/application/useCases/withdrawFunds";
import { createInMemoryWalletRepository } from "@/infrastructure/repositories/InMemoryWalletRepository";

/** Frankfurter is mocked at the port, so no network or fetch stub is involved. */
function stubRates(rate: string, date = "2026-11-09"): ExchangeRateRepository {
  return { getRate: async (from, to) => ({ from, to, rate, date }) };
}

function unavailableRates(): ExchangeRateRepository {
  return {
    getRate: async () => {
      throw new AppError("RATE_UNAVAILABLE", 503, "Rate provider is down.");
    },
  };
}

/** A fresh, independently seeded ledger per test. */
function setup(rates: ExchangeRateRepository = stubRates("158.26")) {
  const wallets = createInMemoryWalletRepository();
  return {
    wallets,
    balanceMinor: makeGetBalanceMinor({ wallets }),
    listWallets: makeListWallets({ wallets }),
    getWallet: makeGetWallet({ wallets }),
    deposit: makeDepositFunds({ wallets }),
    withdraw: makeWithdrawFunds({ wallets }),
    transfer: makeTransferFunds({ wallets }),
    convert: makeConvertCurrency({ wallets, rates }),
    listTransactions: makeListTransactions({ wallets }),
    getTransaction: makeGetTransaction({ wallets }),
  };
}

describe("convertCurrency", () => {
  it("moves both legs in one ledger entry and stores the rate", async () => {
    const { convert, balanceMinor } = setup();
    const usdBefore = await balanceMinor("usd-main");
    const jpyBefore = await balanceMinor("jpy-main");

    const tx = await convert("usd-main", "jpy-main", "10.00");

    expect(tx.type).toBe("CONVERSION");
    expect(tx.amountMinor).toBe(1000);
    expect(tx.targetAmountMinor).toBe(1583); // 1000 * 158.26 * 10^-2, half-up
    expect(tx.rate).toBe("158.26");
    expect(tx.rateDate).toBe("2026-11-09");
    expect(await balanceMinor("usd-main")).toBe(usdBefore - 1000);
    expect(await balanceMinor("jpy-main")).toBe(jpyBefore + 1583);
  });

  it("records nothing when the rate provider is unavailable", async () => {
    const { convert, balanceMinor, listTransactions } = setup(unavailableRates());
    const ledgerBefore = (await listTransactions()).length;
    const usdBefore = await balanceMinor("usd-main");

    await expect(convert("usd-main", "gbp-main", "10.00")).rejects.toMatchObject({
      code: "RATE_UNAVAILABLE",
      status: 503,
    });
    expect(await listTransactions()).toHaveLength(ledgerBefore);
    expect(await balanceMinor("usd-main")).toBe(usdBefore);
  });

  it("rejects a same-currency pair and an overdraft without writing", async () => {
    const { convert, listTransactions } = setup();
    const ledgerBefore = (await listTransactions()).length;

    await expect(convert("usd-main", "usd-savings", "1.00")).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(convert("usd-main", "jpy-main", "9999999.00")).rejects.toMatchObject({
      code: "INSUFFICIENT_FUNDS",
    });
    expect(await listTransactions()).toHaveLength(ledgerBefore);
  });

  it("refuses a conversion that rounds away to nothing in the target currency", async () => {
    // 1 sen of IDR at a tiny rate lands below one JPY unit.
    const { convert, deposit, listTransactions } = setup(stubRates("0.0094"));
    await deposit("idr-main", "0.01");
    const ledgerBefore = (await listTransactions()).length;

    await expect(convert("idr-main", "jpy-main", "0.01")).rejects.toMatchObject({
      code: "ROUNDS_TO_ZERO",
    });
    expect(await listTransactions()).toHaveLength(ledgerBefore);
  });
});

describe("transferFunds", () => {
  it("moves funds 1:1 between same-currency wallets", async () => {
    const { transfer, balanceMinor } = setup();
    const fromBefore = await balanceMinor("usd-main");
    const toBefore = await balanceMinor("usd-savings");

    const tx = await transfer("usd-main", "usd-savings", "25.50");

    expect(tx.amountMinor).toBe(2550);
    expect(await balanceMinor("usd-main")).toBe(fromBefore - 2550);
    expect(await balanceMinor("usd-savings")).toBe(toBefore + 2550);
  });

  it("refuses a cross-currency pair, the same wallet, and unknown wallets", async () => {
    const { transfer } = setup();
    await expect(transfer("usd-main", "eur-main", "1.00")).rejects.toThrowError(
      AppError,
    );
    await expect(transfer("usd-main", "usd-main", "1.00")).rejects.toThrowError(
      AppError,
    );
    await expect(transfer("ghost", "usd-main", "1.00")).rejects.toThrowError(
      AppError,
    );
  });
});

describe("depositFunds", () => {
  it("credits the wallet and appends a DEPOSIT entry", async () => {
    const { deposit, balanceMinor } = setup();
    const before = await balanceMinor("eur-main");

    const tx = await deposit("eur-main", "12.34");

    expect(tx.type).toBe("DEPOSIT");
    expect(tx.toWalletId).toBe("eur-main");
    expect(tx.fromWalletId).toBeUndefined();
    expect(tx.amountMinor).toBe(1234);
    expect(await balanceMinor("eur-main")).toBe(before + 1234);
  });

  it("rejects an unknown wallet and a malformed amount without writing", async () => {
    const { deposit, listTransactions } = setup();
    const ledgerBefore = (await listTransactions()).length;

    await expect(deposit("ghost", "1.00")).rejects.toThrowError(
      expect.objectContaining({ code: "WALLET_NOT_FOUND" }) as unknown as Error,
    );
    await expect(deposit("eur-main", "0")).rejects.toThrowError(
      expect.objectContaining({ code: "INVALID_AMOUNT" }) as unknown as Error,
    );
    expect(await listTransactions()).toHaveLength(ledgerBefore);
  });
});

describe("withdrawFunds", () => {
  it("debits the wallet and appends a WITHDRAWAL entry", async () => {
    const { withdraw, balanceMinor } = setup();
    const before = await balanceMinor("usd-savings");

    const tx = await withdraw("usd-savings", "15.00");

    expect(tx.type).toBe("WITHDRAWAL");
    expect(tx.fromWalletId).toBe("usd-savings");
    expect(tx.toWalletId).toBeUndefined();
    expect(tx.amountMinor).toBe(1500);
    expect(await balanceMinor("usd-savings")).toBe(before - 1500);
  });

  it("refuses to overdraw and writes nothing", async () => {
    const { withdraw, balanceMinor, listTransactions } = setup();
    const before = await balanceMinor("gbp-main"); // seeded at zero
    const ledgerBefore = (await listTransactions()).length;

    await expect(withdraw("gbp-main", "0.01")).rejects.toThrowError(
      expect.objectContaining({ code: "INSUFFICIENT_FUNDS" }) as unknown as Error,
    );
    expect(await balanceMinor("gbp-main")).toBe(before);
    expect(await listTransactions()).toHaveLength(ledgerBefore);
  });
});

describe("listWallets / getWallet", () => {
  it("derives every wallet's balance from the ledger", async () => {
    const { listWallets, balanceMinor } = setup();
    const wallets = await listWallets();
    const usdMain = wallets.find((wallet) => wallet.id === "usd-main");

    expect(wallets).toHaveLength(6);
    expect(usdMain?.balanceMinor).toBe(await balanceMinor("usd-main"));
    expect(usdMain?.balanceFormatted).toMatch(/^\$[\d,]+\.\d{2}$/);
  });

  it("404s for an unknown wallet", async () => {
    const { getWallet } = setup();
    await expect(getWallet("ghost")).rejects.toThrowError(
      expect.objectContaining({
        code: "WALLET_NOT_FOUND",
        status: 404,
      }) as unknown as Error,
    );
  });
});

describe("listTransactions / getTransaction", () => {
  it("filters to only the entries touching one wallet", async () => {
    const { listTransactions } = setup();
    const filtered = await listTransactions("jpy-main");

    expect(filtered.length).toBeGreaterThan(0);
    for (const tx of filtered) {
      expect([tx.fromWalletId, tx.toWalletId]).toContain("jpy-main");
    }
  });

  it("404s listing by an unknown wallet, and fetching an unknown transaction", async () => {
    const { listTransactions, getTransaction } = setup();
    await expect(listTransactions("ghost")).rejects.toThrowError(
      expect.objectContaining({ code: "WALLET_NOT_FOUND" }) as unknown as Error,
    );
    await expect(getTransaction("does-not-exist")).rejects.toThrowError(
      expect.objectContaining({
        code: "TRANSACTION_NOT_FOUND",
        status: 404,
      }) as unknown as Error,
    );
  });

  it("round-trips a transaction by id", async () => {
    const { deposit, getTransaction } = setup();
    const tx = await deposit("gbp-main", "1.00");
    await expect(getTransaction(tx.id)).resolves.toEqual(tx);
  });
});
