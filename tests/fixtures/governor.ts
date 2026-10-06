import type { Snapshot } from "../../lib/types";
import proof from "../../docs/evidence/financial-actions.json" with { type: "json" };
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
      beforeAvailable: 1000000000,
      afterAvailable: 1000800000,
      receivedAt: proof.deposit.proof.verifiedAt,
    },
  } as Snapshot;
}
