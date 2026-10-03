import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/server/airwallex";
import { errorResponse } from "@/lib/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await readSnapshot(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
