import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { checkOrigin } from "../lib/server/http";
describe("same-origin handling behind Next.js normalization", () => {
  it("accepts the actual incoming host even if the internal URL is localhost", () => {
    const req = new NextRequest("http://localhost:3000/api/proposal", {
      headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
    });
    expect(() => checkOrigin(req)).not.toThrow();
  });
  it("rejects other origins and cross-site fetches", () => {
    const cases: Record<string, string>[] = [
      {
        host: "treasurypilot.vercel.app",
        origin: "https://evil.example",
        "x-forwarded-proto": "https",
      },
      {
        host: "treasurypilot.vercel.app",
        origin: "https://treasurypilot.vercel.app",
        "sec-fetch-site": "cross-site",
        "x-forwarded-proto": "https",
      },
    ];
    for (const headers of cases)
      expect(() =>
        checkOrigin(
          new NextRequest("https://treasurypilot.vercel.app/api/execute", {
            headers,
          }),
        ),
      ).toThrow();
  });
});
