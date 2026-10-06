import { z } from "zod";
import { minor } from "../money";
import type { Balance, FinancialEvidence, Rates, Snapshot } from "../types";
import { admitDemoWork } from "./demo-limits";
export const SANDBOX_BASE = "https://api.sandbox.airwallex.com";
export function assertSandbox(base: string) {
  if (base !== SANDBOX_BASE)
    throw new Error(
      "SANDBOX_GUARD: only the exact Airwallex Sandbox origin is permitted",
    );
}
const moneySchema = z.union([z.string(), z.number()]);
const BalanceSchema = z.object({
  currency: z.string(),
  available_amount: moneySchema,
  pending_amount: moneySchema,
  reserved_amount: moneySchema,
  total_amount: moneySchema,
});
export function mapBalances(value: unknown): Balance[] {
  return z
    .array(BalanceSchema)
    .parse(value)
    .map((b) => ({
      currency: b.currency,
      available: minor(b.available_amount, b.currency),
      pending: minor(b.pending_amount, b.currency),
      reserved: minor(b.reserved_amount, b.currency),
      total: minor(b.total_amount, b.currency),
    }));
}
export const QuoteSchema = z.object({
  quote_id: z.string(),
  buy_amount: z.union([z.number(), z.string()]),
  sell_amount: z.union([z.number(), z.string()]),
  buy_currency: z.string(),
  sell_currency: z.string(),
  client_rate: z.union([z.number(), z.string()]),
  valid_to_at: z
    .string()
    .refine(
      (value) => Number.isFinite(Date.parse(value)),
      "Invalid quote expiry",
    ),
});
export type RawQuote = z.infer<typeof QuoteSchema>;
const BeneficiarySchema = z
  .object({
    id: z.string(),
    beneficiary: z
      .object({
        entity_type: z.string(),
        bank_details: z
          .object({
            account_currency: z.string(),
            bank_country_code: z.string(),
            local_clearing_system: z.string().optional(),
          })
          .passthrough(),
      })
      .passthrough(),
    transfer_methods: z.array(z.string()).optional(),
  })
  .passthrough();
export type Beneficiary = z.infer<typeof BeneficiarySchema>;
export const DepositSchema = z
  .object({
    id: z.string(),
    amount: moneySchema,
    currency: z.string(),
    status: z.string(),
    statement_ref: z.string().optional(),
    reference: z.string().optional(),
  })
  .passthrough();
const ConversionSchema = z
  .object({
    conversion_id: z.string(),
    request_id: z.string().optional(),
    status: z.string(),
    buy_currency: z.string(),
    sell_currency: z.string(),
    buy_amount: z.union([z.number(), z.string()]),
    sell_amount: z.union([z.number(), z.string()]),
    created_at: z.string().optional(),
  })
  .passthrough()
  .transform((c) => ({ ...c, id: c.conversion_id }));
const TransferSchema = z
  .object({
    id: z.string(),
    request_id: z.string().optional(),
    status: z.string(),
    transfer_currency: z.string(),
    transfer_amount: z.union([z.number(), z.string()]),
    created_at: z.string().optional(),
    reference: z.string().optional(),
    fee_amount: z.union([z.number(), z.string()]).optional(),
    fee_currency: z.string().optional(),
  })
  .passthrough();
export function conversionEvidence(raw: unknown): FinancialEvidence {
  const c = ConversionSchema.parse(raw);
  return {
    kind: "FX_CONVERSION",
    id: c.id,
    requestId: c.request_id ?? "",
    status: c.status,
    buyCurrency: c.buy_currency,
    sellCurrency: c.sell_currency,
    buyAmount: minor(c.buy_amount, c.buy_currency),
    sellAmount: minor(c.sell_amount, c.sell_currency),
    createdAt: c.created_at,
  };
}
export function transferEvidence(raw: unknown): FinancialEvidence {
  const t = TransferSchema.parse(raw);
  return {
    kind: "TRANSFER",
    id: t.id,
    requestId: t.request_id ?? "",
    status: t.status,
    amount: minor(t.transfer_amount, t.transfer_currency),
    currency: t.transfer_currency,
    createdAt: t.created_at,
  };
}
export class AirwallexError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`Airwallex Sandbox: ${code} (HTTP ${status})`);
  }
}
export class AirwallexClient {
  private token?: { value: string; expires: number };
  private loginFlight?: Promise<string>;
  constructor(
    private config = {
      base: process.env.AIRWALLEX_BASE_URL ?? SANDBOX_BASE,
      clientId: process.env.AIRWALLEX_CLIENT_ID ?? "",
      apiKey: process.env.AIRWALLEX_API_KEY ?? "",
    },
    private transport: typeof fetch = fetch,
  ) {
    assertSandbox(config.base);
  }
  async authenticate(): Promise<string> {
    assertSandbox(this.config.base);
    if (this.token && this.token.expires > Date.now() + 60_000)
      return this.token.value;
    if (this.loginFlight) return this.loginFlight;
    this.loginFlight = (async () => {
      if (!this.config.clientId || !this.config.apiKey)
        throw new Error(
          "Airwallex Sandbox credentials are not configured on the server",
        );
      const response = await this.transport(
        `${this.config.base}/api/v1/authentication/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-client-id": this.config.clientId,
            "x-api-key": this.config.apiKey,
          },
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        },
      );
      if (!response.ok)
        throw new AirwallexError(response.status, "authentication_failed");
      const data = z
        .object({ token: z.string(), expires_at: z.string() })
        .parse(await response.json());
      const expires = Date.parse(data.expires_at);
      if (!Number.isFinite(expires))
        throw new Error("Invalid authentication expiry");
      this.token = { value: data.token, expires };
      return data.token;
    })();
    try {
      return await this.loginFlight;
    } finally {
      this.loginFlight = undefined;
    }
  }
  async request(
    path: string,
    method = "GET",
    body?: unknown,
    beforeSubmission?: () => void,
  ): Promise<unknown> {
    assertSandbox(this.config.base);
    if (
      !path.startsWith("/api/v1/") ||
      path.includes("..") ||
      path.includes("://")
    )
      throw new Error("Invalid API path");
    const token = await this.authenticate();
    if (
      method === "POST" &&
      (path === "/api/v1/fx/conversions/create" ||
        path === "/api/v1/transfers/create" ||
        /^\/api\/v1\/simulation\/transfers\/[^/]+\/transition$/.test(path)) &&
      !executionOpen()
    )
      throw new Error(
        "Sandbox execution window closed before provider submission",
      );
    beforeSubmission?.();
    const response = await this.transport(this.config.base + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-api-version": "2026-08-21",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401) this.token = undefined;
      const parsed = z
        .object({
          code: z
            .string()
            .regex(/^[a-zA-Z0-9_]+$/)
            .optional(),
        })
        .safeParse(error);
      throw new AirwallexError(
        response.status,
        parsed.success
          ? (parsed.data.code ?? "request_failed")
          : "request_failed",
      );
    }
    return response.status === 204 ? {} : response.json();
  }
  async balances() {
    return mapBalances(await this.request("/api/v1/balances/current"));
  }
  async beneficiaries() {
    return z
      .object({ items: z.array(BeneficiarySchema) })
      .parse(await this.request("/api/v1/beneficiaries?page_size=100")).items;
  }
  async globalAccounts() {
    const data = z
      .object({
        items: z.array(
          z
            .object({
              id: z.string(),
              required_features: z.array(z.object({ currency: z.string() })),
              status: z.string(),
              country_code: z.string(),
            })
            .passthrough(),
        ),
      })
      .parse(await this.request("/api/v1/global_accounts?page_size=100"));
    return data.items.map((a) => ({
      ...a,
      currency: a.required_features[0]?.currency ?? "UNKNOWN",
    }));
  }
  async rates(): Promise<Rates> {
    const values = await Promise.all(
      ["EUR", "GBP", "CNY"].map(async (currency) => {
        const response = z
          .object({
            rate: z.union([z.number(), z.string()]),
            currency_pair: z.string(),
          })
          .parse(
            await this.request(
              `/api/v1/fx/rates/current?buy_currency=USD&sell_currency=${currency}&sell_amount=100`,
            ),
          );
        // Rate follows market convention; normalize explicitly to USD per unit.
        const Decimal = (await import("decimal.js")).default;
        const rate = new Decimal(response.rate);
        if (!rate.isPositive() || !rate.isFinite())
          throw new Error("Invalid FX rate");
        return [
          currency,
          response.currency_pair === `${currency}USD`
            ? rate.toString()
            : response.currency_pair === `USD${currency}`
              ? new Decimal(1).div(rate).toString()
              : (() => {
                  throw new Error("Unexpected FX pair");
                })(),
        ];
      }),
    );
    return { USD: "1", ...Object.fromEntries(values) } as Rates;
  }
  async quote() {
    return QuoteSchema.parse(
      await this.request("/api/v1/fx/quotes/create", "POST", {
        buy_currency: "EUR",
        sell_currency: "USD",
        buy_amount: 14000,
        validity: "MIN_15",
      }),
    );
  }
  async retrieveQuote(id: string) {
    return QuoteSchema.parse(
      await this.request(`/api/v1/fx/quotes/${encodeURIComponent(id)}`),
    );
  }
  async conversions() {
    return z
      .object({ items: z.array(ConversionSchema) })
      .parse(await this.request("/api/v1/fx/conversions?page_size=100")).items;
  }
  async transfers() {
    return z
      .object({ items: z.array(TransferSchema) })
      .parse(await this.request("/api/v1/transfers?page_size=100")).items;
  }
  async deposits() {
    const raw = await this.request("/api/v1/deposits");
    // This Sandbox account currently returns [] for an empty list; the public
    // API example documents { items: [], has_more }. Accept both envelopes.
    const items = Array.isArray(raw)
      ? raw
      : z.object({ items: z.array(z.unknown()) }).parse(raw).items;
    return z.array(DepositSchema).parse(items);
  }
  async simulateDeposit(globalAccountId: string, statementRef: string) {
    return DepositSchema.parse(
      await this.request("/api/v1/simulation/deposit/create", "POST", {
        amount: 8000, // Airwallex API amounts are major units.
        global_account_id: globalAccountId,
        payer_bankname: "Sandbox customer bank",
        payer_country: "NL",
        payer_name: "TreasuryPilot demo customer",
        reference: "TreasuryPilot Kit 1 customer receipt",
        statement_ref: statementRef,
        status: "SETTLED",
      }),
    );
  }
  async convert(quote: RawQuote, requestId: string) {
    return conversionEvidence(
      await this.request(
        "/api/v1/fx/conversions/create",
        "POST",
        {
          request_id: requestId,
          quote_id: quote.quote_id,
          buy_currency: "EUR",
          sell_currency: "USD",
          buy_amount: 14000,
        },
        () => {
          if (
            !Number.isFinite(Date.parse(quote.valid_to_at)) ||
            Date.parse(quote.valid_to_at) <= Date.now()
          )
            throw new Error("Quote expired before provider submission");
        },
      ),
    );
  }
  async validateTransfer(beneficiaryId: string, requestId: string) {
    return this.request(
      "/api/v1/transfers/validate",
      "POST",
      this.transferPayload(beneficiaryId, requestId),
    );
  }
  private transferPayload(beneficiaryId: string, requestId: string) {
    return {
      request_id: requestId,
      beneficiary_id: beneficiaryId,
      transfer_amount: "14000.00",
      transfer_currency: "EUR",
      source_currency: "EUR",
      transfer_method: "LOCAL",
      reason: "payment_for_goods",
      reference: "TreasuryPilot demo supplier",
      fee_paid_by: "BENEFICIARY",
    };
  }
  async transfer(beneficiaryId: string, requestId: string) {
    return transferEvidence(
      await this.request(
        "/api/v1/transfers/create",
        "POST",
        this.transferPayload(beneficiaryId, requestId),
      ),
    );
  }
  async transition(transferId: string, nextStatus: "SENT" | "PAID") {
    return this.request(
      `/api/v1/simulation/transfers/${encodeURIComponent(transferId)}/transition`,
      "POST",
      { next_status: nextStatus },
    );
  }
}
const globalClient = globalThis as unknown as {
  treasuryAirwallex?: AirwallexClient;
};
export function airwallex() {
  return (globalClient.treasuryAirwallex ??= new AirwallexClient());
}
export function executionOpen() {
  const until = Date.parse(process.env.EXECUTION_ENABLED_UNTIL ?? "");
  return Number.isFinite(until) && Date.now() < until;
}
export async function readSnapshot(): Promise<Snapshot> {
  await admitDemoWork("observation");
  const client = airwallex();
  const [
    balances,
    rates,
    accounts,
    beneficiaries,
    conversions,
    transfers,
    deposit,
  ] = await Promise.all([
    client.balances(),
    client.rates(),
    client.globalAccounts(),
    client.beneficiaries(),
    client.conversions(),
    client.transfers(),
    (await import("./deposit")).depositEvidence(),
  ]);
  const campaign = (await import("./authorization")).campaignIds();
  return {
    balances,
    rates,
    globalAccounts: accounts.map((a) => ({
      currency: a.currency,
      country: a.country_code,
      status: a.status,
    })),
    beneficiaries: beneficiaries.map((b) => ({
      currency: b.beneficiary.bank_details.account_currency,
      country: b.beneficiary.bank_details.bank_country_code,
      method: b.transfer_methods?.[0] ?? "UNKNOWN",
    })),
    evidence: [
      ...conversions
        .filter((c) => c.request_id === campaign.conversion)
        .map(conversionEvidence),
      ...transfers
        .filter((t) => t.request_id === campaign.transfer)
        .map(transferEvidence),
    ],
    deposit,
    fetchedAt: new Date().toISOString(),
    source: "AIRWALLEX_REST_SANDBOX",
    rateSource: "Airwallex indicative rates · normalized to USD per unit",
    executionAvailable: executionOpen(),
  };
}
