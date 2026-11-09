import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { getWallet } from "@/lib/service/wallet";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ wallet: getWallet(id) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
