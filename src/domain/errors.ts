export type ErrorCode =
  | "VALIDATION_FAILED"
  | "INVALID_AMOUNT"
  | "TOO_MANY_DECIMALS"
  | "AMOUNT_TOO_LARGE"
  | "WALLET_NOT_FOUND"
  | "TRANSACTION_NOT_FOUND"
  | "SAME_WALLET"
  | "CURRENCY_MISMATCH"
  | "CURRENCY_MATCH_FOR_CONVERSION"
  | "INSUFFICIENT_FUNDS"
  | "ROUNDS_TO_ZERO"
  | "UNSUPPORTED_CURRENCY"
  | "RATE_UNAVAILABLE"
  | "INTERNAL_ERROR";

/**
 * A rule violation expressed in domain terms. It carries the HTTP status the
 * API should use, but knows nothing about HTTP itself -- turning one into a
 * response is the infrastructure layer's job (infrastructure/http).
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AppError";
  }
}
