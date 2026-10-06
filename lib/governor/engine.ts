import Decimal from "decimal.js";
import { fingerprint } from "../server/authorization";
import { usdCost, type Currency } from "../money";
import {
  buildPlan,
  initialForecast,
  POLICY,
  obligations,
  replanAfterDeposit,
  replanForecastOnly,
} from "../treasury";
import type { Forecast, Plan, Snapshot } from "../types";
import type {
  GovernorPolicy,
  GovernorState,
  Placement,
  Reconciliation,
  Incident,
  FinanceContextProvider,
} from "./types";
import financialProof from "../../docs/evidence/financial-actions.json" with { type: "json" };

export const defaultPolicy: GovernorPolicy = {
  reserve: POLICY.reserve,
  baseAllocation: POLICY.allocation,
  receiptCap: POLICY.receiptCreditCap,
  fxCap: POLICY.executionCap,
  maxRisk: 0.7,
  tiers: POLICY.authorityTiers,
};
export const syntheticContext: FinanceContextProvider = {
  name: "TreasuryPilot demonstration invoices",
  source: "SYNTHETIC",
  forecast: () => ({ ...initialForecast }),
  obligations: () => structuredClone(obligations),
};
export function authority(policy: GovernorPolicy, confidence: number) {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
    throw new Error("Invalid confidence");
  const tier = [...policy.tiers]
    .sort((a, b) => b.confidence - a.confidence)
    .find((t) => confidence >= t.confidence);
  if (!tier) throw new Error("Policy tiers do not cover this confidence");
  return tier;
}
export function contextFingerprint(
  snapshot: Snapshot,
  forecast: Forecast,
  policy: GovernorPolicy,
) {
  return fingerprint({
    wallets: snapshot.balances.toSorted((a, b) =>
      a.currency.localeCompare(b.currency),
    ),
    rates: snapshot.rates,
    evidence: snapshot.evidence,
    deposit: {
      id: snapshot.deposit.id,
      state: snapshot.deposit.state,
      credit: snapshot.deposit.credit,
    },
    forecast,
    policy,
  });
}
export function calculatePlan(
  snapshot: Snapshot,
  forecast: Forecast,
  previous?: Plan,
  now = new Date().toISOString(),
  receiptApplied = false,
): Plan {
  const credit =
    receiptApplied && snapshot.deposit.state === "RECEIVED"
      ? (snapshot.deposit.credit ?? 0)
      : 0;
  const settled = snapshot.evidence.find(
    (e) => e.kind === "FX_CONVERSION" && e.status === "SETTLED",
  )?.sellAmount;
  const stableCosts = previous?.decisions.every(
    (d) =>
      d.cost ===
      (d.id === "logistics" && settled !== undefined
        ? settled
        : usdCost(d.obligation.amount, snapshot.rates[d.obligation.currency])),
  );
  if (
    previous &&
    previous.receiptCredit === credit &&
    stableCosts &&
    JSON.stringify(previous.forecast) !== JSON.stringify(forecast)
  )
    return replanForecastOnly(previous, forecast, now);
  if (
    previous &&
    previous.receiptCredit === credit &&
    stableCosts &&
    JSON.stringify(previous.forecast) === JSON.stringify(forecast)
  )
    return {
      ...previous,
      reopened: [],
      unchanged: previous.decisions.map((d) => d.id),
    };
  if (
    previous?.receiptCredit === 0 &&
    credit > 0 &&
    forecast.delayed &&
    stableCosts &&
    JSON.stringify(previous.forecast) === JSON.stringify(forecast)
  )
    return replanAfterDeposit(
      snapshot.rates,
      forecast,
      previous,
      credit,
      settled,
      [],
      now,
    );
  return buildPlan(
    snapshot.rates,
    forecast,
    previous,
    [],
    now,
    settled,
    credit,
  );
}

// Placement is an operational rebalancing proposal, never a currency trade or execution permission.
export function cashPlacement(snapshot: Snapshot, plan: Plan): Placement {
  const settled =
    snapshot.evidence.find(
      (e) => e.kind === "FX_CONVERSION" && e.status === "SETTLED",
    )?.sellAmount ?? 0;
  const positionCurrencies: Currency[] = ["USD", "EUR", "GBP"];
  const current: Record<Currency, number> = {
    USD: POLICY.allocation - settled,
    EUR: 0,
    GBP: 0,
    CNY: 0,
  };
  if (plan.receiptCredit > 0)
    current.EUR = new Decimal(plan.receiptCredit)
      .div(snapshot.rates.EUR)
      .floor()
      .toNumber();
  const targets: Record<Currency, number> = {
    USD: plan.reserve,
    EUR: 0,
    GBP: 0,
    CNY: 0,
  };
  for (const d of plan.decisions) {
    const alreadyPaid =
      d.id === "logistics" &&
      snapshot.evidence.some(
        (e) => e.kind === "TRANSFER" && e.status === "PAID",
      );
    if (!alreadyPaid && ["PAY_NOW", "CONVERT_AND_PAY"].includes(d.action))
      targets[d.obligation.currency] += d.obligation.amount;
  }
  const positions = positionCurrencies.map((currency) => ({
    currency,
    wallet:
      snapshot.balances.find((b) => b.currency === currency)?.available ?? 0,
    current: current[currency],
    target: targets[currency],
    gap: targets[currency] - current[currency],
    why:
      currency === "USD"
        ? "Reserve plus funded USD obligations; existing FX funding already deducted."
        : `Funded ${currency} obligations due within 72h, excluding the previously paid supplier.`,
  }));
  const work = { ...current };
  const proposals: Placement["proposals"] = [];
  for (const target of positions.filter((p) => p.gap > 0)) {
    let gap = target.gap;
    for (const source of positions.filter(
      (p) => p.currency !== target.currency && p.gap < 0,
    )) {
      const surplus = Math.max(0, work[source.currency] - source.target);
      const maxBuy = new Decimal(surplus)
        .mul(snapshot.rates[source.currency])
        .div(snapshot.rates[target.currency])
        .floor()
        .toNumber();
      const buyAmount = Math.min(gap, maxBuy);
      if (buyAmount <= 0) continue;
      const sellAmount = new Decimal(buyAmount)
        .mul(snapshot.rates[target.currency])
        .div(snapshot.rates[source.currency])
        .ceil()
        .toNumber();
      work[source.currency] -= sellAmount;
      work[target.currency] += buyAmount;
      gap -= buyAmount;
      proposals.push({
        sellCurrency: source.currency,
        buyCurrency: target.currency,
        sellAmount,
        buyAmount,
        valueUsd: usdCost(sellAmount, snapshot.rates[source.currency]),
      });
      if (gap === 0) break;
    }
  }
  const value = (balances: typeof current) =>
    positionCurrencies.reduce(
      (sum, c) => sum.add(new Decimal(balances[c]).mul(snapshot.rates[c])),
      new Decimal(0),
    );
  const rounding = Decimal.max(0, value(current).sub(value(work)))
    .ceil()
    .toNumber();
  return {
    positions,
    proposals,
    conserved: value(work).lte(value(current)),
    reserveAfter: plan.remaining - rounding,
    reason: proposals.length
      ? "Minimum indicated movements to place funded cash by currency. Indicative rates; exact quotes and fees are required before execution."
      : "Funded currency targets are covered. No FX movement is proposed.",
  };
}

export function reconcile(
  snapshot: Snapshot,
  now = snapshot.fetchedAt,
): Reconciliation[] {
  const rows: Reconciliation[] = [];
  for (const expected of financialProof.evidence) {
    const actual = snapshot.evidence.find(
      (e) => e.requestId === expected.requestId && e.kind === expected.kind,
    );
    const kind = expected.kind as "FX_CONVERSION" | "TRANSFER";
    const expectedMovements =
      kind === "FX_CONVERSION"
        ? [
            { currency: "USD" as const, amount: -expected.sellAmount! },
            { currency: "EUR" as const, amount: expected.buyAmount! },
          ]
        : [{ currency: "EUR" as const, amount: -expected.amount! }];
    const observed =
      kind === "FX_CONVERSION"
        ? [
            { currency: "USD" as const, amount: -(actual?.sellAmount ?? 0) },
            { currency: "EUR" as const, amount: actual?.buyAmount ?? 0 },
          ]
        : [{ currency: "EUR" as const, amount: -(actual?.amount ?? 0) }];
    const difference = expectedMovements.map((m, i) => ({
      currency: m.currency,
      amount: observed[i].amount - m.amount,
    }));
    const expectedStatus = kind === "FX_CONVERSION" ? "SETTLED" : "PAID";
    const corridor =
      kind === "FX_CONVERSION"
        ? actual?.sellCurrency === "USD" && actual?.buyCurrency === "EUR"
        : actual?.currency === "EUR";
    const terminal = actual?.status === expectedStatus;
    const mismatch = Boolean(
      actual &&
      (!corridor ||
        difference.some((d) => d.amount !== 0) ||
        ["FAILED", "CANCELLED", "RETURNED"].includes(actual.status)),
    );
    rows.push({
      id: `rec-${expected.requestId}`,
      actionId: expected.requestId,
      resourceId: actual?.id,
      kind,
      expected: expectedMovements,
      observed,
      difference,
      expectedStatus,
      observedStatus: actual?.status ?? "NOT_OBSERVED",
      status: mismatch ? "MISMATCH" : terminal ? "MATCHED" : "PENDING",
      checkedAt: now,
      basis: "LIVE_RESOURCE",
      detail: terminal
        ? "Live provider resource matches the original recorded amount, corridor and terminal Sandbox status."
        : "Creation or a nonterminal status is not proof of completion. Read and investigate before retrying.",
    });
  }
  if (snapshot.deposit.state === "RECEIVED") {
    const expected = [
      {
        currency: "EUR" as const,
        amount: financialProof.deposit.proof.amountMinor,
      },
    ];
    const observed = [
      { currency: "EUR" as const, amount: snapshot.deposit.delta ?? 0 },
    ];
    const difference = [
      {
        currency: "EUR" as const,
        amount: observed[0].amount - expected[0].amount,
      },
    ];
    rows.push({
      id: "rec-TPKIT1-2026-ONE",
      actionId: "TPKIT1-2026-ONE",
      resourceId: snapshot.deposit.id,
      kind: "DEPOSIT",
      expected,
      observed,
      difference,
      expectedStatus: "SETTLED",
      observedStatus: snapshot.deposit.status ?? "NOT_OBSERVED",
      checkedAt: now,
      status:
        difference[0].amount === 0 && snapshot.deposit.status === "SETTLED"
          ? "MATCHED"
          : "MISMATCH",
      basis: "HISTORICAL_BALANCES_AND_LIVE_RESOURCE",
      detail:
        "Exact historical before/after EUR wallet delta plus current provider deposit readback. Subsequent unrelated wallet movements do not rewrite this receipt.",
    });
  }
  const recorded = financialProof.deposit.balancesAfter;
  const expected = recorded.map((b) => ({
    currency: b.currency as Currency,
    amount: b.available,
  }));
  const observed = expected.map((m) => ({
    currency: m.currency,
    amount:
      snapshot.balances.find((b) => b.currency === m.currency)?.available ?? 0,
  }));
  const difference = expected.map((m, i) => ({
    currency: m.currency,
    amount: observed[i].amount - m.amount,
  }));
  rows.push({
    id: "rec-campaign-wallet",
    actionId: "campaign-wallet",
    kind: "WALLET",
    expected,
    observed,
    difference,
    expectedStatus: "CURRENT_BALANCES",
    observedStatus: "CURRENT_BALANCES",
    checkedAt: now,
    status: difference.every((d) => d.amount === 0) ? "MATCHED" : "MISMATCH",
    basis: "HISTORICAL_BALANCES_AND_LIVE_RESOURCE",
    detail:
      "Current available wallets compared with the recorded campaign ending balances. A variance may be newer external activity and requires investigation; it never proves an original payment failed.",
  });
  return rows;
}

export function incidentDecision(
  status: string,
  expired = false,
  fundingReturned = false,
): Pick<Incident, "decision" | "replacementAllowed" | "reason"> {
  if (status === "PAID")
    return {
      decision: "INVESTIGATE",
      replacementAllowed: false,
      reason:
        "Provider reports PAID in Sandbox. Investigate beneficiary receipt; do not pay again.",
    };
  if (["FAILED", "CANCELLED"].includes(status))
    return {
      decision: fundingReturned ? "REPLACE_ELIGIBLE" : "ESCALATE",
      replacementAllowed: fundingReturned,
      reason: fundingReturned
        ? "Original is terminal and returned funding is reconciled. A new exact approval and operation identity would still be required."
        : "Terminal failure alone does not prove funds are available for replacement. Reconcile cancellation and funding first.",
    };
  return {
    decision: expired ? "ESCALATE" : "WAIT",
    replacementAllowed: false,
    reason: expired
      ? "Deadline passed while the payment is nonterminal. Escalate and refresh; a missing response never authorizes a duplicate."
      : "Transfer remains nonterminal. Wait and inspect provider state; duplicate payment would create financial risk.",
  };
}

export function nextStep(
  state: Pick<
    GovernorState,
    "reconciliations" | "incidents" | "contexts" | "plans" | "snapshot"
  >,
): GovernorState["nextStep"] {
  if (
    state.reconciliations.some((r) => r.status === "MISMATCH") ||
    state.incidents.some((i) => i.state === "ESCALATED")
  )
    return "ESCALATE";
  if (state.reconciliations.some((r) => r.status === "PENDING"))
    return "RECONCILE";
  if (state.contexts.some((c) => !c.acceptedAt)) return "REVIEW_CONTEXT";
  const unpaidCampaign = !state.snapshot.evidence.some(
    (e) => e.kind === "TRANSFER" && e.status === "PAID",
  );
  if (
    unpaidCampaign &&
    state.plans
      .at(-1)
      ?.plan.decisions.some((d) => d.id === "logistics" && d.approvalRequired)
  )
    return "REQUEST_APPROVAL";
  return "MONITOR";
}
