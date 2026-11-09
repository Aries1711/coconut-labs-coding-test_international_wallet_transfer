import { NextResponse } from "next/server";
import { getWallet } from "@/infrastructure/container";
import { toErrorResponse } from "@/infrastructure/http/errorResponse";

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
