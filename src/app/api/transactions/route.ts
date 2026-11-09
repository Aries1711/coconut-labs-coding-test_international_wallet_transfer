import { NextResponse } from "next/server";
import { listTransactions } from "@/infrastructure/container";
import { toErrorResponse } from "@/infrastructure/http/errorResponse";

export async function GET(request: Request) {
  try {
    const walletId = new URL(request.url).searchParams.get("walletId") ?? undefined;
    return NextResponse.json({ transactions: await listTransactions(walletId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
