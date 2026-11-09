import type { Currency } from "@/domain/entities/Currency";
import type { ExchangeRate } from "@/domain/entities/ExchangeRate";
import { AppError } from "@/domain/errors";
import type { ExchangeRateRepository } from "@/domain/repositories/ExchangeRateRepository";

const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;
const BASE_URL = "https://api.frankfurter.dev/v2/rate";

type CacheEntry = { rate: ExchangeRate; expiresAt: number };

/**
 * Frankfurter returns the rate as a JSON number. We pull the raw token out of
 * the response text so the decimal string is preserved exactly and never
 * passes through a float.
 */
function extractRateToken(body: string): string | undefined {
  return /"rate"\s*:\s*(\d+(?:\.\d+)?)/.exec(body)?.[1];
}

export type FrankfurterOptions = {
  baseUrl?: string;
  cacheTtlMs?: number;
  timeoutMs?: number;
  /** Supply a cache to share (the app passes a globalThis-backed one). */
  cache?: Map<string, CacheEntry>;
};

/**
 * Mid-market rates from Frankfurter v2, cached per pair.
 * Throws RATE_UNAVAILABLE (503) on any failure -- never invents a rate.
 */
export function createFrankfurterExchangeRateRepository(
  options: FrankfurterOptions = {},
): ExchangeRateRepository {
  const baseUrl = options.baseUrl ?? BASE_URL;
  const ttlMs = options.cacheTtlMs ?? CACHE_TTL_MS;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const cache = options.cache ?? new Map<string, CacheEntry>();

  return {
    async getRate(from: Currency, to: Currency): Promise<ExchangeRate> {
      if (from === to) {
        return { from, to, rate: "1", date: new Date().toISOString().slice(0, 10) };
      }

      const key = `${from}:${to}`;
      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.rate;

      let body: string;
      try {
        const response = await fetch(`${baseUrl}/${from}/${to}`, {
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Frankfurter responded ${response.status}`);
        }
        body = await response.text();
      } catch (cause) {
        throw new AppError(
          "RATE_UNAVAILABLE",
          503,
          `Could not fetch the ${from}/${to} rate right now. Please try again.`,
          { cause },
        );
      }

      const rateToken = extractRateToken(body);
      const date = /"date"\s*:\s*"([\d-]+)"/.exec(body)?.[1];
      if (!rateToken || !date) {
        throw new AppError(
          "RATE_UNAVAILABLE",
          503,
          `Unexpected response for the ${from}/${to} rate.`,
        );
      }

      const rate: ExchangeRate = { from, to, rate: rateToken, date };
      cache.set(key, { rate, expiresAt: Date.now() + ttlMs });
      return rate;
    },
  };
}

/** Rate cache on globalThis so it survives hot reloads, like the ledger. */
const globalForRates = globalThis as typeof globalThis & {
  __rateCache?: Map<string, CacheEntry>;
};

export function sharedRateCache(): Map<string, CacheEntry> {
  globalForRates.__rateCache ??= new Map();
  return globalForRates.__rateCache;
}
