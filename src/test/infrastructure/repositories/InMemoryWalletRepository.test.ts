import { beforeEach, describe, expect, it } from "vitest";
import type { WalletRepository } from "@/domain/repositories/WalletRepository";
import { createInMemoryWalletRepository } from "@/infrastructure/repositories/InMemoryWalletRepository";

// The factory gives every test its own freshly seeded ledger, so no test
// depends on what another one appended.
let repo: WalletRepository;
beforeEach(() => {
  repo = createInMemoryWalletRepository();
});

describe("memoryWalletRepository: seeded state", () => {
  it("seeds exactly the six documented wallets", async () => {
    const wallets = await repo.listWallets();
    expect(wallets.map((wallet) => wallet.id).sort()).toEqual(
      ["eur-main", "gbp-main", "idr-main", "jpy-main", "usd-main", "usd-savings"].sort(),
    );
  });

  it("seeds opening balances as real DEPOSIT transactions, not bare numbers", async () => {
    const all = await repo.listTransactions();
    const deposits = all.filter((tx) => tx.id.startsWith("seed-"));

    expect(deposits.length).toBeGreaterThan(0);
    for (const tx of deposits) {
      expect(tx.type).toBe("DEPOSIT");
      expect(tx.fromWalletId).toBeUndefined();
      expect(typeof tx.toWalletId).toBe("string");
      expect(Number.isInteger(tx.amountMinor)).toBe(true);
    }
  });

  it("getWallet resolves a known id and returns undefined for an unknown one", async () => {
    expect((await repo.getWallet("usd-main"))?.label).toBe("USD Main");
    expect(await repo.getWallet("does-not-exist")).toBeUndefined();
  });
});

describe("memoryWalletRepository: append", () => {
  it("assigns an id and an ISO createdAt, and the entry becomes retrievable", async () => {
    const before = (await repo.listTransactions()).length;

    const tx = await repo.append({
      type: "DEPOSIT",
      toWalletId: "idr-main",
      amountMinor: 500,
      currency: "IDR",
    });

    expect(tx.id).toBeTruthy();
    expect(() => new Date(tx.createdAt).toISOString()).not.toThrow();
    expect(await repo.listTransactions()).toHaveLength(before + 1);
    expect(await repo.getTransaction(tx.id)).toEqual(tx);
  });

  it("never mutates a previously returned entry (the log is append-only)", async () => {
    const tx = await repo.append({
      type: "DEPOSIT",
      toWalletId: "idr-main",
      amountMinor: 1,
      currency: "IDR",
    });
    const snapshot = { ...tx };

    await repo.append({
      type: "DEPOSIT",
      toWalletId: "idr-main",
      amountMinor: 2,
      currency: "IDR",
    });

    expect(await repo.getTransaction(tx.id)).toEqual(snapshot);
  });
});

describe("memoryWalletRepository: listTransactions filtering", () => {
  it("includes an entry for a wallet filter when it is either side of the move", async () => {
    const tx = await repo.append({
      type: "TRANSFER",
      fromWalletId: "usd-main",
      toWalletId: "usd-savings",
      amountMinor: 100,
      currency: "USD",
    });

    expect((await repo.listTransactions("usd-main")).map((t) => t.id)).toContain(tx.id);
    expect((await repo.listTransactions("usd-savings")).map((t) => t.id)).toContain(tx.id);
    expect((await repo.listTransactions("eur-main")).map((t) => t.id)).not.toContain(tx.id);
  });

  it("returns newest first", async () => {
    const first = await repo.append({
      type: "DEPOSIT",
      toWalletId: "gbp-main",
      amountMinor: 1,
      currency: "GBP",
    });
    const second = await repo.append({
      type: "DEPOSIT",
      toWalletId: "gbp-main",
      amountMinor: 2,
      currency: "GBP",
    });

    const filtered = await repo.listTransactions("gbp-main");
    const firstIndex = filtered.findIndex((tx) => tx.id === first.id);
    const secondIndex = filtered.findIndex((tx) => tx.id === second.id);
    expect(secondIndex).toBeLessThan(firstIndex);
  });
});
