import { NextResponse } from "next/server";
import { depositFunds } from "@/infrastructure/container";
import { toErrorResponse } from "@/infrastructure/http/errorResponse";
import { parseBody, singleWalletSchema } from "@/infrastructure/http/requestValidation";

export async function POST(request: Request) {
  try {
    const { walletId, amount } = await parseBody(request, singleWalletSchema);
    const transaction = await depositFunds(walletId, amount);
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
