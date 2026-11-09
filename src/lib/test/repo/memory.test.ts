import { describe, expect, it } from "vitest";
import { memoryWalletRepository as repo } from "../../repo/memory";

describe("memoryWalletRepository: seeded state", () => {
  it("seeds exactly the six documented wallets", () => {
    const wallets = repo.listWallets();
    expect(wallets.map((wallet) => wallet.id).sort()).toEqual(
      ["eur-main", "gbp-main", "idr-main", "jpy-main", "usd-main", "usd-savings"].sort(),
    );
  });

  it("seeds opening balances as real DEPOSIT transactions, not bare numbers", () => {
    const deposits = repo.listTransactions().filter((tx) => tx.id.startsWith("seed-"));
    expect(deposits.length).toBeGreaterThan(0);
    for (const tx of deposits) {
      expect(tx.type).toBe("DEPOSIT");
      expect(tx.fromWalletId).toBeUndefined();
      expect(typeof tx.toWalletId).toBe("string");
      expect(Number.isInteger(tx.amountMinor)).toBe(true);
    }
  });

  it("getWallet resolves a known id and returns undefined for an unknown one", () => {
    expect(repo.getWallet("usd-main")?.label).toBe("USD Main");
    expect(repo.getWallet("does-not-exist")).toBeUndefined();
  });
});

describe("memoryWalletRepository: append", () => {
  it("assigns an id and an ISO createdAt, and the entry becomes retrievable", () => {
    const before = repo.listTransactions().length;

    const tx = repo.append({ type: "DEPOSIT", toWalletId: "idr-main", amountMinor: 500, currency: "IDR" });

    expect(tx.id).toBeTruthy();
    expect(() => new Date(tx.createdAt).toISOString()).not.toThrow();
    expect(repo.listTransactions()).toHaveLength(before + 1);
    expect(repo.getTransaction(tx.id)).toEqual(tx);
  });

  it("never mutates a previously returned entry (the log is append-only)", () => {
    const tx = repo.append({ type: "DEPOSIT", toWalletId: "idr-main", amountMinor: 1, currency: "IDR" });
    const snapshot = { ...tx };

    repo.append({ type: "DEPOSIT", toWalletId: "idr-main", amountMinor: 2, currency: "IDR" });

    expect(repo.getTransaction(tx.id)).toEqual(snapshot);
  });
});

describe("memoryWalletRepository: listTransactions filtering", () => {
  it("includes an entry for a wallet filter when it is either side of the move", () => {
    const tx = repo.append({
      type: "TRANSFER",
      fromWalletId: "usd-main",
      toWalletId: "usd-savings",
      amountMinor: 100,
      currency: "USD",
    });

    expect(repo.listTransactions("usd-main").map((t) => t.id)).toContain(tx.id);
    expect(repo.listTransactions("usd-savings").map((t) => t.id)).toContain(tx.id);
    expect(repo.listTransactions("eur-main").map((t) => t.id)).not.toContain(tx.id);
  });

  it("returns newest first", () => {
    const first = repo.append({ type: "DEPOSIT", toWalletId: "gbp-main", amountMinor: 1, currency: "GBP" });
    const second = repo.append({ type: "DEPOSIT", toWalletId: "gbp-main", amountMinor: 2, currency: "GBP" });

    const filtered = repo.listTransactions("gbp-main");
    const firstIndex = filtered.findIndex((tx) => tx.id === first.id);
    const secondIndex = filtered.findIndex((tx) => tx.id === second.id);
    expect(secondIndex).toBeLessThan(firstIndex);
  });
});
