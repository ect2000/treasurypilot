import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { body, errorResponse, getSession } from "@/lib/server/http";
import {
  depositOperatorAvailable,
  simulateDepositOnce,
} from "@/lib/server/deposit";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    // No public deployment can execute this mutation. Local browser action only.
    if (
      !depositOperatorAvailable() ||
      req.headers.get("host") !== "127.0.0.1:3000" ||
      req.headers.get("origin") !== "http://127.0.0.1:3000"
    )
      throw new Error("Local Sandbox operator action only");
    await body(
      req,
      z.object({ confirm: z.literal("SIMULATE CUSTOMER DEPOSIT") }).strict(),
    );
    const proof = await simulateDepositOnce(getSession(req).forecast);
    return NextResponse.json(
      {
        deposit: {
          id: proof.id,
          status: proof.status,
          amount: proof.amountMinor,
          currency: proof.currency,
          before: proof.beforeAvailable,
          after: proof.afterAvailable,
          delta: proof.delta,
          credit: proof.credit,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
