import { NextResponse } from "next/server";
import { listWallets } from "@/infrastructure/container";
import { toErrorResponse } from "@/infrastructure/http/errorResponse";

export async function GET() {
  try {
    return NextResponse.json({ wallets: await listWallets() });
  } catch (error) {
    return toErrorResponse(error);
  }
}
