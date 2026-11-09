import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The container reads env at module load, so each case needs a fresh module
 * registry and a clean environment.
 */
const REDIS_VARS = [
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "VERCEL",
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(REDIS_VARS.map((key) => [key, process.env[key]]));
  for (const key of REDIS_VARS) delete process.env[key];
  vi.resetModules();
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
});

describe("container: which repository is wired in", () => {
  it("uses the in-memory ledger when no Redis is configured (local dev, tests)", async () => {
    const container = await import("@/infrastructure/container");
    // Proves it is usable without any Redis service present.
    await expect(container.listWallets()).resolves.toHaveLength(6);
  });

  // Pointed at a dead address: the read must FAIL rather than quietly fall
  // back to memory. A silent fallback is how a deploy looks healthy while
  // losing every transaction.
  it("sends reads to Redis when Vercel KV variables are set", async () => {
    process.env.KV_REST_API_URL = "http://127.0.0.1:1";
    process.env.KV_REST_API_TOKEN = "test-token";

    const container = await import("@/infrastructure/container");
    await expect(container.listWallets()).rejects.toThrow();
  });

  it("accepts the direct Upstash variable names too", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:1";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const container = await import("@/infrastructure/container");
    await expect(container.listWallets()).rejects.toThrow();
  });

  // Without this, a misconfigured deploy would look fine and quietly lose
  // every transaction between requests -- the worst possible failure mode.
  it("refuses to boot on Vercel with no Redis configured", async () => {
    process.env.VERCEL = "1";

    await expect(import("@/infrastructure/container")).rejects.toThrow(
      /Vercel without Redis configured/,
    );
  });
});
