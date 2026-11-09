import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { convert } from "@/lib/service/wallet";
import { parseBody, twoWalletSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { fromWalletId, toWalletId, amount } = await parseBody(request, twoWalletSchema);
    const transaction = await convert(fromWalletId, toWalletId, amount);
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
