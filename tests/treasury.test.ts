import { describe, it, expect } from "vitest";
import { major, minor, usdCost } from "../lib/money";
import {
  autonomyLimit,
  buildPlan,
  initialForecast,
  POLICY,
  reserveCheck,
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
});
