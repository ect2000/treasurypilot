import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json(
    {
      commit: process.env.TREASURY_BUILD_SHA ?? "LOCAL_UNSET",
      financialEnvironment: "AIRWALLEX_SANDBOX_ONLY",
      schema: 2,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
