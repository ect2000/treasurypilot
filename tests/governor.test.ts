import { describe, it, expect, vi, afterEach } from "vitest";
import {
  authority,
  cashPlacement,
  calculatePlan,
  contextFingerprint,
  defaultPolicy,
  incidentDecision,
  reconcile,
} from "../lib/governor/engine";
import { initializeWorld } from "../lib/server/governor";
import { GovernorCommand } from "../lib/server/governor";
import { initialForecast, updateForecast, POLICY } from "../lib/treasury";
import type { Snapshot } from "../lib/types";
import proof from "../docs/evidence/financial-actions.json";
export function verifiedSnapshot(): Snapshot {
  return {
    ...structuredClone(proof.verifiedSnapshot),
    balances: structuredClone(proof.deposit.balancesAfter),
    source: "AIRWALLEX_REST_SANDBOX",
    rates: proof.verifiedSnapshot.rates,
    deposit: {
      state: "RECEIVED",
      operatorAvailable: false,
      currency: "EUR",
      amount: 800000,
      status: "SETTLED",
      id: proof.deposit.proof.id,
      delta: 800000,
      credit: 800000,
    },
  } as Snapshot;
}
afterEach(() => vi.restoreAllMocks());
describe("Autonomous cash governor invariants", () => {
  it("uses configurable authority and rejects nonfinite confidence", () => {
    expect(authority(defaultPolicy, 0.92).fx).toBe(1000000);
    expect(authority(defaultPolicy, 0.31).fx).toBe(250000);
    expect(
      authority(
        { ...defaultPolicy, tiers: [{ confidence: 0, fx: 123, transfer: 45 }] },
        0.92,
      ).fx,
    ).toBe(123);
    expect(() => authority(defaultPolicy, NaN)).toThrow();
  });
  it("changes exactly the confidence dependent decisions and preserves evaluation identity", () => {
    const snapshot = verifiedSnapshot();
    const initial = calculatePlan(
      snapshot,
      initialForecast,
      undefined,
      "2026-10-06T00:00:00Z",
    );
    const delayed = calculatePlan(
      snapshot,
      updateForecast(initialForecast, 5),
      initial,
      "2026-10-06T00:01:00Z",
    );
    expect(delayed.reopened).toEqual(["cloud", "contractor", "insurance"]);
    expect(delayed.unchanged).toEqual(["logistics", "marketing"]);
    expect(delayed.decisions[0]).toBe(initial.decisions[0]);
    expect(delayed.autonomy).toBe(250000);
    expect(delayed.remaining).toBeGreaterThanOrEqual(POLICY.reserve);
  });
  it("applies the verified receipt once and preserves four prior decisions", () => {
    const snapshot = verifiedSnapshot(),
      forecast = updateForecast(initialForecast, 5);
    const before = calculatePlan(snapshot, forecast);
    const after = calculatePlan(
      snapshot,
      forecast,
      before,
      "2026-10-06T00:02:00Z",
      true,
    );
    expect(after.reopened).toEqual(["contractor"]);
    expect(after.unchanged).toHaveLength(4);
    expect(after.decisions.find((d) => d.id === "contractor")!.action).toBe(
      "CONVERT_AND_PAY",
    );
    expect(after.allocation - before.allocation).toBe(800000);
    const again = calculatePlan(
      snapshot,
      forecast,
      after,
      "2026-10-06T00:03:00Z",
      true,
    );
    expect(again.allocation).toBe(after.allocation);
    expect(after.remaining).toBeGreaterThanOrEqual(POLICY.reserve);
  });
  it("does not credit an unverified or unapplied receipt or forecast", () => {
    const snapshot = verifiedSnapshot();
    expect(calculatePlan(snapshot, initialForecast).allocation).toBe(
      POLICY.allocation,
    );
    snapshot.deposit.state = "READY";
    expect(
      calculatePlan(snapshot, initialForecast, undefined, undefined, true)
        .allocation,
    ).toBe(POLICY.allocation);
  });
  it("matches real-recorded resources and wallets then detects amount, corridor, balance and status divergence", () => {
    const snapshot = verifiedSnapshot();
    expect(reconcile(snapshot).every((r) => r.status === "MATCHED")).toBe(true);
    snapshot.evidence[0].sellAmount!++;
    expect(reconcile(snapshot)[0].status).toBe("MISMATCH");
    snapshot.evidence[0].sellAmount!--;
    snapshot.evidence[0].buyCurrency = "GBP";
    expect(reconcile(snapshot)[0].status).toBe("MISMATCH");
    snapshot.balances[0].available++;
    expect(reconcile(snapshot).at(-1)!.status).toBe("MISMATCH");
    snapshot.evidence[1].status = "SENT";
    expect(reconcile(snapshot)[1].status).toBe("PENDING");
    snapshot.evidence[1].status = "FAILED";
    expect(reconcile(snapshot)[1].status).toBe("MISMATCH");
  });
  it("cash placement conserves value and reserves with receipt and without", () => {
    for (const applied of [false, true]) {
      const snapshot = verifiedSnapshot(),
        plan = calculatePlan(
          snapshot,
          updateForecast(initialForecast, 5),
          undefined,
          undefined,
          applied,
        );
      const placement = cashPlacement(snapshot, plan);
      expect(placement.conserved).toBe(true);
      expect(placement.reserveAfter).toBeGreaterThanOrEqual(POLICY.reserve);
      expect(
        placement.positions.find((p) => p.currency === "USD")!.target,
      ).toBeGreaterThanOrEqual(POLICY.reserve);
      expect(
        placement.proposals.every(
          (p) =>
            Number.isSafeInteger(p.sellAmount) &&
            Number.isSafeInteger(p.buyAmount),
        ),
      ).toBe(true);
    }
  });
  it("never replaces nonterminal, ambiguous or paid transfers; terminal requires verified returned funding", () => {
    for (const status of [
      "UNKNOWN",
      "NEW",
      "PROCESSING",
      "SENT",
      "PAID",
      "FAILED",
      "CANCELLED",
    ])
      expect(incidentDecision(status).replacementAllowed).toBe(false);
    expect(incidentDecision("SENT", true).decision).toBe("ESCALATE");
    expect(incidentDecision("FAILED", false, true).replacementAllowed).toBe(
      true,
    );
  });
  it("context fingerprints ignore observation time but bind financial changes", () => {
    const snapshot = verifiedSnapshot(),
      a = contextFingerprint(snapshot, initialForecast, defaultPolicy);
    snapshot.fetchedAt = "2026-10-06T12:00:00Z";
    expect(contextFingerprint(snapshot, initialForecast, defaultPolicy)).toBe(
      a,
    );
    snapshot.balances[0].available++;
    expect(
      contextFingerprint(snapshot, initialForecast, defaultPolicy),
    ).not.toBe(a);
  });
  it("imports prior actions truthfully without emitting new execution or invented approval", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const s = initializeWorld("test-workspace", verifiedSnapshot());
    expect(s.operations).toHaveLength(3);
    expect(s.operations.every((o) => o.provenance === "PRE_EXISTING_V1")).toBe(
      true,
    );
    expect(s.approvals).toHaveLength(0);
    expect(s.plans[0].plan.receiptCredit).toBe(0);
    expect(s.nextStep).toBe("MONITOR");
    expect(s.plans[0].plan.timeline[0].cash).toBe(32028.13);
    expect(s.plans[0].plan.timeline.some((point) => point.hour === 13)).toBe(
      false,
    );
  });
  it("typed tools reject model-specified amounts, URLs, beneficiaries and authority", () => {
    expect(
      GovernorCommand.safeParse({
        tool: "run_cycle",
        revision: 1,
        url: "https://api.airwallex.com",
      }).success,
    ).toBe(false);
    expect(
      GovernorCommand.safeParse({
        tool: "execute_action",
        revision: 1,
        approvalId: "9ad1dd38-ae3b-49bd-961b-ed0adfda7049",
        amount: 999,
      }).success,
    ).toBe(false);
    expect(
      GovernorCommand.safeParse({ tool: "set_policy", revision: 1, reserve: 0 })
        .success,
    ).toBe(false);
  });
});
