import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { body, errorResponse } from "@/lib/server/http";
import { interpretEvidence } from "@/lib/server/ai";
export const maxDuration = 120;
export async function POST(req: NextRequest) {
  try {
    const data = await body(
      req,
      z.object({ text: z.string().min(10).max(6000) }).strict(),
    );
    return NextResponse.json(await interpretEvidence(data.text), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
