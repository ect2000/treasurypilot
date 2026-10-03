import { NextRequest, NextResponse } from "next/server";
import { errorResponse, getSession } from "@/lib/server/http";
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(getSession(req), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
