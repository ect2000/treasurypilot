import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { campaignIds, fingerprint } from "@/lib/server/authorization";
import { claimOperation } from "@/lib/server/governor-store";
import {
  airwallex,
  executionOpen,
  transferEvidence,
} from "@/lib/server/airwallex";
import { body, errorResponse } from "@/lib/server/http";
import { admitDemoWork } from "@/lib/server/demo-limits";
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
    await admitDemoWork("transition");
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
    const requestId = data.nextStatus === "SENT" ? ids.sent : ids.paid;
    await claimOperation(
      requestId,
      fingerprint({ transferId: t.id, nextStatus: data.nextStatus }),
    );
    await client.transition(t.id, data.nextStatus);
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
