import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { approveProposal } from "@/lib/server/authorization";
import { body, errorResponse, getSession } from "@/lib/server/http";
export async function POST(req: NextRequest) {
  try {
    const data = await body(
      req,
      z
        .object({
          token: z.string().max(18000),
          fingerprint: z.string().length(64),
          confirmed: z.literal(true),
        })
        .strict(),
    );
    return NextResponse.json(
      {
        approval: approveProposal(
          data.token,
          data.fingerprint,
          data.confirmed,
          getSession(req).version,
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
