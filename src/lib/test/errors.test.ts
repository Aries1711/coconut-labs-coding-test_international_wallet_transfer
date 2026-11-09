import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, toErrorResponse } from "../errors";

// toErrorResponse logs unhandled errors via console.error by design; silence
// that expected noise here rather than letting it clutter test output.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("toErrorResponse", () => {
  it("maps an AppError to its own status and {error:{code,message}} shape", async () => {
    const error = new AppError("INSUFFICIENT_FUNDS", 422, "Not enough funds.");

    const response = toErrorResponse(error);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INSUFFICIENT_FUNDS", message: "Not enough funds." },
    });
  });

  it("maps any other thrown value to a generic 500, never leaking its message", async () => {
    const response = toErrorResponse(new Error("database password is hunter2"));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).not.toMatch(/hunter2/);
  });

  it("handles a non-Error throw (e.g. a rejected promise with a string)", async () => {
    const response = toErrorResponse("just a string");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
    });
  });
});
