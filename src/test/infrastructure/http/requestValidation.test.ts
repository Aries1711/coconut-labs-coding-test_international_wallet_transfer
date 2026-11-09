import { describe, expect, it } from "vitest";
import { AppError } from "@/domain/errors";
import { currencySchema, parseBody, singleWalletSchema, twoWalletSchema } from "@/infrastructure/http/requestValidation";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("parseBody", () => {
  it("returns the parsed, typed body on a valid request", async () => {
    const result = await parseBody(
      jsonRequest({ walletId: "usd-main", amount: "10.00" }),
      singleWalletSchema,
    );
    expect(result).toEqual({ walletId: "usd-main", amount: "10.00" });
  });

  it("rejects a body that is not valid JSON", async () => {
    await expect(
      parseBody(jsonRequest("{not json"), singleWalletSchema),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "VALIDATION_FAILED", status: 400 }) as unknown as Error,
    );
  });

  it("rejects a body missing a required field, naming it in the message", async () => {
    try {
      await parseBody(jsonRequest({ walletId: "usd-main" }), singleWalletSchema);
      expect.unreachable("parseBody should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("VALIDATION_FAILED");
      expect((error as AppError).message).toMatch(/amount/);
    }
  });

  it("rejects an empty string for a required field", async () => {
    await expect(
      parseBody(jsonRequest({ walletId: "", amount: "10.00" }), singleWalletSchema),
    ).rejects.toThrowError(AppError);
  });

  it("validates the two-wallet shape used by transfers and conversions", async () => {
    const result = await parseBody(
      jsonRequest({ fromWalletId: "usd-main", toWalletId: "eur-main", amount: "5.00" }),
      twoWalletSchema,
    );
    expect(result).toEqual({
      fromWalletId: "usd-main",
      toWalletId: "eur-main",
      amount: "5.00",
    });
  });
});

describe("currencySchema", () => {
  it("accepts every supported currency code", () => {
    for (const code of ["USD", "EUR", "GBP", "JPY", "SGD", "AUD", "IDR"]) {
      expect(currencySchema.safeParse(code).success).toBe(true);
    }
  });

  it("rejects an unsupported or malformed code", () => {
    for (const bad of ["XXX", "usd", "", null, 123]) {
      expect(currencySchema.safeParse(bad).success).toBe(false);
    }
  });
});
