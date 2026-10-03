import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { initialForecast } from "../treasury";
import type { Forecast } from "../types";
import { seal, unseal } from "./authorization";
export type Session = { forecast: Forecast; version: string };
export function getSession(req: NextRequest): Session {
  const cookie = req.cookies.get("tp_state")?.value;
  if (!cookie) return { forecast: initialForecast, version: "initial" };
  return unseal<Session>(cookie);
}
export function withSession(data: unknown, session: Session) {
  const response = NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
  response.cookies.set("tp_state", seal(session, 86400_000), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 86400,
  });
  return response;
}
export function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  // Next.js may normalize the internal request URL to localhost behind a proxy.
  // Compare the browser origin with the actual incoming Host header instead.
  const host = req.headers.get("host");
  const protocol =
    req.headers.get("x-forwarded-proto") ??
    new URL(req.url).protocol.replace(":", "");
  if (
    origin &&
    (!host ||
      new URL(origin).host !== host ||
      new URL(origin).protocol !== `${protocol}:`)
  )
    throw new Error("Cross-origin financial requests are refused");
  if (req.headers.get("sec-fetch-site") === "cross-site")
    throw new Error("Cross-site requests are refused");
}
export async function body<T extends z.ZodType>(
  req: NextRequest,
  schema: T,
): Promise<z.infer<T>> {
  checkOrigin(req);
  const text = await req.text();
  if (text.length > 16000) throw new Error("Request too large");
  return schema.parse(JSON.parse(text));
}
export function errorResponse(error: unknown) {
  const message =
    error instanceof z.ZodError
      ? "Invalid request fields"
      : error instanceof Error
        ? error.message
        : "Request failed";
  const safe =
    /token|client.id|api.key|secret|credential/i.test(message) &&
    !/not configured/i.test(message)
      ? "Server request failed. Sensitive diagnostic details are suppressed."
      : message;
  return NextResponse.json(
    { error: safe },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}
