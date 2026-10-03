import { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  body,
  errorResponse,
  getSession,
  withSession,
} from "@/lib/server/http";
import { updateForecast } from "@/lib/treasury";
export async function POST(req: NextRequest) {
  try {
    const data = await body(
      req,
      z.object({ delayDays: z.number().int().min(0).max(30) }).strict(),
    );
    const session = getSession(req);
    const next = {
      forecast: updateForecast(session.forecast, data.delayDays),
      version: randomUUID(),
    };
    return withSession(next, next);
  } catch (error) {
    return errorResponse(error);
  }
}
