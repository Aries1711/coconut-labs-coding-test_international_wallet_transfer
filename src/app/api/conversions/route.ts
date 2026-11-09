import { NextResponse } from "next/server";
import { convertCurrency } from "@/infrastructure/container";
import { toErrorResponse } from "@/infrastructure/http/errorResponse";
import { parseBody, twoWalletSchema } from "@/infrastructure/http/requestValidation";

export async function POST(request: Request) {
  try {
    const { fromWalletId, toWalletId, amount } = await parseBody(request, twoWalletSchema);
    const transaction = await convertCurrency(fromWalletId, toWalletId, amount);
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
