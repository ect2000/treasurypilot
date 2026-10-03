import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prepareProposal } from "@/lib/server/authorization";
import { body, errorResponse, getSession } from "@/lib/server/http";
export async function POST(req: NextRequest) {
  try {
    const data = await body(
      req,
      z.object({ operation: z.enum(["CONVERT", "TRANSFER"]) }).strict(),
    );
    const s = getSession(req);
    return NextResponse.json(
      await prepareProposal(data.operation, s.forecast, s.version),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
