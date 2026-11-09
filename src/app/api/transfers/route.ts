import { NextResponse } from "next/server";
import { transferFunds } from "@/infrastructure/container";
import { toErrorResponse } from "@/infrastructure/http/errorResponse";
import { parseBody, twoWalletSchema } from "@/infrastructure/http/requestValidation";

export async function POST(request: Request) {
  try {
    const { fromWalletId, toWalletId, amount } = await parseBody(request, twoWalletSchema);
    return NextResponse.json(
      { transaction: transferFunds(fromWalletId, toWalletId, amount) },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
