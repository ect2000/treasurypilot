import { expect, it, vi, beforeEach, afterEach } from "vitest";
import { AirwallexClient, SANDBOX_BASE } from "../lib/server/airwallex";
const config = { base: SANDBOX_BASE, clientId: "fixture", apiKey: "fixture" };
beforeEach(() =>
  vi.stubEnv(
    "EXECUTION_ENABLED_UNTIL",
    new Date(Date.now() + 3600000).toISOString(),
  ),
);
afterEach(() => vi.unstubAllEnvs());
const login = () =>
  Response.json({
    token: "unit-session",
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
it("refuses a financial transport if authentication consumes the remaining execution window", async () => {
  const transport = vi.fn(async () => {
    vi.stubEnv(
      "EXECUTION_ENABLED_UNTIL",
      new Date(Date.now() - 1000).toISOString(),
    );
    return login();
  });
  const client = new AirwallexClient(config, transport as typeof fetch);
  await expect(
    client.transfer("fixture-beneficiary", "stable-operation-id"),
  ).rejects.toThrow(/closed before provider submission/);
  expect(transport).toHaveBeenCalledTimes(1);
});
it.each([401, 429, 500])(
  "never automatically replays a financial POST after HTTP %s",
  async (status) => {
    const transport = vi.fn(async (url: string) =>
      url.endsWith("/login")
        ? login()
        : Response.json({ code: "fixture_failure" }, { status }),
    );
    const client = new AirwallexClient(config, transport as typeof fetch);
    await expect(
      client.transfer("fixture-beneficiary", "stable-operation-id"),
    ).rejects.toThrow(`HTTP ${status}`);
    expect(
      transport.mock.calls.filter(([url]) => url.endsWith("/transfers/create")),
    ).toHaveLength(1);
  },
);
it("invalidates expired authorization, then reauthenticates only on a subsequent explicit read", async () => {
  let reads = 0;
  const transport = vi.fn(async (url: string) =>
    url.endsWith("/login")
      ? login()
      : ++reads === 1
        ? Response.json({ code: "expired" }, { status: 401 })
        : Response.json([]),
  );
  const client = new AirwallexClient(config, transport as typeof fetch);
  await expect(client.balances()).rejects.toThrow("HTTP 401");
  expect(await client.balances()).toEqual([]);
  expect(
    transport.mock.calls.filter(([url]) => url.endsWith("/login")),
  ).toHaveLength(2);
});
it("treats response loss as uncertain and never creates a fresh operation ID", async () => {
  const transport = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/login")) return login();
    expect(JSON.parse(String(init?.body)).request_id).toBe(
      "stable-operation-id",
    );
    throw new DOMException("Fixture response lost", "TimeoutError");
  });
  const client = new AirwallexClient(config, transport as typeof fetch);
  await expect(
    client.transfer("fixture-beneficiary", "stable-operation-id"),
  ).rejects.toThrow("Fixture response lost");
  expect(
    transport.mock.calls.filter(([url]) => url.endsWith("/transfers/create")),
  ).toHaveLength(1);
});
