import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { transfer } from "@/lib/service/wallet";
import { parseBody, twoWalletSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { fromWalletId, toWalletId, amount } = await parseBody(request, twoWalletSchema);
    return NextResponse.json(
      { transaction: transfer(fromWalletId, toWalletId, amount) },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
