import type { Currency } from "./money";
export type Balance = {
  currency: string;
  available: number;
  pending: number;
  reserved: number;
  total: number;
};
export type Rates = Record<Currency, string>;
export type Obligation = {
  id: string;
  title: string;
  category: string;
  amount: number;
  currency: Currency;
  dueHours: number;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  synthetic: true;
};
export type Forecast = {
  confidence: number;
  amount: number;
  dueHours: number;
  delayed: boolean;
  received: boolean;
};
export type Decision = {
  id: string;
  obligation: Obligation;
  action: "PAY_NOW" | "CONVERT_AND_PAY" | "DEFER" | "ESCALATE";
  cost: number;
  reserveAfter: number;
  approvalRequired: boolean;
  reason: string;
  dependencies: string[];
  signature: string;
  evaluatedAt: string;
  revision: number;
};
export type AuditEvent = {
  id: string;
  at: string;
  actor: "USER" | "AGENT" | "TREASURY_ENGINE" | "POLICY_ENGINE" | "AIRWALLEX";
  title: string;
  detail: string;
};
export type Plan = {
  decisions: Decision[];
  allocation: number;
  reserve: number;
  autonomy: number;
  spendable: number;
  committed: number;
  remaining: number;
  forecast: Forecast;
  reopened: string[];
  unchanged: string[];
  timeline: { hour: number; cash: number; expected: number }[];
};
export type FinancialEvidence = {
  kind: "FX_CONVERSION" | "TRANSFER";
  id: string;
  requestId: string;
  status: string;
  buyCurrency?: string;
  sellCurrency?: string;
  buyAmount?: number;
  sellAmount?: number;
  amount?: number;
  currency?: string;
  createdAt?: string;
};
export type Snapshot = {
  balances: Balance[];
  rates: Rates;
  globalAccounts: { currency: string; country: string; status: string }[];
  beneficiaries: { currency: string; country: string; method: string }[];
  evidence: FinancialEvidence[];
  fetchedAt: string;
  source: "AIRWALLEX_REST_SANDBOX";
  rateSource: string;
  executionAvailable: boolean;
};
export type Interpretation = {
  provider: "OPENROUTER" | "DETERMINISTIC_FALLBACK";
  model: string;
  summary: string;
  forecastDelayDays: number | null;
  invoice: {
    title: string;
    amountMajor: string;
    currency: Currency;
    dueHours: number;
  } | null;
  rejectedInstructions: boolean;
  warning?: string;
};
export type QuoteView = {
  id: string;
  buyAmount: number;
  sellAmount: number;
  buyCurrency: string;
  sellCurrency: string;
  rate: string;
  validUntil: string;
  source: "AIRWALLEX_REST_SANDBOX";
};
