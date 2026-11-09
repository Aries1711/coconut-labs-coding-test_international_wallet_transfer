import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { listTransactions } from "@/lib/service/wallet";

export async function GET(request: Request) {
  try {
    const walletId = new URL(request.url).searchParams.get("walletId") ?? undefined;
    return NextResponse.json({ transactions: listTransactions(walletId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
