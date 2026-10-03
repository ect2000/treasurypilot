import { open, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { z } from "zod";
import staticProof from "../../docs/evidence/deposit-action.json";
import { minor } from "../money";
import { buildPlan, POLICY, replanAfterDeposit } from "../treasury";
import type { DepositEvidence, Forecast } from "../types";
import { airwallex, assertSandbox, SANDBOX_BASE } from "./airwallex";

export const DEPOSIT_STATEMENT_REF = "TPKIT1-2026-ONE";
export const DEPOSIT_AMOUNT_MINOR = minor("8000", "EUR");
const DEPOSIT_REFERENCE = "TreasuryPilot Kit 1 customer receipt";
const PROOF_PATH = path.join(
  process.cwd(),
  "docs",
  "evidence",
  "deposit-action.json",
);
const LOCK_PATH = path.join(
  process.cwd(),
  ".operator",
  "deposit-TPKIT1-2026-ONE.lock",
);
const ProofSchema = z.object({
  verified: z.literal(true),
  id: z.string(),
  status: z.literal("SETTLED"),
  currency: z.literal("EUR"),
  amountMinor: z.number().int(),
  statementRef: z.literal(DEPOSIT_STATEMENT_REF),
  beforeAvailable: z.number().int(),
  afterAvailable: z.number().int(),
  delta: z.number().int(),
  credit: z.number().int(),
  verifiedAt: z.string(),
  planBefore: z.object({ contractor: z.string(), remaining: z.number().int() }),
  planAfter: z.object({
    contractor: z.string(),
    remaining: z.number().int(),
    reopened: z.array(z.string()),
    unchanged: z.array(z.string()),
  }),
});
export type DepositProof = z.infer<typeof ProofSchema>;

async function readProof(): Promise<DepositProof | undefined> {
  let value: unknown = staticProof;
  if (process.env.NODE_ENV === "development") {
    value = JSON.parse(await readFile(PROOF_PATH, "utf8"));
  }
  const parsed = ProofSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function depositOperatorAvailable() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.VERCEL !== "1" &&
    process.env.DEPOSIT_OPERATOR_ENABLED === "true"
  );
}

export async function depositEvidence(): Promise<DepositEvidence> {
  const proof = await readProof();
  if (!proof)
    return {
      state: "READY",
      operatorAvailable: depositOperatorAvailable(),
      amount: DEPOSIT_AMOUNT_MINOR,
      currency: "EUR",
    };
  // The committed proof is only displayed/credited after a fresh provider read.
  const deposits = await airwallex().deposits();
  const match = deposits.find((item) => item.id === proof.id);
  if (
    !match ||
    match.status !== "SETTLED" ||
    match.currency !== "EUR" ||
    minor(match.amount, "EUR") !== proof.amountMinor
  ) {
    throw new Error(
      "Recorded deposit cannot be verified against Airwallex Sandbox",
    );
  }
  return {
    state: "RECEIVED",
    operatorAvailable: false,
    amount: proof.amountMinor,
    currency: "EUR",
    id: proof.id,
    status: match.status,
    beforeAvailable: proof.beforeAvailable,
    afterAvailable: proof.afterAvailable,
    delta: proof.delta,
    credit: proof.credit,
    receivedAt: proof.verifiedAt,
    decisionBefore: proof.planBefore.contractor,
    decisionAfter: proof.planAfter.contractor,
    reserveBefore: proof.planBefore.remaining,
    reserveAfter: proof.planAfter.remaining,
    reopened: proof.planAfter.reopened,
    unchanged: proof.planAfter.unchanged,
  };
}

export async function simulateDepositOnce(
  forecast: Forecast,
): Promise<DepositProof> {
  assertSandbox(process.env.AIRWALLEX_BASE_URL ?? SANDBOX_BASE);
  if (!depositOperatorAvailable())
    throw new Error("Sandbox deposit operator action is disabled");
  if (!forecast.delayed || forecast.confidence !== 0.31)
    throw new Error(
      "Accept the customer-delay evidence before the deposit action",
    );
  const verified = await readProof();
  if (verified) return verified;
  await mkdir(path.dirname(LOCK_PATH), { recursive: true });
  // Exclusive, durable latch: retries and concurrent local requests fail closed.
  // It is deliberately never removed by application code.
  const lock = await open(LOCK_PATH, "wx").catch(() => undefined);
  if (!lock) return reconcileLockedDeposit(forecast);
  try {
    const client = airwallex();
    const existing = await client.deposits();
    if (
      existing.some(
        (item) =>
          item.statement_ref === DEPOSIT_STATEMENT_REF ||
          item.reference === DEPOSIT_REFERENCE,
      )
    )
      throw new Error(
        "The fixed Sandbox deposit statement reference already exists",
      );
    const [before, accounts] = await Promise.all([
      (await import("./airwallex")).readSnapshot(),
      client.globalAccounts(),
    ]);
    const account = accounts.filter(
      (item) => item.currency === "EUR" && item.status === "ACTIVE",
    );
    if (account.length !== 1 || accounts.length !== 1)
      throw new Error(
        "A unique existing active EUR Global Account is required",
      );
    const eurBefore = before.balances.find((item) => item.currency === "EUR");
    if (!eurBefore) throw new Error("EUR wallet balance is unavailable");
    const fx = before.evidence.find(
      (item) => item.kind === "FX_CONVERSION" && item.status === "SETTLED",
    );
    const transfer = before.evidence.find(
      (item) => item.kind === "TRANSFER" && item.status === "PAID",
    );
    if (!fx?.sellAmount || !transfer)
      throw new Error(
        "The already-completed FX and supplier transfer must be verified first",
      );
    const credit = Math.min(
      POLICY.receiptCreditCap,
      new Decimal(DEPOSIT_AMOUNT_MINOR)
        .mul(before.rates.EUR)
        .floor()
        .toNumber(),
    );
    const planBefore = buildPlan(
      before.rates,
      forecast,
      undefined,
      [],
      new Date().toISOString(),
      fx.sellAmount,
    );
    const planAfter = replanAfterDeposit(
      before.rates,
      forecast,
      planBefore,
      credit,
      fx.sellAmount,
    );
    const contractorBefore = planBefore.decisions.find(
      (item) => item.id === "contractor",
    );
    const contractorAfter = planAfter.decisions.find(
      (item) => item.id === "contractor",
    );
    if (
      contractorBefore?.action !== "ESCALATE" ||
      contractorAfter?.action !== "CONVERT_AND_PAY" ||
      planAfter.remaining < POLICY.reserve ||
      planAfter.reopened.join(",") !== "contractor"
    )
      throw new Error(
        "Deposit would not produce the bounded, reserve-safe Kit 1 replan",
      );
    await lock.writeFile(
      JSON.stringify({
        statementRef: DEPOSIT_STATEMENT_REF,
        claimedAt: new Date().toISOString(),
        beforeAvailable: eurBefore.available,
      }),
    );
    await lock.sync();
    // The ONLY new financial Sandbox mutation in this campaign.
    const response = await client.simulateDeposit(
      account[0].id,
      DEPOSIT_STATEMENT_REF,
    );
    if (
      response.status !== "SETTLED" ||
      response.currency !== "EUR" ||
      minor(response.amount, "EUR") !== DEPOSIT_AMOUNT_MINOR ||
      response.reference !== DEPOSIT_REFERENCE ||
      (response.statement_ref !== undefined &&
        response.statement_ref !== DEPOSIT_STATEMENT_REF)
    )
      throw new Error(
        "Deposit response differs from the fixed campaign request; do not retry",
      );
    let after = await client.balances();
    for (
      let attempt = 0;
      attempt < 7 &&
      after.find((item) => item.currency === "EUR")?.available !==
        eurBefore.available + DEPOSIT_AMOUNT_MINOR;
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      after = await client.balances();
    }
    const eurAfter = after.find((item) => item.currency === "EUR");
    if (
      !eurAfter ||
      eurAfter.available - eurBefore.available !== DEPOSIT_AMOUNT_MINOR
    )
      throw new Error(
        "Deposit posted but exact EUR balance delta is unverified; do not retry",
      );
    if (
      before.balances.some(
        (item) =>
          item.currency !== "EUR" &&
          after.find((next) => next.currency === item.currency)?.available !==
            item.available,
      )
    )
      throw new Error(
        "Other wallet balances changed during deposit verification; do not retry",
      );
    const proof: DepositProof = {
      verified: true,
      id: response.id,
      status: "SETTLED",
      currency: "EUR",
      amountMinor: DEPOSIT_AMOUNT_MINOR,
      statementRef: DEPOSIT_STATEMENT_REF,
      beforeAvailable: eurBefore.available,
      afterAvailable: eurAfter.available,
      delta: DEPOSIT_AMOUNT_MINOR,
      credit,
      verifiedAt: new Date().toISOString(),
      planBefore: {
        contractor: contractorBefore.action,
        remaining: planBefore.remaining,
      },
      planAfter: {
        contractor: contractorAfter.action,
        remaining: planAfter.remaining,
        reopened: planAfter.reopened,
        unchanged: planAfter.unchanged,
      },
    };
    await writeFile(PROOF_PATH, JSON.stringify(proof, null, 2) + "\n", {
      flag: "w",
    });
    return proof;
  } finally {
    await lock.close();
  }
}

// Recovery is read-only against Airwallex. It finishes local evidence after a
// provider-accepted POST whose response or process failed; it never posts again.
export async function reconcileLockedDeposit(
  forecast: Forecast,
): Promise<DepositProof> {
  const verified = await readProof();
  if (verified) return verified;
  const lock = z
    .object({
      statementRef: z.literal(DEPOSIT_STATEMENT_REF),
      beforeAvailable: z.number().int(),
    })
    .parse(JSON.parse(await readFile(LOCK_PATH, "utf8")));
  const client = airwallex();
  const [deposits, accounts, snapshot] = await Promise.all([
    client.deposits(),
    client.globalAccounts(),
    (await import("./airwallex")).readSnapshot(),
  ]);
  const matches = deposits.filter(
    (item) =>
      item.reference === DEPOSIT_REFERENCE &&
      item.currency === "EUR" &&
      minor(item.amount, "EUR") === DEPOSIT_AMOUNT_MINOR,
  );
  const account = accounts.filter(
    (item) => item.currency === "EUR" && item.status === "ACTIVE",
  );
  if (
    matches.length !== 1 ||
    account.length !== 1 ||
    accounts.length !== 1 ||
    matches[0].status !== "SETTLED" ||
    matches[0].global_account_id !== account[0].id
  )
    throw new Error(
      "Locked deposit is not uniquely verified in the existing EUR Global Account; no new POST is allowed",
    );
  const balance = snapshot.balances.find((item) => item.currency === "EUR");
  if (
    !balance ||
    balance.available - lock.beforeAvailable !== DEPOSIT_AMOUNT_MINOR
  )
    throw new Error(
      "Locked deposit has no exact EUR wallet delta; no new POST is allowed",
    );
  const fx = snapshot.evidence.find(
    (item) => item.kind === "FX_CONVERSION" && item.status === "SETTLED",
  );
  const transfer = snapshot.evidence.find(
    (item) => item.kind === "TRANSFER" && item.status === "PAID",
  );
  if (!fx?.sellAmount || !transfer)
    throw new Error("Previous campaign actions are not verified");
  const credit = Math.min(
    POLICY.receiptCreditCap,
    new Decimal(DEPOSIT_AMOUNT_MINOR)
      .mul(snapshot.rates.EUR)
      .floor()
      .toNumber(),
  );
  const before = buildPlan(
    snapshot.rates,
    forecast,
    undefined,
    [],
    new Date().toISOString(),
    fx.sellAmount,
  );
  const after = replanAfterDeposit(
    snapshot.rates,
    forecast,
    before,
    credit,
    fx.sellAmount,
  );
  const oldContractor = before.decisions.find(
    (item) => item.id === "contractor",
  )!;
  const newContractor = after.decisions.find(
    (item) => item.id === "contractor",
  )!;
  if (
    oldContractor.action !== "ESCALATE" ||
    newContractor.action !== "CONVERT_AND_PAY" ||
    after.reopened.join(",") !== "contractor" ||
    after.remaining < POLICY.reserve
  )
    throw new Error(
      "Locked deposit does not yield the expected reserve-safe replan",
    );
  const proof: DepositProof = {
    verified: true,
    id: matches[0].id,
    status: "SETTLED",
    currency: "EUR",
    amountMinor: DEPOSIT_AMOUNT_MINOR,
    statementRef: DEPOSIT_STATEMENT_REF,
    beforeAvailable: lock.beforeAvailable,
    afterAvailable: balance.available,
    delta: balance.available - lock.beforeAvailable,
    credit,
    verifiedAt: new Date().toISOString(),
    planBefore: {
      contractor: oldContractor.action,
      remaining: before.remaining,
    },
    planAfter: {
      contractor: newContractor.action,
      remaining: after.remaining,
      reopened: after.reopened,
      unchanged: after.unchanged,
    },
  };
  await writeFile(PROOF_PATH, JSON.stringify(proof, null, 2) + "\n", {
    flag: "w",
  });
  return proof;
}
