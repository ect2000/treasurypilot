import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { minor } from "../money";
import {
  autonomyLimit,
  initialForecast,
  POLICY,
  reserveCheck,
} from "../treasury";
import type { Balance, Forecast, QuoteView } from "../types";
import {
  airwallex,
  assertSandbox,
  executionOpen,
  SANDBOX_BASE,
  type Beneficiary,
  type RawQuote,
} from "./airwallex";
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function fingerprint(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
function key() {
  const secret = process.env.AUTHORIZATION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Authorization signing secret is not configured");
  return createHash("sha256").update(secret).digest();
}
export function seal(value: unknown, duration = 5 * 60_000) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify({ value, expires: Date.now() + duration })),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}
export function unseal<T>(token: string): T {
  try {
    if (token.length > 18000) throw new Error();
    const bytes = Buffer.from(token, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      bytes.subarray(0, 12),
    );
    decipher.setAuthTag(bytes.subarray(12, 28));
    const payload = JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    );
    if (!Number.isFinite(payload.expires) || payload.expires < Date.now())
      throw new Error();
    return payload.value as T;
  } catch {
    throw new Error(
      "Authorization is invalid or expired. Refresh the proposal.",
    );
  }
}
export function campaignIds() {
  const campaign =
    process.env.EXECUTION_CAMPAIGN ?? "treasurypilot-hackathon-2026-v1";
  const uuid = (kind: string) => {
    const h = fingerprint({ campaign, obligation: "logistics", kind });
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  };
  return {
    conversion: uuid("conversion"),
    transfer: uuid("transfer"),
    sent: uuid("simulation-SENT"),
    paid: uuid("simulation-PAID"),
  };
}
type Context = {
  operation: "CONVERT" | "TRANSFER";
  quoteId: string;
  quote: QuoteView;
  beneficiaryHash: string;
  walletHash: string;
  forecast: Forecast;
  stateVersion: string;
  reserveAfter: number;
  cost: number;
  requestId: string;
  obligation: "logistics";
  campaign: string;
};
export type Proposal = {
  token: string;
  fingerprint: string;
  quote: QuoteView;
  operation: Context["operation"];
  cost: number;
  reserveAfter: number;
  autonomy: number;
  approvalRequired: boolean;
  beneficiary: string;
  requestId: string;
};
export function authorizeFinancialAction(input: {
  cost: number;
  allocation: number;
  reserve: number;
  autonomy: number;
  fingerprint: string;
  approvedFingerprint?: string;
  walletAvailable: number;
  expired: boolean;
  campaignCap: number;
}) {
  const check = reserveCheck(input.allocation, input.cost, input.reserve);
  if (!check.pass)
    throw new Error(
      "POLICY_BLOCKED: resulting reserve is below the minimum reserve floor",
    );
  if (input.cost > input.campaignCap || input.walletAvailable < input.cost)
    throw new Error(
      "POLICY_BLOCKED: action exceeds the campaign cap or available wallet balance",
    );
  if (input.expired)
    throw new Error("POLICY_BLOCKED: quote or execution window expired");
  if (
    input.cost > input.autonomy &&
    input.approvedFingerprint !== input.fingerprint
  )
    throw new Error(
      "APPROVAL_REQUIRED: exact current financial fingerprint must be approved",
    );
  return { pass: true as const, reserveAfter: check.after };
}
function quoteView(quote: RawQuote): QuoteView {
  return {
    id: quote.quote_id,
    buyAmount: minor(quote.buy_amount, quote.buy_currency),
    sellAmount: minor(quote.sell_amount, quote.sell_currency),
    buyCurrency: quote.buy_currency,
    sellCurrency: quote.sell_currency,
    rate: String(quote.client_rate),
    validUntil: quote.valid_to_at,
    source: "AIRWALLEX_REST_SANDBOX",
  };
}
function selectBeneficiary(beneficiaries: Beneficiary[]) {
  const suitable = beneficiaries.filter(
    (b) =>
      b.beneficiary.bank_details.account_currency === "EUR" &&
      b.beneficiary.bank_details.bank_country_code === "DE" &&
      b.transfer_methods?.includes("LOCAL"),
  );
  if (suitable.length !== 1)
    throw new Error(
      "No unique existing DE/EUR/LOCAL beneficiary is available. No beneficiary has been created.",
    );
  return suitable[0];
}
function walletHash(balances: Balance[]) {
  return fingerprint(
    balances.toSorted((a, b) => a.currency.localeCompare(b.currency)),
  );
}
export async function prepareProposal(
  operation: Context["operation"],
  forecast = initialForecast,
  stateVersion = "initial",
): Promise<Proposal> {
  if (!executionOpen())
    throw new Error(
      "The bounded Sandbox execution window is closed. Live reads and planning remain available.",
    );
  const client = airwallex();
  const ids = campaignIds();
  const [balances, beneficiaries, existingConversions, existingTransfers] =
    await Promise.all([
      client.balances(),
      client.beneficiaries(),
      client.conversions(),
      client.transfers(),
    ]);
  const conversion = existingConversions.find(
    (c) => c.request_id === ids.conversion,
  );
  const transfer = existingTransfers.find((t) => t.request_id === ids.transfer);
  if (operation === "CONVERT" && conversion)
    throw new Error(
      "This campaign conversion already exists. Refresh to view the verified evidence; it will not be duplicated.",
    );
  if (operation === "TRANSFER" && transfer)
    throw new Error(
      "This campaign transfer already exists. Refresh to view the verified evidence; it will not be duplicated.",
    );
  if (
    operation === "TRANSFER" &&
    (!conversion || conversion.status !== "SETTLED")
  )
    throw new Error(
      "Complete and verify the campaign FX conversion before paying the supplier.",
    );
  const beneficiary = selectBeneficiary(beneficiaries);
  const quote =
    operation === "CONVERT"
      ? quoteView(await client.quote())
      : {
          id: conversion!.id,
          buyAmount: minor(conversion!.buy_amount),
          sellAmount: minor(conversion!.sell_amount),
          buyCurrency: "EUR",
          sellCurrency: "USD",
          rate: "settled conversion",
          validUntil: process.env.EXECUTION_ENABLED_UNTIL!,
          source: "AIRWALLEX_REST_SANDBOX" as const,
        };
  if (
    quote.buyCurrency !== "EUR" ||
    quote.sellCurrency !== "USD" ||
    quote.buyAmount !== POLICY.maxCampaignBuy
  )
    throw new Error("Unexpected Airwallex quote amounts or corridor");
  const cost = quote.sellAmount;
  const reserveAfter = POLICY.allocation - cost;
  const context: Context = {
    operation,
    quoteId: quote.id,
    quote,
    cost,
    reserveAfter,
    beneficiaryHash: fingerprint(beneficiary),
    walletHash: walletHash(balances),
    forecast,
    stateVersion,
    requestId: operation === "CONVERT" ? ids.conversion : ids.transfer,
    obligation: "logistics",
    campaign:
      process.env.EXECUTION_CAMPAIGN ?? "treasurypilot-hackathon-2026-v1",
  };
  const print = fingerprint(context);
  authorizeFinancialAction({
    cost,
    allocation: POLICY.allocation,
    reserve: POLICY.reserve,
    autonomy: autonomyLimit(forecast.confidence),
    fingerprint: print,
    approvedFingerprint: print,
    walletAvailable: balances.find((b) => b.currency === "USD")?.available ?? 0,
    expired: Date.parse(quote.validUntil) < Date.now(),
    campaignCap: POLICY.executionCap,
  });
  if (operation === "TRANSFER")
    await client.validateTransfer(beneficiary.id, ids.transfer);
  return {
    token: seal({ type: "proposal", context }),
    fingerprint: print,
    quote,
    operation,
    cost,
    reserveAfter,
    autonomy: autonomyLimit(forecast.confidence),
    approvalRequired: cost > autonomyLimit(forecast.confidence),
    beneficiary: "Existing Sandbox beneficiary · DE / EUR / LOCAL",
    requestId: context.requestId,
  };
}
export function approveProposal(
  token: string,
  expected: string,
  confirmed: boolean,
  stateVersion: string,
) {
  const payload = unseal<{ type: string; context: Context }>(token);
  if (
    payload.type !== "proposal" ||
    fingerprint(payload.context) !== expected ||
    !confirmed ||
    payload.context.stateVersion !== stateVersion
  )
    throw new Error(
      "Approval cannot be bound: changed state, fingerprint or missing confirmation.",
    );
  return seal({
    type: "approval",
    fingerprint: expected,
    context: payload.context,
  });
}
export async function executeApproved(token: string, stateVersion: string) {
  assertSandbox(process.env.AIRWALLEX_BASE_URL ?? SANDBOX_BASE);
  const approval = unseal<{
    type: string;
    fingerprint: string;
    context: Context;
  }>(token);
  if (
    approval.type !== "approval" ||
    approval.fingerprint !== fingerprint(approval.context)
  )
    throw new Error("Invalid approval binding");
  const c = approval.context;
  if (c.stateVersion !== stateVersion)
    throw new Error("State changed. Approval invalidated.");
  if (!executionOpen()) throw new Error("Sandbox execution window is closed");
  const client = airwallex(),
    ids = campaignIds();
  const existing =
    c.operation === "CONVERT"
      ? (await client.conversions()).find(
          (x) => x.request_id === ids.conversion,
        )
      : (await client.transfers()).find((x) => x.request_id === ids.transfer);
  if (existing) {
    const { conversionEvidence, transferEvidence } =
      await import("./airwallex");
    return c.operation === "CONVERT"
      ? conversionEvidence(existing)
      : transferEvidence(existing);
  }
  const [balances, beneficiaries] = await Promise.all([
    client.balances(),
    client.beneficiaries(),
  ]);
  const beneficiary = selectBeneficiary(beneficiaries);
  if (
    walletHash(balances) !== c.walletHash ||
    fingerprint(beneficiary) !== c.beneficiaryHash
  )
    throw new Error(
      "Financial state changed. Approval invalidated. Refresh balances and approve a new proposal.",
    );
  let rawQuote: RawQuote | undefined;
  if (c.operation === "CONVERT") {
    rawQuote = await client.retrieveQuote(c.quoteId);
    if (fingerprint(quoteView(rawQuote)) !== fingerprint(c.quote))
      throw new Error("Quote changed. Approval invalidated.");
  } else {
    const conversion = (await client.conversions()).find(
      (x) => x.request_id === ids.conversion,
    );
    if (
      !conversion ||
      conversion.status !== "SETTLED" ||
      minor(conversion.sell_amount) !== c.cost ||
      balances.find((b) => b.currency === "EUR")!.available <
        POLICY.maxCampaignBuy
    )
      throw new Error(
        "Settled conversion or available EUR no longer matches the approved transfer.",
      );
  }
  authorizeFinancialAction({
    cost: c.cost,
    allocation: POLICY.allocation,
    reserve: POLICY.reserve,
    autonomy: autonomyLimit(c.forecast.confidence),
    fingerprint: fingerprint(c),
    approvedFingerprint: approval.fingerprint,
    walletAvailable: balances.find((b) => b.currency === "USD")?.available ?? 0,
    expired: Date.parse(c.quote.validUntil) < Date.now(),
    campaignCap: POLICY.executionCap,
  });
  return c.operation === "CONVERT"
    ? client.convert(rawQuote!, ids.conversion)
    : client.transfer(beneficiary.id, ids.transfer);
}
