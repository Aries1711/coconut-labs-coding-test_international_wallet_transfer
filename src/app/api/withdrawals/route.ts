import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { withdraw } from "@/lib/service/wallet";
import { parseBody, singleWalletSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { walletId, amount } = await parseBody(request, singleWalletSchema);
    return NextResponse.json({ transaction: withdraw(walletId, amount) }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
