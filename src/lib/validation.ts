import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "./currencies";
import { AppError } from "./errors";

const walletId = z.string().trim().min(1, "walletId is required");
/** Amounts cross the wire as decimal strings; the server parses them. */
const amount = z.string().trim().min(1, "amount is required");

export const singleWalletSchema = z.object({ walletId, amount });

export const twoWalletSchema = z.object({
  fromWalletId: walletId,
  toWalletId: walletId,
  amount,
});

export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

/** Parses a request body, turning any zod failure into a 400 AppError. */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new AppError("VALIDATION_FAILED", 400, "Request body must be valid JSON.");
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    throw new AppError("VALIDATION_FAILED", 400, message);
  }
  return result.data;
}
