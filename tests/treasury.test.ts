import { describe, it, expect } from "vitest";
import { major, minor, usdCost } from "../lib/money";
import {
  autonomyLimit,
  buildPlan,
  initialForecast,
  POLICY,
  obligations,
  reserveCheck,
  replanAfterDeposit,
  updateForecast,
} from "../lib/treasury";
const rates = { USD: "1", EUR: "1.14", GBP: "1.32", CNY: "0.14" };
describe("money and treasury policy", () => {
  it("rounds decimals at currency precision without binary float arithmetic", () => {
    expect(minor("1.005")).toBe(101);
    expect(minor("100.4", "JPY")).toBe(100);
    expect(minor("1.2345", "BHD")).toBe(1235);
    expect(major(1400000, "EUR")).toBe("14000.00");
    expect(usdCost(1400000, "1.139948")).toBe(1595928);
  });
  it("blocks the 13,800 reserve example and never trusts a larger wallet as authority", () => {
    expect(reserveCheck(POLICY.allocation, minor("34200"))).toEqual({
      pass: false,
      after: minor("13800"),
    });
    expect(reserveCheck(minor("10000000"), minor("1")).pass).toBe(false);
    expect(reserveCheck(POLICY.allocation, -1).pass).toBe(false);
  });
  it("prioritizes logistics, pays funded contracts and defers discretionary spending", () => {
    const p = buildPlan(rates);
    expect(p.decisions[0].id).toBe("logistics");
    expect(p.decisions[0].action).toBe("CONVERT_AND_PAY");
    expect(p.decisions.find((d) => d.id === "contractor")?.action).toBe(
      "DEFER",
    );
    expect(p.decisions.find((d) => d.id === "marketing")?.action).toBe("DEFER");
    expect(p.remaining).toBeGreaterThanOrEqual(POLICY.reserve);
  });
  it("uses deterministic confidence tiers", () => {
    expect(autonomyLimit(0.92)).toBe(minor("10000"));
    expect(autonomyLimit(0.6)).toBe(minor("5000"));
    expect(autonomyLimit(0.31)).toBe(minor("2500"));
    expect(() => autonomyLimit(NaN)).toThrow();
    expect(autonomyLimit(0.849999)).toBe(minor("5000"));
    expect(autonomyLimit(0.85)).toBe(minor("10000"));
    expect(autonomyLimit(0.599999)).toBe(minor("2500"));
    for (const invalid of [-0.1, 1.01, Infinity])
      expect(() => autonomyLimit(invalid)).toThrow();
  });
  it("does not double count a received receipt or include out-of-horizon cash in the trajectory", () => {
    for (const forecast of [
      { ...initialForecast, received: true },
      { ...initialForecast, dueHours: 73 },
    ]) {
      const plan = buildPlan(rates, forecast);
      expect(
        plan.timeline.every((point) => point.cash === point.expected),
      ).toBe(true);
      expect(plan.timeline.at(-1)!.cash).toBe(plan.remaining / 100);
      expect(plan.timeline.every((point) => point.hour <= 72)).toBe(true);
    }
    const plan = buildPlan(rates, initialForecast, undefined, [
      {
        ...obligations[0],
        id: "next-week",
        dueHours: 168,
        amount: minor("100"),
      },
    ]);
    expect(plan.decisions.find((d) => d.id === "next-week")!.action).toBe(
      "DEFER",
    );
    expect(plan.timeline.at(-1)!.cash).toBe(plan.remaining / 100);
  });
  it("reconciles the settled supplier cost and includes the forecast at its actual horizon", () => {
    const p = buildPlan(
      rates,
      initialForecast,
      undefined,
      [],
      "2026-10-03T10:00:00Z",
      minor("15971.87"),
    );
    expect(p.decisions[0].cost).toBe(minor("15971.87"));
    expect(p.remaining).toBe(minor("18828.13"));
    const receipt = p.timeline.find((point) => point.hour === 24)!;
    expect(minor(String(receipt.expected)) - minor(String(receipt.cash))).toBe(
      minor("20000"),
    );
  });
  it("incrementally reopens affected decisions and preserves unrelated identity and timestamps", () => {
    const first = buildPlan(
      rates,
      initialForecast,
      undefined,
      [],
      "2026-10-03T10:00:00Z",
    );
    const next = buildPlan(
      rates,
      updateForecast(initialForecast, 5),
      first,
      [],
      "2026-10-03T11:00:00Z",
    );
    expect(next.decisions[0]).toBe(first.decisions[0]);
    expect(next.decisions[4]).toBe(first.decisions[4]);
    expect(next.decisions.find((d) => d.id === "contractor")?.action).toBe(
      "ESCALATE",
    );
    expect(next.reopened).toEqual(["cloud", "contractor", "insurance"]);
    expect(next.unchanged).toEqual(["logistics", "marketing"]);
  });
  it("reopens only rate-dependent decisions when the EUR rate changes", () => {
    const p = buildPlan(rates);
    const next = buildPlan({ ...rates, EUR: "1.15" }, initialForecast, p);
    expect(next.reopened).toContain("logistics");
    expect(next.decisions.find((d) => d.id === "marketing")).toBe(
      p.decisions.find((d) => d.id === "marketing"),
    );
  });
  it("credits only a bounded verified receipt and reopens only the liquidity-blocked contractor", () => {
    const delayed = updateForecast(initialForecast, 5);
    const before = buildPlan(
      rates,
      delayed,
      undefined,
      [],
      "2026-10-03T10:00:00Z",
      minor("15971.87"),
    );
    const after = replanAfterDeposit(
      rates,
      delayed,
      before,
      minor("8000"),
      minor("15971.87"),
      [],
      "2026-10-03T11:00:00Z",
    );
    expect(before.decisions.find((d) => d.id === "contractor")?.action).toBe(
      "ESCALATE",
    );
    expect(after.decisions.find((d) => d.id === "contractor")?.action).toBe(
      "CONVERT_AND_PAY",
    );
    expect(after.reopened).toEqual(["contractor"]);
    expect(after.unchanged).toEqual([
      "logistics",
      "cloud",
      "insurance",
      "marketing",
    ]);
    for (const id of after.unchanged)
      expect(after.decisions.find((d) => d.id === id)).toBe(
        before.decisions.find((d) => d.id === id),
      );
    expect(
      after.decisions.find((d) => d.id === "contractor")?.evaluatedAt,
    ).toBe("2026-10-03T11:00:00Z");
    expect(after.remaining).toBeGreaterThanOrEqual(POLICY.reserve);
    expect(after.receiptCredit).toBe(minor("8000"));
    expect(() =>
      buildPlan(
        rates,
        delayed,
        undefined,
        [],
        undefined,
        undefined,
        minor("8000.01"),
      ),
    ).toThrow();
  });
});
