import { minor, usdCost } from "./money";
import type { Decision, Forecast, Obligation, Plan, Rates } from "./types";
export const POLICY = Object.freeze({
  allocation: minor("48000"),
  reserve: minor("15000"),
  executionCap: minor("18000"),
  maxCampaignBuy: minor("14000", "EUR"),
  receiptCreditCap: minor("8000"),
});
export const obligations: Obligation[] = [
  {
    id: "logistics",
    title: "Critical logistics supplier",
    category: "Supply chain · Germany",
    amount: minor("14000"),
    currency: "EUR",
    dueHours: 13,
    priority: "CRITICAL",
    synthetic: true,
  },
  {
    id: "cloud",
    title: "Cloud infrastructure",
    category: "Infrastructure · United States",
    amount: minor("8200"),
    currency: "USD",
    dueHours: 26,
    priority: "HIGH",
    synthetic: true,
  },
  {
    id: "contractor",
    title: "UK contractor",
    category: "Professional services · United Kingdom",
    amount: minor("7500"),
    currency: "GBP",
    dueHours: 38,
    priority: "MEDIUM",
    synthetic: true,
  },
  {
    id: "insurance",
    title: "Insurance / compliance",
    category: "Business continuity · United States",
    amount: minor("5000"),
    currency: "USD",
    dueHours: 60,
    priority: "MEDIUM",
    synthetic: true,
  },
  {
    id: "marketing",
    title: "Marketing vendor",
    category: "Growth · United States",
    amount: minor("6000"),
    currency: "USD",
    dueHours: 70,
    priority: "LOW",
    synthetic: true,
  },
];
export const initialForecast: Forecast = {
  confidence: 0.92,
  amount: minor("20000"),
  dueHours: 24,
  delayed: false,
  received: false,
};
export function autonomyLimit(confidence: number) {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
    throw new Error("Invalid confidence");
  return confidence >= 0.85
    ? minor("10000")
    : confidence >= 0.6
      ? minor("5000")
      : minor("2500");
}
export function updateForecast(
  forecast: Forecast,
  delayDays: number,
): Forecast {
  if (!Number.isInteger(delayDays) || delayDays < 0 || delayDays > 30)
    throw new Error("Invalid delay");
  return {
    ...forecast,
    delayed: delayDays > 0,
    dueHours: 24 + delayDays * 24,
    confidence: delayDays > 0 ? 0.31 : 0.92,
  };
}
export function reserveCheck(
  allocation: number,
  cost: number,
  reserve: number = POLICY.reserve,
  maxAllocation: number = POLICY.allocation,
) {
  if (
    ![allocation, cost, reserve].every(Number.isSafeInteger) ||
    cost <= 0 ||
    allocation < 0 ||
    reserve < 0
  )
    return { pass: false, after: 0 };
  const after = allocation - cost;
  return { pass: after >= reserve && allocation <= maxAllocation, after };
}
// Decisions depend on semantic inputs. Identical signatures preserve identity and evaluation time.
export function buildPlan(
  rates: Rates,
  forecast: Forecast = initialForecast,
  previous?: Plan,
  custom: Obligation[] = [],
  now = new Date().toISOString(),
  settledSupplierCost?: number,
  receiptCredit = 0,
): Plan {
  if (
    !Number.isSafeInteger(receiptCredit) ||
    receiptCredit < 0 ||
    receiptCredit > POLICY.receiptCreditCap
  )
    throw new Error("Unverified receipt credit exceeds the fixed campaign cap");
  const allocation = POLICY.allocation + receiptCredit;
  const autonomy = autonomyLimit(forecast.confidence);
  let remaining = allocation;
  const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sorted = [...obligations, ...custom].sort(
    (a, b) => rank[a.priority] - rank[b.priority] || a.dueHours - b.dueHours,
  );
  const reopened: string[] = [],
    unchanged: string[] = [];
  const timeline = [
    { hour: 0, cash: allocation / 100, expected: allocation / 100 },
  ];
  const decisions = sorted.map((obligation): Decision => {
    const cost =
      obligation.id === "logistics" && settledSupplierCost !== undefined
        ? settledSupplierCost
        : usdCost(obligation.amount, rates[obligation.currency]);
    if (!Number.isSafeInteger(cost) || cost <= 0)
      throw new Error("Invalid obligation cost");
    const check = reserveCheck(remaining, cost, POLICY.reserve, allocation);
    const dependencies = [
      `obligation:${obligation.id}`,
      `rate:${obligation.currency}`,
      "allocation",
      "reserve",
    ];
    let action: Decision["action"];
    let reason: string;
    let approvalRequired = false;
    if (obligation.priority === "LOW") {
      action = "DEFER";
      reason =
        "Discretionary spend. Protect liquidity for critical and contractual obligations; revisit after a confirmed receipt.";
    } else if (!check.pass) {
      dependencies.push("forecast");
      const future =
        forecast.confidence >= 0.85 &&
        forecast.dueHours < obligation.dueHours &&
        !forecast.delayed;
      action = future ? "DEFER" : "ESCALATE";
      reason = future
        ? "Await the expected receipt, then re-evaluate. Forecast cash is not available cash and cannot authorize execution."
        : "Current allocation cannot fund this obligation above the reserve floor. The delayed forecast cannot close the gap; human resolution is required.";
    } else {
      action = obligation.currency === "USD" ? "PAY_NOW" : "CONVERT_AND_PAY";
      approvalRequired = cost > autonomy;
      // Above the maximum tier always requires approval, so confidence alone cannot change that decision.
      if (cost <= minor("10000")) dependencies.push("autonomy");
      reason =
        obligation.currency === "USD"
          ? "Fund from the authorized USD allocation while preserving the reserve."
          : "The operating allocation is denominated in USD. Acquire only the foreign currency required for this obligation; the unallocated wallet is not agent spending authority.";
      remaining -= cost;
      timeline.push({
        hour: obligation.dueHours,
        cash: remaining / 100,
        expected:
          (remaining +
            (forecast.dueHours <= obligation.dueHours && !forecast.delayed
              ? forecast.amount
              : 0)) /
          100,
      });
    }
    const reserveAfter =
      obligation.priority === "LOW" ? allocation : check.after;
    if (obligation.priority === "LOW") dependencies.splice(2);
    const signature = JSON.stringify({
      obligation,
      cost,
      action,
      reserveAfter,
      approvalRequired,
      reason,
      forecast: dependencies.includes("forecast") ? forecast : undefined,
    });
    const old = previous?.decisions.find((d) => d.id === obligation.id);
    if (old?.signature === signature) {
      unchanged.push(obligation.id);
      return old;
    }
    if (old) reopened.push(obligation.id);
    return {
      id: obligation.id,
      obligation,
      cost,
      action,
      reserveAfter,
      approvalRequired,
      reason,
      dependencies,
      signature,
      evaluatedAt: now,
      revision: (old?.revision ?? 0) + 1,
    };
  });
  timeline.push({
    hour: 72,
    cash: remaining / 100,
    expected: (remaining + (!forecast.delayed ? forecast.amount : 0)) / 100,
  });
  if (
    !forecast.delayed &&
    forecast.dueHours <= 72 &&
    !timeline.some((point) => point.hour === forecast.dueHours)
  ) {
    const cash = timeline
      .filter((point) => point.hour <= forecast.dueHours)
      .at(-1)!.cash;
    timeline.push({
      hour: forecast.dueHours,
      cash,
      expected: (minor(String(cash)) + forecast.amount) / 100,
    });
  }
  timeline.sort((a, b) => a.hour - b.hour);
  return {
    decisions,
    allocation,
    receiptCredit,
    reserve: POLICY.reserve,
    autonomy,
    spendable: allocation - POLICY.reserve,
    committed: allocation - remaining,
    remaining,
    forecast,
    reopened,
    unchanged,
    timeline,
  };
}

// A verified receipt changes the liquidity branch only. Prior funded decisions
// retain their original evaluation identity and historical reserve-at-decision.
export function replanAfterDeposit(
  rates: Rates,
  forecast: Forecast,
  previous: Plan,
  receiptCredit: number,
  settledSupplierCost: number | undefined,
  custom: Obligation[] = [],
  now = new Date().toISOString(),
): Plan {
  if (!forecast.delayed || previous.receiptCredit !== 0 || receiptCredit <= 0)
    throw new Error("Deposit replan requires the delayed pre-deposit plan");
  const next = buildPlan(
    rates,
    forecast,
    previous,
    custom,
    now,
    settledSupplierCost,
    receiptCredit,
  );
  const reopened: string[] = [];
  const unchanged: string[] = [];
  next.decisions = next.decisions.map((decision) => {
    const old = previous.decisions.find((item) => item.id === decision.id);
    if (
      old &&
      old.action === decision.action &&
      old.cost === decision.cost &&
      old.approvalRequired === decision.approvalRequired &&
      old.reason === decision.reason &&
      JSON.stringify(old.obligation) === JSON.stringify(decision.obligation)
    ) {
      unchanged.push(decision.id);
      return old;
    }
    if (old) reopened.push(decision.id);
    return decision;
  });
  next.reopened = reopened;
  next.unchanged = unchanged;
  return next;
}
