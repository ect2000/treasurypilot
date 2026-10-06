import type { Currency } from "../money";
import type {
  AuditEvent,
  Forecast,
  Interpretation,
  Plan,
  Snapshot,
} from "../types";

export type GovernorPolicy = {
  reserve: number;
  baseAllocation: number;
  receiptCap: number;
  fxCap: number;
  maxRisk: number;
  tiers: { confidence: number; fx: number; transfer: number }[];
};
export type WorldObligation = {
  id: string;
  vendor: string;
  amount: number;
  currency: Currency;
  dueAt: string;
  priority: string;
  criticality: "OPERATIONS_STOP" | "CONTRACTUAL" | "DISCRETIONARY";
  lateCostPerDay: number;
  transferMethod: "LOCAL" | "SWIFT";
  beneficiaryStatus: "EXISTING_CORRIDOR" | "REVIEW_REQUIRED";
  status: "PAID_SANDBOX" | "PLANNED";
  source: "SYNTHETIC";
};
export type Receivable = {
  id: string;
  amount: number;
  currency: Currency;
  expectedAt: string;
  confidence: number;
  evidenceIds: string[];
  state: "EXPECTED" | "DELAYED" | "SETTLED_SANDBOX";
  source: "SYNTHETIC" | "AIRWALLEX";
};
export type ContextRecord = {
  id: string;
  text: string;
  interpretation: Interpretation;
  acceptedAt?: string;
};
export type PlanRevision = {
  id: string;
  contextVersion: string;
  createdAt: string;
  state: "CURRENT" | "SUPERSEDED";
  cause: string;
  plan: Plan;
};
export type Movement = { currency: Currency; amount: number };
export type Reconciliation = {
  id: string;
  actionId: string;
  resourceId?: string;
  kind: "FX_CONVERSION" | "TRANSFER" | "DEPOSIT" | "WALLET";
  status: "PENDING" | "MATCHED" | "MISMATCH";
  expected: Movement[];
  observed: Movement[];
  difference: Movement[];
  expectedStatus: string;
  observedStatus: string;
  checkedAt: string;
  detail: string;
  basis: "HISTORICAL_BALANCES_AND_LIVE_RESOURCE" | "LIVE_RESOURCE";
};
export type CurrencyPosition = {
  currency: Currency;
  wallet: number;
  current: number;
  target: number;
  gap: number;
  why: string;
};
export type Placement = {
  positions: CurrencyPosition[];
  proposals: {
    sellCurrency: Currency;
    buyCurrency: Currency;
    sellAmount: number;
    buyAmount: number;
    valueUsd: number;
  }[];
  conserved: boolean;
  reserveAfter: number;
  reason: string;
};
export type Incident = {
  id: string;
  actionId: string;
  complaint: string;
  openedAt: string;
  updatedAt: string;
  state: "OPEN" | "ESCALATED" | "RESOLVED";
  providerStatus: string;
  decision: "WAIT" | "INVESTIGATE" | "ESCALATE" | "REPLACE_ELIGIBLE";
  replacementAllowed: boolean;
  reason: string;
  history: { at: string; status: string; source: "AIRWALLEX" | "OPERATOR" }[];
};
export type ApprovalIntent = {
  id: string;
  actionType: "CONVERT" | "TRANSFER";
  obligation: "logistics";
  planId: string;
  contextVersion: string;
  fingerprint: string;
  amount: number;
  currency: Currency;
  counterparty: string;
  quoteId: string;
  quoteExpiresAt: string;
  requestId: string;
  reserveAfter: number;
  createdAt: string;
  expiresAt: string;
  status: "PENDING" | "APPROVED" | "INVALIDATED" | "EXECUTED";
  sealedProposal: string;
  sealedApproval?: string;
};
export type Operation = {
  id: string;
  requestId: string;
  kind: "FX_CONVERSION" | "TRANSFER" | "DEPOSIT";
  resourceId?: string;
  status: string;
  provenance: "PRE_EXISTING_V1" | "GOVERNOR_V2";
  observedAt: string;
};
export type GovernorState = {
  schema: 2;
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  contextVersion: string;
  snapshot: Snapshot;
  forecast: Forecast;
  obligations: WorldObligation[];
  receivables: Receivable[];
  receiptApplied: boolean;
  executionLock?: string;
  policy: GovernorPolicy;
  plans: PlanRevision[];
  contexts: ContextRecord[];
  approvals: ApprovalIntent[];
  operations: Operation[];
  reconciliations: Reconciliation[];
  incidents: Incident[];
  events: AuditEvent[];
  placement: Placement;
  nextStep:
    | "OBSERVE"
    | "RECONCILE"
    | "REQUEST_APPROVAL"
    | "REVIEW_CONTEXT"
    | "MONITOR"
    | "ESCALATE";
};
export type GovernorView = Omit<GovernorState, "approvals"> & {
  approvals: Omit<ApprovalIntent, "sealedProposal" | "sealedApproval">[];
  persistence: "PRIVATE_BLOB" | "LOCAL_REVISIONS";
};
export interface FinanceContextProvider {
  name: string;
  forecast(): Forecast;
  source: "SYNTHETIC" | "ACCOUNTING";
}
