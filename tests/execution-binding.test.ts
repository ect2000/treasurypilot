import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  prepareProposal,
  approveProposal,
  executeApproved,
  campaignIds,
} from "../lib/server/authorization";
import { initialForecast } from "../lib/treasury";
import { verifiedSnapshot } from "./fixtures/governor";
import { claimOperation } from "../lib/server/governor-store";
const fixture = vi.hoisted(() => ({
  client: {} as Record<string, ReturnType<typeof vi.fn>>,
  claimed: false,
  open: true,
}));
vi.mock("../lib/server/demo-limits", async (original) => ({
  ...(await original<typeof import("../lib/server/demo-limits")>()),
  admitDemoWork: vi.fn(async () => {}),
}));
vi.mock("../lib/server/airwallex", async (original) => ({
  ...(await original<typeof import("../lib/server/airwallex")>()),
  airwallex: () => fixture.client,
  executionOpen: () => fixture.open,
}));
vi.mock("../lib/server/governor-store", () => ({
  claimOperation: vi.fn(async () => {
    if (fixture.claimed) throw new Error("Operation already claimed");
    fixture.claimed = true;
  }),
}));
const rawQuote = () => ({
  quote_id: "fixture-quote",
  buy_amount: 14000,
  sell_amount: 15971.87,
  buy_currency: "EUR",
  sell_currency: "USD",
  client_rate: "0.876",
  valid_to_at: new Date(Date.now() + 240000).toISOString(),
});
const beneficiary = () => ({
  id: "private-fixture-beneficiary",
  beneficiary: {
    bank_details: { account_currency: "EUR", bank_country_code: "DE" },
  },
  transfer_methods: ["LOCAL"],
});
beforeEach(() => {
  vi.stubEnv(
    "AUTHORIZATION_SECRET",
    "fixture-sealing-secret-with-more-than-32-characters",
  );
  vi.stubEnv("AIRWALLEX_BASE_URL", "https://api.sandbox.airwallex.com");
  fixture.claimed = false;
  fixture.open = true;
  vi.mocked(claimOperation)
    .mockReset()
    .mockImplementation(async () => {
      if (fixture.claimed) throw new Error("Operation already claimed");
      fixture.claimed = true;
    });
  const quote = rawQuote();
  fixture.client = {
    balances: vi.fn(async () => verifiedSnapshot().balances),
    beneficiaries: vi.fn(async () => [beneficiary()]),
    conversions: vi.fn(async () => []),
    transfers: vi.fn(async () => []),
    quote: vi.fn(async () => quote),
    retrieveQuote: vi.fn(async () => quote),
    convert: vi.fn(async () => ({
      kind: "FX_CONVERSION",
      id: "fixture-result",
      requestId: campaignIds().conversion,
    })),
    transfer: vi.fn(),
    validateTransfer: vi.fn(),
  };
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function approved() {
  const proposal = await prepareProposal(
    "CONVERT",
    initialForecast,
    "plan-1:context-1",
  );
  return {
    proposal,
    token: approveProposal(
      proposal.token,
      proposal.fingerprint,
      true,
      "plan-1:context-1",
    ),
  };
}
it("allows only one submission across simultaneous clicks, then retains the claim after lost response and retry", async () => {
  const { token } = await approved();
  fixture.client.convert.mockRejectedValue(new Error("Response lost"));
  const results = await Promise.allSettled([
    executeApproved(token, "plan-1:context-1"),
    executeApproved(token, "plan-1:context-1"),
  ]);
  expect(results.every((result) => result.status === "rejected")).toBe(true);
  await expect(executeApproved(token, "plan-1:context-1")).rejects.toThrow(
    /already claimed/,
  );
  expect(fixture.client.convert).toHaveBeenCalledTimes(1);
  expect(fixture.client.convert.mock.calls[0][1]).toBe(
    campaignIds().conversion,
  );
});
it("rejects changed plan, wallet, beneficiary, quote amount and quote expiry before submission", async () => {
  const { token } = await approved();
  await expect(executeApproved(token, "plan-2:context-2")).rejects.toThrow(
    /State changed/,
  );
  const balances = verifiedSnapshot().balances;
  balances[0].available++;
  fixture.client.balances.mockResolvedValueOnce(balances);
  await expect(executeApproved(token, "plan-1:context-1")).rejects.toThrow(
    /Financial state changed/,
  );
  fixture.client.beneficiaries.mockResolvedValueOnce([
    { ...beneficiary(), id: "changed-private-fixture" },
  ]);
  await expect(executeApproved(token, "plan-1:context-1")).rejects.toThrow(
    /Financial state changed/,
  );
  fixture.client.retrieveQuote.mockResolvedValueOnce({
    ...rawQuote(),
    sell_amount: 15971.88,
  });
  await expect(executeApproved(token, "plan-1:context-1")).rejects.toThrow(
    /Quote changed/,
  );
  fixture.client.retrieveQuote.mockResolvedValueOnce({
    ...rawQuote(),
    valid_to_at: new Date(Date.now() - 1000).toISOString(),
  });
  await expect(executeApproved(token, "plan-1:context-1")).rejects.toThrow(
    /Quote changed/,
  );
  expect(fixture.claimed).toBe(false);
  expect(fixture.client.convert).not.toHaveBeenCalled();
});
it("invalidates an exact approval after its quote expires, including after asynchronous provider readback", async () => {
  vi.useFakeTimers();
  try {
    const { token } = await approved();
    vi.advanceTimersByTime(241000);
    await expect(executeApproved(token, "plan-1:context-1")).rejects.toThrow(
      /expired/,
    );
    expect(fixture.client.convert).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
it("checks the execution window again after the permanent claim and before the financial POST", async () => {
  const { token } = await approved();
  vi.mocked(claimOperation).mockImplementationOnce(async () => {
    fixture.claimed = true;
    fixture.open = false;
  });
  await expect(executeApproved(token, "plan-1:context-1")).rejects.toThrow(
    /closed before submission/,
  );
  expect(fixture.claimed).toBe(true);
  expect(fixture.client.convert).not.toHaveBeenCalled();
});
it("binds the supplier transfer to its settled FX and one permanent transfer identity", async () => {
  fixture.client.conversions.mockResolvedValue([
    {
      id: "fixture-settled-fx",
      request_id: campaignIds().conversion,
      status: "SETTLED",
      buy_amount: 14000,
      sell_amount: 15971.87,
    },
  ]);
  const proposal = await prepareProposal(
    "TRANSFER",
    initialForecast,
    "plan-1:context-1",
  );
  const token = approveProposal(
    proposal.token,
    proposal.fingerprint,
    true,
    "plan-1:context-1",
  );
  fixture.client.transfer.mockRejectedValue(new Error("Response lost"));
  await Promise.allSettled([
    executeApproved(token, "plan-1:context-1"),
    executeApproved(token, "plan-1:context-1"),
  ]);
  expect(fixture.client.transfer).toHaveBeenCalledTimes(1);
  expect(fixture.client.transfer.mock.calls[0][1]).toBe(campaignIds().transfer);
  expect(fixture.client.convert).not.toHaveBeenCalled();
});
