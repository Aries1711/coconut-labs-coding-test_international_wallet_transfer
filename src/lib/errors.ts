import { NextResponse } from "next/server";

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

/** Domain error carrying the HTTP status and stable code the API exposes. */
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

export type ApiErrorBody = { error: { code: ErrorCode; message: string } };

/** Single place every route turns a thrown error into the API error shape. */
export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error("Unhandled error in route handler:", error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR" as const,
        message: "Something went wrong.",
      },
    },
    { status: 500 },
  );
}
