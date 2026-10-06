import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { seal, unseal } from "@/lib/server/authorization";
import { body, errorResponse } from "@/lib/server/http";
import {
  getWorld,
  governorView,
  GovernorCommand,
  runTool,
} from "@/lib/server/governor";
import { StateConflict } from "@/lib/server/governor-store";
export const maxDuration = 60;
function identity(req: NextRequest) {
  const cookie = req.cookies.get("tp_governor")?.value;
  return cookie ? unseal<{ id: string }>(cookie).id : randomUUID();
}
function response(data: unknown, id: string) {
  const res = NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
  res.cookies.set("tp_governor", seal({ id }, 7 * 86400_000), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 86400,
  });
  return res;
}
export async function GET(req: NextRequest) {
  try {
    const id = identity(req);
    return response(governorView(await getWorld(id)), id);
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    const command = await body(req, GovernorCommand);
    const id = identity(req);
    return response(governorView(await runTool(id, command)), id);
  } catch (error) {
    if (error instanceof StateConflict)
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    return errorResponse(error);
  }
}
