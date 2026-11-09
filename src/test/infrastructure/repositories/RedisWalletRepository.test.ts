import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRedisWalletRepository,
  type RedisLike,
} from "@/infrastructure/repositories/RedisWalletRepository";

/**
 * A fake standing in for Upstash. The adapter depends on a three-method slice
 * of a Redis client, so its whole behaviour is testable without a server --
 * and this fake also proves the adapter only uses operations Redis really has.
 */
function createFakeRedis() {
  const lists = new Map<string, string[]>();
  const strings = new Map<string, string>();

  const client: RedisLike & {
    /** Returns raw list contents, to assert on what was actually stored. */
    _raw: (key: string) => string[];
    /** Upstash sometimes parses JSON members for you; simulate that mode. */
    _parseOnRead: boolean;
  } = {
    _parseOnRead: false,
    _raw: (key) => lists.get(key) ?? [],

    async rpush(key, ...values) {
      const list = lists.get(key) ?? [];
      list.push(...values);
      lists.set(key, list);
      return list.length;
    },

    async lrange(key, start, stop) {
      const list = lists.get(key) ?? [];
      const end = stop === -1 ? list.length : stop + 1;
      const slice = list.slice(start, end);
      return client._parseOnRead ? slice.map((entry) => JSON.parse(entry)) : slice;
    },

    async set(key, value, options) {
      if (options?.nx && strings.has(key)) return null; // NX: only if absent
      strings.set(key, value);
      return "OK";
    },
  };

  return client;
}

let redis: ReturnType<typeof createFakeRedis>;
beforeEach(() => {
  redis = createFakeRedis();
});

describe("RedisWalletRepository: seeding", () => {
  it("writes the opening deposits on first use", async () => {
    const repo = createRedisWalletRepository(redis);

    const transactions = await repo.listTransactions();

    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions.every((tx) => tx.type === "DEPOSIT")).toBe(true);
  });

  // A cold start must not re-seed: that would conjure money out of nothing.
  it("seeds exactly once across repeated reads and new instances", async () => {
    const first = createRedisWalletRepository(redis);
    await first.listTransactions();
    const afterFirst = redis._raw("wallet:ledger").length;

    await first.listTransactions();
    const second = createRedisWalletRepository(redis); // simulates a cold start
    await second.listTransactions();

    expect(redis._raw("wallet:ledger")).toHaveLength(afterFirst);
  });

  it("uses SET NX for the seed guard, so concurrent cold starts cannot both seed", async () => {
    const setSpy = vi.spyOn(redis, "set");
    await createRedisWalletRepository(redis).listTransactions();

    expect(setSpy).toHaveBeenCalledWith(
      "wallet:seeded:v1",
      expect.any(String),
      { nx: true },
    );
  });
});

describe("RedisWalletRepository: append-only ledger", () => {
  it("appends an entry with an id and timestamp, and reads it back", async () => {
    const repo = createRedisWalletRepository(redis);
    const before = (await repo.listTransactions()).length;

    const tx = await repo.append({
      type: "DEPOSIT",
      toWalletId: "gbp-main",
      amountMinor: 4200,
      currency: "GBP",
    });

    expect(tx.id).toBeTruthy();
    expect(() => new Date(tx.createdAt).toISOString()).not.toThrow();
    expect(await repo.listTransactions()).toHaveLength(before + 1);
    expect(await repo.getTransaction(tx.id)).toEqual(tx);
  });

  it("stores entries by RPUSH, never rewriting what is already there", async () => {
    const repo = createRedisWalletRepository(redis);
    await repo.listTransactions(); // seed
    const seeded = redis._raw("wallet:ledger").slice();

    await repo.append({
      type: "DEPOSIT",
      toWalletId: "gbp-main",
      amountMinor: 1,
      currency: "GBP",
    });

    const after = redis._raw("wallet:ledger");
    // Every previously stored entry is still there, byte for byte, in order.
    expect(after.slice(0, seeded.length)).toEqual(seeded);
    expect(after).toHaveLength(seeded.length + 1);
  });

  it("survives a new repository instance, unlike the in-memory store", async () => {
    const tx = await createRedisWalletRepository(redis).append({
      type: "DEPOSIT",
      toWalletId: "eur-main",
      amountMinor: 999,
      currency: "EUR",
    });

    // A different instance is what a second serverless invocation looks like.
    const fresh = createRedisWalletRepository(redis);
    expect(await fresh.getTransaction(tx.id)).toEqual(tx);
  });
});

describe("RedisWalletRepository: reads", () => {
  it("filters to entries touching one wallet, either side", async () => {
    const repo = createRedisWalletRepository(redis);
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
    const repo = createRedisWalletRepository(redis);
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
    expect(filtered.findIndex((tx) => tx.id === second.id)).toBeLessThan(
      filtered.findIndex((tx) => tx.id === first.id),
    );
  });

  it("exposes the same six wallets as the in-memory store", async () => {
    const repo = createRedisWalletRepository(redis);
    expect((await repo.listWallets()).map((w) => w.id).sort()).toEqual(
      ["eur-main", "gbp-main", "idr-main", "jpy-main", "usd-main", "usd-savings"].sort(),
    );
    expect((await repo.getWallet("jpy-main"))?.currency).toBe("JPY");
    expect(await repo.getWallet("nope")).toBeUndefined();
  });

  // Upstash returns already-parsed objects for JSON members in some configs.
  it("reads entries back whether the client parses JSON for us or not", async () => {
    const repo = createRedisWalletRepository(redis);
    const tx = await repo.append({
      type: "DEPOSIT",
      toWalletId: "gbp-main",
      amountMinor: 7,
      currency: "GBP",
    });

    redis._parseOnRead = true;
    const fresh = createRedisWalletRepository(redis);
    expect(await fresh.getTransaction(tx.id)).toEqual(tx);
  });
});
