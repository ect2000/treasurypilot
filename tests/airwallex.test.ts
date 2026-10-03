import { describe, expect, it, vi } from "vitest";
import {
  AirwallexClient,
  mapBalances,
  conversionEvidence,
  transferEvidence,
  SANDBOX_BASE,
} from "../lib/server/airwallex";
describe("Airwallex REST adapters", () => {
  it("maps major-unit balances to integer minor units", () => {
    expect(
      mapBalances([
        {
          currency: "USD",
          available_amount: 12.34,
          pending_amount: 1,
          reserved_amount: 0,
          total_amount: 13.34,
        },
      ])[0],
    ).toEqual({
      currency: "USD",
      available: 1234,
      pending: 100,
      reserved: 0,
      total: 1334,
    });
    expect(() => mapBalances([{ currency: "USD" }])).toThrow();
  });
  it("coalesces concurrent logins and caches token until expiry margin", async () => {
    const mock = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("/login")
        ? Response.json({
            token: "fixture-token",
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
          })
        : Response.json([]),
    );
    const client = new AirwallexClient(
      { base: SANDBOX_BASE, clientId: "fixture", apiKey: "fixture" },
      mock as typeof fetch,
    );
    await Promise.all([
      client.balances(),
      client.balances(),
      client.balances(),
    ]);
    await client.balances();
    expect(
      mock.mock.calls.filter(([url]) => String(url).endsWith("/login")),
    ).toHaveLength(1);
  });
  it("maps only safe financial evidence fields", () => {
    expect(
      conversionEvidence({
        conversion_id: "c",
        request_id: "r",
        status: "SETTLED",
        buy_currency: "EUR",
        sell_currency: "USD",
        buy_amount: 14000,
        sell_amount: 15960,
        token: "do-not-expose",
      }),
    ).not.toHaveProperty("token");
    expect(
      transferEvidence({
        id: "t",
        status: "PROCESSING",
        transfer_currency: "EUR",
        transfer_amount: "14000.00",
        beneficiary_id: "hidden",
      }),
    ).toMatchObject({ amount: 1400000, currency: "EUR" });
  });
  it("posts one fixed major-unit Sandbox deposit with a stable unique statement reference", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const transport = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        return String(url).endsWith("/login")
          ? Response.json({
              token: "fixture",
              expires_at: new Date(Date.now() + 3600_000).toISOString(),
            })
          : Response.json(
              {
                id: "deposit-fixture",
                amount: 8000,
                currency: "EUR",
                status: "SETTLED",
                statement_ref: "TPKIT1-2026-ONE",
              },
              { status: 201 },
            );
      },
    );
    const client = new AirwallexClient(
      { base: SANDBOX_BASE, clientId: "fixture", apiKey: "fixture" },
      transport as typeof fetch,
    );
    const response = await client.simulateDeposit(
      "existing-eur-account",
      "TPKIT1-2026-ONE",
    );
    expect(response.status).toBe("SETTLED");
    const post = calls.find(({ url }) =>
      url.endsWith("/simulation/deposit/create"),
    )!;
    expect(post.url.startsWith(SANDBOX_BASE)).toBe(true);
    expect(JSON.parse(String(post.init?.body))).toMatchObject({
      amount: 8000,
      global_account_id: "existing-eur-account",
      statement_ref: "TPKIT1-2026-ONE",
      status: "SETTLED",
    });
    expect(JSON.parse(String(post.init?.body))).not.toHaveProperty(
      "request_id",
    );
  });
});
