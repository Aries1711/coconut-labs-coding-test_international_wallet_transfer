import { NextResponse } from "next/server";
import { AppError } from "@/domain/errors";
import { getExchangeRate } from "@/infrastructure/container";
import { toErrorResponse } from "@/infrastructure/http/errorResponse";
import { currencySchema } from "@/infrastructure/http/requestValidation";

/** Rate preview for the convert form. Does not touch the ledger. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const from = currencySchema.safeParse(url.searchParams.get("from"));
    const to = currencySchema.safeParse(url.searchParams.get("to"));
    if (!from.success || !to.success) {
      throw new AppError(
        "VALIDATION_FAILED",
        400,
        "`from` and `to` must both be supported currency codes.",
      );
    }
    return NextResponse.json(await getExchangeRate(from.data, to.data));
  } catch (error) {
    return toErrorResponse(error);
  }
}
