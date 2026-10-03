import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { campaignIds } from "@/lib/server/authorization";
import {
  airwallex,
  executionOpen,
  transferEvidence,
} from "@/lib/server/airwallex";
import { body, errorResponse } from "@/lib/server/http";
export async function POST(req: NextRequest) {
  try {
    const data = await body(
      req,
      z
        .object({
          nextStatus: z.enum(["SENT", "PAID"]),
          confirmed: z.literal(true),
        })
        .strict(),
    );
    if (!executionOpen()) throw new Error("Sandbox execution window is closed");
    const client = airwallex(),
      ids = campaignIds();
    const t = (await client.transfers()).find(
      (t) => t.request_id === ids.transfer,
    );
    if (!t) throw new Error("No campaign transfer exists");
    if (t.status === data.nextStatus || t.status === "PAID")
      return NextResponse.json({
        evidence: transferEvidence(t),
        simulated: true,
      });
    await client.transition(
      t.id,
      data.nextStatus,
      data.nextStatus === "SENT" ? ids.sent : ids.paid,
    );
    const fresh = await client.request(
      `/api/v1/transfers/${encodeURIComponent(t.id)}`,
    );
    return NextResponse.json({
      evidence: transferEvidence(fresh),
      simulated: true,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
