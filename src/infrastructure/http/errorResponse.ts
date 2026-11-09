import { NextResponse } from "next/server";
import { AppError, type ErrorCode } from "@/domain/errors";

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
