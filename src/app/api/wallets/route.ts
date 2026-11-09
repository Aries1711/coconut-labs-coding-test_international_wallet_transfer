import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { listWallets } from "@/lib/service/wallet";

export async function GET() {
  try {
    return NextResponse.json({ wallets: listWallets() });
  } catch (error) {
    return toErrorResponse(error);
  }
}
