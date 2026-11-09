import { NextResponse } from "next/server";
import { getTransaction } from "@/infrastructure/container";
import { toErrorResponse } from "@/infrastructure/http/errorResponse";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ transaction: getTransaction(id) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
