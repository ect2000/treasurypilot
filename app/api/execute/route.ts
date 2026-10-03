import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeApproved } from "@/lib/server/authorization";
import { body, errorResponse, getSession } from "@/lib/server/http";
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  try {
    const data = await body(
      req,
      z.object({ approval: z.string().max(18000) }).strict(),
    );
    const evidence = await executeApproved(
      data.approval,
      getSession(req).version,
    );
    return NextResponse.json(
      { evidence, source: "AIRWALLEX_REST_SANDBOX" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
