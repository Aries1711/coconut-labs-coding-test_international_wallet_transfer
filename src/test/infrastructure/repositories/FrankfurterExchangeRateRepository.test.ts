import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExchangeRateRepository } from "@/domain/repositories/ExchangeRateRepository";
import { createFrankfurterExchangeRateRepository } from "@/infrastructure/repositories/FrankfurterExchangeRateRepository";

// Each test gets its own cache, so caching behaviour is asserted directly
// rather than worked around by picking unused currency pairs.
let rates: ExchangeRateRepository;
beforeEach(() => {
  rates = createFrankfurterExchangeRateRepository({ cache: new Map() });
});

function okResponse(body: string) {
  return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getRate", () => {
  it("returns 1 for the same currency on both sides without calling fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("fetch should not be called for a same-currency pair");
      }),
    );

    const rate = await rates.getRate("USD", "USD");
    expect(rate.rate).toBe("1");
  });

  it("preserves the rate as the exact decimal string Frankfurter sent, not a parsed float", async () => {
    // 0.1 + 0.2 territory: this value is not exactly representable as a float,
    // so a correct implementation must never round-trip it through `Number`.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        okResponse('{"date":"2026-11-09","base":"USD","quote":"EUR","rate":0.893150000001}'),
      ),
    );

    const rate = await rates.getRate("USD", "EUR");
    expect(rate.rate).toBe("0.893150000001");
    expect(rate.date).toBe("2026-11-09");
  });

  it("serves the second lookup for a pair from cache without a second fetch", async () => {
    const fetchMock = vi.fn(async () =>
      okResponse('{"date":"2026-11-09","base":"USD","quote":"GBP","rate":0.77}'),
    );
    vi.stubGlobal("fetch", fetchMock);

    await rates.getRate("USD", "GBP");
    await rates.getRate("USD", "GBP");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws RATE_UNAVAILABLE (503) when the request fails, inventing no rate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(rates.getRate("USD", "SGD")).rejects.toMatchObject({
      code: "RATE_UNAVAILABLE",
      status: 503,
    });
  });

  it("throws RATE_UNAVAILABLE when the upstream responds with a non-2xx status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    await expect(rates.getRate("USD", "AUD")).rejects.toMatchObject({
      code: "RATE_UNAVAILABLE",
      status: 503,
    });
  });

  it("throws RATE_UNAVAILABLE on a 2xx response with an unexpected body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse('{"surprise":true}')));

    await expect(rates.getRate("USD", "IDR")).rejects.toMatchObject({
      code: "RATE_UNAVAILABLE",
      status: 503,
    });
  });
});
