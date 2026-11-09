import type { Currency } from "./currencies";
import { AppError } from "./errors";

export type Rate = { from: Currency; to: Currency; rate: string; date: string };

const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;
const BASE_URL = "https://api.frankfurter.dev/v2/rate";

type CacheEntry = { rate: Rate; expiresAt: number };

const globalForRates = globalThis as typeof globalThis & {
  __rateCache?: Map<string, CacheEntry>;
};

function cache(): Map<string, CacheEntry> {
  globalForRates.__rateCache ??= new Map();
  return globalForRates.__rateCache;
}

/**
 * Frankfurter returns the rate as a JSON number. We pull the raw token out of
 * the response text so the decimal string is preserved exactly and never
 * passes through a float.
 */
function extractRateToken(body: string): string | undefined {
  return /"rate"\s*:\s*(\d+(?:\.\d+)?)/.exec(body)?.[1];
}

/**
 * Mid-market rate from Frankfurter v2, cached for 60s per pair.
 * Throws RATE_UNAVAILABLE (503) on any failure -- never invents a rate.
 */
export async function getRate(from: Currency, to: Currency): Promise<Rate> {
  if (from === to) {
    return { from, to, rate: "1", date: new Date().toISOString().slice(0, 10) };
  }

  const key = `${from}:${to}`;
  const cached = cache().get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.rate;

  let body: string;
  try {
    const response = await fetch(`${BASE_URL}/${from}/${to}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

  const rate: Rate = { from, to, rate: rateToken, date };
  cache().set(key, { rate, expiresAt: Date.now() + CACHE_TTL_MS });
  return rate;
}
