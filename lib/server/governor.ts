import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  authority,
  calculatePlan,
  cashPlacement,
  contextFingerprint,
  defaultPolicy,
  incidentDecision,
  nextStep,
  reconcile,
  syntheticContext,
} from "../governor/engine";
import type { GovernorState, GovernorView } from "../governor/types";
import type { AuditEvent, Snapshot } from "../types";
import { updateForecast } from "../treasury";
import {
  admitDemoWork,
  assertWorldCapacity,
  DemoLimit,
  WORLD_LIMITS,
} from "./demo-limits";
import { interpretEvidence } from "./ai";
import { readSnapshot } from "./airwallex";
import {
  approveProposal,
  executeApproved,
  prepareProposal,
  fingerprint,
} from "./authorization";
import {
  loadWorld,
  persistenceMode,
  saveWorld,
  StateConflict,
} from "./governor-store";

export const GovernorCommand = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("observe"), revision: z.number().int() }).strict(),
  z
    .object({ tool: z.literal("run_cycle"), revision: z.number().int() })
    .strict(),
  z
    .object({
      tool: z.literal("interpret_context"),
      revision: z.number().int(),
      text: z.string().min(10).max(6000),
    })
    .strict(),
  z
    .object({
      tool: z.literal("accept_context"),
      revision: z.number().int(),
      contextId: z.string().uuid(),
    })
    .strict(),
  z
    .object({ tool: z.literal("allocate_receipt"), revision: z.number().int() })
    .strict(),
  z
    .object({
      tool: z.literal("open_incident"),
      revision: z.number().int(),
      complaint: z.string().min(10).max(1500),
    })
    .strict(),
  z
    .object({
      tool: z.literal("escalate_incident"),
      revision: z.number().int(),
      incidentId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      tool: z.literal("request_human_approval"),
      revision: z.number().int(),
    })
    .strict(),
  z
    .object({
      tool: z.literal("approve_action"),
      revision: z.number().int(),
      approvalId: z.string().uuid(),
      confirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      tool: z.literal("execute_action"),
      revision: z.number().int(),
      approvalId: z.string().uuid(),
    })
    .strict(),
]);
export type Command = z.infer<typeof GovernorCommand>;
function event(
  s: GovernorState,
  actor: AuditEvent["actor"],
  title: string,
  detail: string,
  at = new Date().toISOString(),
) {
  const intent = /APPROVAL|ACTION/.test(title)
    ? (s.approvals.find((a) => detail.includes(a.id)) ?? s.approvals.at(-1))
    : undefined;
  const operation = /ACTION|DEPOSIT/.test(title)
    ? intent
      ? s.operations.find((o) => o.requestId === intent.requestId)
      : s.operations.at(-1)
    : undefined;
  const e: AuditEvent = {
    id: randomUUID(),
    at,
    actor,
    title,
    detail,
    correlation: {
      workspaceId: s.id,
      contextVersion: s.contextVersion,
      planId: s.plans.at(-1)?.id,
      approvalId: intent?.id,
      actionId: intent?.requestId ?? operation?.id,
      requestId: intent?.requestId ?? operation?.requestId,
      providerResourceId: operation?.resourceId,
      reconciliationIds:
        title === "RECONCILIATION_CHECKED"
          ? s.reconciliations.map((r) => r.id)
          : undefined,
      incidentId: /INCIDENT/.test(title) ? s.incidents.at(-1)?.id : undefined,
    },
  };
  s.events.push(e);
}
function logCommittedEvents(s: GovernorState, previousEventCount = 0) {
  for (const e of s.events.slice(previousEventCount))
    console.info(
      JSON.stringify({
        event: e.title,
        audit_event_id: e.id,
        at: e.at,
        ...e.correlation,
      }),
    );
}
function importOperations(s: GovernorState) {
  const observedAt = s.snapshot.fetchedAt;
  for (const evidence of s.snapshot.evidence) {
    const prior = s.operations.find((o) => o.requestId === evidence.requestId);
    if (prior) {
      prior.status = evidence.status;
      prior.observedAt = observedAt;
    } else {
      s.operations.push({
        id: evidence.requestId,
        requestId: evidence.requestId,
        kind: evidence.kind,
        resourceId: evidence.id,
        status: evidence.status,
        observedAt,
        provenance: s.approvals.some(
          (a) => a.requestId === evidence.requestId && a.status === "EXECUTED",
        )
          ? "GOVERNOR_V2"
          : "PRE_EXISTING_V1",
      });
      event(
        s,
        "AIRWALLEX",
        "HISTORICAL_ACTION_VERIFIED",
        `${evidence.kind} ${evidence.status}; original campaign action read back, never re-executed.`,
        observedAt,
      );
    }
  }
  if (
    s.snapshot.deposit.state === "RECEIVED" &&
    !s.operations.some((o) => o.kind === "DEPOSIT")
  ) {
    s.operations.push({
      id: "TPKIT1-2026-ONE",
      requestId: "statement_ref:TPKIT1-2026-ONE",
      kind: "DEPOSIT",
      resourceId: s.snapshot.deposit.id,
      status: "SETTLED",
      provenance: "PRE_EXISTING_V1",
      observedAt,
    });
    event(
      s,
      "AIRWALLEX",
      "HISTORICAL_DEPOSIT_VERIFIED",
      "Original EUR 8,000 Sandbox receipt and its historical exact wallet delta verified; no simulation repeated.",
    );
  }
}
function replan(s: GovernorState, cause: string) {
  const version = fingerprint({
    financial: contextFingerprint(s.snapshot, s.forecast, s.policy),
    receiptApplied: s.receiptApplied,
  });
  const prior = s.plans.at(-1);
  if (prior && version === s.contextVersion) return;
  const previousVersion = s.contextVersion;
  s.contextVersion = version;
  const plan = calculatePlan(
    s.snapshot,
    s.forecast,
    prior?.plan,
    new Date().toISOString(),
    s.receiptApplied,
  );
  const tier = authority(s.policy, s.forecast.confidence);
  if (plan.autonomy !== tier.fx || plan.reserve !== s.policy.reserve)
    throw new Error("Planner and execution policy disagree");
  if (plan.remaining < s.policy.reserve)
    throw new Error("Reserve invariant failed; no action is permitted");
  if (prior) {
    prior.state = "SUPERSEDED";
    event(
      s,
      "TREASURY_ENGINE",
      "PLAN_SUPERSEDED",
      `${prior.id}; ${plan.reopened.length} decisions reopened, ${plan.unchanged.length} identities retained.`,
    );
  }
  for (const approval of s.approvals)
    if (
      ["PENDING", "APPROVED"].includes(approval.status) &&
      approval.contextVersion !== version
    ) {
      approval.status = "INVALIDATED";
      event(
        s,
        "POLICY_ENGINE",
        "APPROVAL_INVALIDATED",
        `${approval.id}; material context changed from ${previousVersion.slice(0, 12)}.`,
      );
    }
  const id = `plan-${String(s.plans.length + 1).padStart(3, "0")}`;
  s.plans.push({
    id,
    contextVersion: version,
    createdAt: new Date().toISOString(),
    state: "CURRENT",
    cause,
    plan,
  });
  s.placement = cashPlacement(s.snapshot, plan);
  if (!s.placement.conserved || s.placement.reserveAfter < s.policy.reserve)
    throw new Error("Cash placement violates conservation or reserve");
  event(
    s,
    "POLICY_ENGINE",
    "POLICY_CHECKED",
    `Confidence ${Math.round(s.forecast.confidence * 100)}%; authority USD ${tier.fx / 100}; reserve protected.`,
  );
  event(
    s,
    "TREASURY_ENGINE",
    "PLAN_RECALCULATED",
    `${id}; ${plan.reopened.length} reopened, ${plan.unchanged.length} unchanged; remaining reserve USD ${plan.remaining / 100}.`,
  );
}
function normalizeContext(s: GovernorState) {
  const due = (hours: number) =>
    new Date(Date.parse(s.createdAt) + hours * 3600000).toISOString();
  const lateCosts: Record<string, number> = {
    logistics: 70000,
    cloud: 30000,
    contractor: 7500,
    insurance: 50000,
    marketing: 0,
  };
  s.obligations = syntheticContext.obligations().map((o) => ({
    id: o.id,
    vendor: o.title,
    amount: o.amount,
    currency: o.currency,
    dueAt: due(o.dueHours),
    priority: o.priority,
    criticality:
      o.priority === "CRITICAL"
        ? "OPERATIONS_STOP"
        : o.priority === "LOW"
          ? "DISCRETIONARY"
          : "CONTRACTUAL",
    lateCostPerDay: lateCosts[o.id],
    transferMethod: o.currency === "GBP" ? "SWIFT" : "LOCAL",
    beneficiaryStatus: s.snapshot.beneficiaries.some(
      (b) => b.currency === o.currency,
    )
      ? "EXISTING_CORRIDOR"
      : "REVIEW_REQUIRED",
    status:
      o.id === "logistics" &&
      s.snapshot.evidence.some(
        (e) => e.kind === "TRANSFER" && e.status === "PAID",
      )
        ? "PAID_SANDBOX"
        : "PLANNED",
    source: "SYNTHETIC",
  }));
  s.receivables = [
    {
      id: "INV-4092",
      amount: s.forecast.amount,
      currency: "USD",
      expectedAt: due(s.forecast.dueHours),
      confidence: s.forecast.confidence,
      evidenceIds: s.contexts.filter((c) => c.acceptedAt).map((c) => c.id),
      state: s.forecast.delayed ? "DELAYED" : "EXPECTED",
      source: "SYNTHETIC",
    },
  ];
  if (s.snapshot.deposit.state === "RECEIVED")
    s.receivables.push({
      id: "sandbox-customer-receipt",
      amount: s.snapshot.deposit.amount,
      currency: "EUR",
      expectedAt: s.snapshot.deposit.receivedAt ?? s.snapshot.fetchedAt,
      confidence: 1,
      evidenceIds: [s.snapshot.deposit.id ?? ""],
      state: "SETTLED_SANDBOX",
      source: "AIRWALLEX",
    });
}
function reconciliation(s: GovernorState) {
  s.reconciliations = reconcile(s.snapshot);
  for (const incident of s.incidents) {
    const status =
      s.snapshot.evidence.find(
        (e) => e.kind === "TRANSFER" && e.requestId === incident.actionId,
      )?.status ?? "UNKNOWN";
    if (incident.providerStatus !== status)
      incident.history.push({
        at: s.snapshot.fetchedAt,
        status,
        source: "AIRWALLEX",
      });
    incident.providerStatus = status;
    if (incident.state !== "ESCALATED")
      Object.assign(incident, incidentDecision(status));
    incident.updatedAt = s.snapshot.fetchedAt;
  }
  event(
    s,
    "TREASURY_ENGINE",
    "RECONCILIATION_CHECKED",
    `${s.reconciliations.filter((r) => r.status === "MATCHED").length} matched; ${s.reconciliations.filter((r) => r.status === "MISMATCH").length} exceptions; ${s.reconciliations.filter((r) => r.status === "PENDING").length} pending.`,
  );
}
export function initializeWorld(id: string, snapshot: Snapshot): GovernorState {
  const s: GovernorState = {
    schema: 2,
    id,
    revision: 1,
    createdAt: snapshot.fetchedAt,
    updatedAt: snapshot.fetchedAt,
    contextVersion: "",
    snapshot,
    forecast: syntheticContext.forecast(),
    obligations: [],
    receivables: [],
    receiptApplied: false,
    policy: structuredClone(defaultPolicy),
    plans: [],
    contexts: [],
    approvals: [],
    operations: [],
    reconciliations: [],
    incidents: [],
    events: [],
    placement: {
      positions: [],
      proposals: [],
      conserved: true,
      reserveAfter: 0,
      reason: "Not evaluated",
    },
    nextStep: "OBSERVE",
  };
  event(
    s,
    "AIRWALLEX",
    "BALANCES_OBSERVED",
    "Live Sandbox wallet, rates, Global Account and beneficiary corridors observed.",
  );
  importOperations(s);
  normalizeContext(s);
  replan(
    s,
    "Initial operating allocation; historical receipt awaits explicit allocation.",
  );
  reconciliation(s);
  s.nextStep = nextStep(s);
  return s;
}
export function governorView(s: GovernorState): GovernorView {
  return {
    ...s,
    approvals: s.approvals.map(
      ({ sealedProposal: _p, sealedApproval: _a, ...view }) => {
        void _p;
        void _a;
        return view;
      },
    ),
    persistence: persistenceMode(),
  };
}
export async function getWorld(id: string) {
  const stored = await loadWorld(id);
  if (stored) {
    if (!stored.state.obligations || !stored.state.receivables) {
      const migrated = structuredClone(stored.state);
      normalizeContext(migrated);
      migrated.revision++;
      await saveWorld(migrated, stored);
      return migrated;
    }
    return stored.state;
  }
  await admitDemoWork("workspace");
  const s = initializeWorld(id, await readSnapshot());
  await saveWorld(s);
  logCommittedEvents(s);
  return s;
}
export async function runTool(
  id: string,
  command: Command,
): Promise<GovernorState> {
  const stored = await loadWorld(id);
  if (!stored || stored.state.revision !== command.revision)
    throw new StateConflict();
  // Leave capacity for action readback/uncertainty and bounded reconciliation.
  assertWorldCapacity(stored.state, stored.state.executionLock ? 1 : 20);
  if (
    command.tool === "interpret_context" &&
    stored.state.contexts.length >= WORLD_LIMITS.contexts
  )
    throw new DemoLimit(
      "This workspace already holds the maximum reviewed contexts. Export evidence before starting a fresh planning context.",
    );
  if (
    command.tool === "request_human_approval" &&
    stored.state.approvals.length >= WORLD_LIMITS.approvals
  )
    throw new DemoLimit(
      "This workspace has reached its approval record limit.",
    );
  if (stored.state.executionLock && command.tool !== "run_cycle")
    throw new Error(
      "A financial action is in flight or uncertain. Reconcile its original identity before changing context.",
    );
  const s = structuredClone(stored.state);
  if (
    ["observe", "run_cycle", "allocate_receipt", "open_incident"].includes(
      command.tool,
    )
  ) {
    s.snapshot = await readSnapshot();
    event(
      s,
      "AIRWALLEX",
      "BALANCES_REFRESHED",
      "Fresh provider reads; no financial mutation.",
    );
    importOperations(s);
    if (s.executionLock) {
      const observed = s.snapshot.evidence.find(
        (e) =>
          e.requestId === s.executionLock &&
          ["SETTLED", "PAID"].includes(e.status),
      );
      const matched = reconcile(s.snapshot).some(
        (r) => r.actionId === s.executionLock && r.status === "MATCHED",
      );
      if (observed && matched) {
        const intent = s.approvals.find((a) => a.requestId === s.executionLock);
        if (intent) intent.status = "EXECUTED";
        s.executionLock = undefined;
        event(
          s,
          "AIRWALLEX",
          "UNCERTAIN_ACTION_RECONCILED",
          "Original claimed action is terminal in provider readback; context updates may resume.",
        );
      }
    }
  }
  if (command.tool === "interpret_context") {
    const interpretation = await interpretEvidence(command.text);
    s.contexts.push({ id: randomUUID(), text: command.text, interpretation });
    event(
      s,
      "AGENT",
      "CONTEXT_INTERPRETED",
      `${interpretation.provider}; ${interpretation.summary} Facts require review before changing policy context.`,
    );
  }
  if (command.tool === "accept_context") {
    const candidate = s.contexts.find((c) => c.id === command.contextId);
    if (
      !candidate ||
      candidate.interpretation.rejectedInstructions ||
      candidate.interpretation.forecastDelayDays === null
    )
      throw new Error("No reviewed supported receipt evidence is available");
    if (!candidate.acceptedAt) {
      candidate.acceptedAt = new Date().toISOString();
      s.forecast = updateForecast(
        s.forecast,
        candidate.interpretation.forecastDelayDays,
      );
      event(
        s,
        "USER",
        "CONTEXT_ACCEPTED",
        `Reviewed ${candidate.interpretation.forecastDelayDays}-day delay; deterministic confidence and authority will change.`,
      );
    }
  }
  if (command.tool === "allocate_receipt" && !s.receiptApplied) {
    if (
      s.snapshot.deposit.state !== "RECEIVED" ||
      s.snapshot.deposit.status !== "SETTLED" ||
      !s.snapshot.deposit.credit
    )
      throw new Error("No provider-verified settled receipt is available");
    s.receiptApplied = true;
    event(
      s,
      "USER",
      "RECEIPT_AUTHORITY_ALLOCATED",
      "Previously settled Sandbox receipt assigned to this operating plan once. No new deposit POST.",
    );
  }
  // Observation can reconcile an in-flight action, but cannot replace its authorization context.
  if (!s.executionLock) replan(s, command.tool);
  normalizeContext(s);
  if (
    ["observe", "run_cycle", "allocate_receipt", "open_incident"].includes(
      command.tool,
    )
  )
    reconciliation(s);
  if (command.tool === "open_incident") {
    const transfer = s.snapshot.evidence.find((e) => e.kind === "TRANSFER");
    if (!transfer)
      throw new Error("No original provider transfer to investigate");
    const existing = s.incidents.find(
      (i) => i.actionId === transfer.requestId && i.state !== "RESOLVED",
    );
    if (!existing) {
      const at = new Date().toISOString();
      s.incidents.push({
        id: randomUUID(),
        actionId: transfer.requestId,
        complaint: command.complaint,
        openedAt: at,
        updatedAt: at,
        state: "OPEN",
        providerStatus: transfer.status,
        ...incidentDecision(transfer.status),
        history: [
          {
            at: s.snapshot.fetchedAt,
            status: transfer.status,
            source: "AIRWALLEX",
          },
        ],
      });
      event(
        s,
        "AGENT",
        "INCIDENT_OPENED",
        "Supplier receipt complaint recorded; original payment investigated, replacement blocked.",
      );
    }
  }
  if (command.tool === "escalate_incident") {
    const incident = s.incidents.find((i) => i.id === command.incidentId);
    if (!incident) throw new Error("Incident not found");
    incident.state = "ESCALATED";
    incident.decision = "ESCALATE";
    incident.replacementAllowed = false;
    incident.updatedAt = new Date().toISOString();
    event(
      s,
      "USER",
      "INCIDENT_ESCALATED",
      "Manual investigation required; no replacement payment authorized.",
    );
  }
  if (command.tool === "request_human_approval") {
    const operation = s.snapshot.evidence.some(
      (e) => e.kind === "FX_CONVERSION",
    )
      ? "TRANSFER"
      : "CONVERT";
    const proposal = await prepareProposal(
      operation,
      s.forecast,
      s.contextVersion,
    );
    const now = new Date().toISOString();
    s.approvals.push({
      id: randomUUID(),
      actionType: operation,
      obligation: "logistics",
      planId: s.plans.at(-1)!.id,
      contextVersion: s.contextVersion,
      fingerprint: proposal.fingerprint,
      amount: proposal.quote.buyAmount,
      currency: "EUR",
      counterparty: proposal.beneficiary,
      quoteId: proposal.quote.id,
      quoteExpiresAt: proposal.quote.validUntil,
      requestId: proposal.requestId,
      reserveAfter: proposal.reserveAfter,
      createdAt: now,
      expiresAt: new Date(
        Math.min(Date.now() + 300000, Date.parse(proposal.quote.validUntil)),
      ).toISOString(),
      status: "PENDING",
      sealedProposal: proposal.token,
    });
    event(
      s,
      "POLICY_ENGINE",
      "APPROVAL_REQUESTED",
      "Exact supplier action, quote and current context recorded; no generic treasury grant.",
    );
  }
  if (command.tool === "approve_action" || command.tool === "execute_action") {
    const intent = s.approvals.find((a) => a.id === command.approvalId);
    if (
      !intent ||
      intent.contextVersion !== s.contextVersion ||
      intent.planId !== s.plans.at(-1)?.id ||
      Date.parse(intent.expiresAt) <= Date.now()
    )
      throw new Error(
        "Approval expired or context changed. Request a fresh exact action.",
      );
    if (command.tool === "approve_action") {
      if (intent.status !== "PENDING")
        throw new Error("Approval is not pending");
      intent.sealedApproval = approveProposal(
        intent.sealedProposal,
        intent.fingerprint,
        true,
        s.contextVersion,
      );
      intent.status = "APPROVED";
      event(
        s,
        "USER",
        "EXACT_ACTION_APPROVED",
        `${intent.id}; only ${intent.actionType} EUR ${intent.amount / 100}, ${intent.counterparty}.`,
      );
    } else {
      if (intent.status !== "APPROVED" || !intent.sealedApproval)
        throw new Error("Exact approval required");
      // Claim the revision before the external write. A concurrent evidence update prevents execution.
      s.revision++;
      s.updatedAt = new Date().toISOString();
      s.executionLock = intent.requestId;
      await saveWorld(s, stored);
      const approved = await loadWorld(id);
      if (
        !approved ||
        approved.state.revision !== s.revision ||
        approved.state.contextVersion !== intent.contextVersion
      )
        throw new StateConflict();
      try {
        await executeApproved(intent.sealedApproval, s.contextVersion);
        intent.status = "EXECUTED";
        s.snapshot = await readSnapshot();
        importOperations(s);
        reconciliation(s);
        replan(s, "Financial action read back");
        if (
          s.snapshot.evidence.some(
            (e) =>
              e.requestId === intent.requestId &&
              ["SETTLED", "PAID"].includes(e.status),
          )
        )
          s.executionLock = undefined;
        event(
          s,
          "AIRWALLEX",
          "ACTION_VERIFIED",
          "Provider resource and post-action financial context reconciled.",
        );
      } catch {
        event(
          s,
          "AIRWALLEX",
          "ACTION_UNCERTAIN",
          "Action response or readback uncertain. Refresh and reconcile the original request ID before any retry.",
        );
      }
      s.revision++;
      s.nextStep = nextStep(s);
      await saveWorld(s, approved);
      logCommittedEvents(s, stored.state.events.length);
      return s;
    }
  }
  s.revision++;
  s.updatedAt = new Date().toISOString();
  s.nextStep = nextStep(s);
  await saveWorld(s, stored);
  logCommittedEvents(s, stored.state.events.length);
  return s;
}
