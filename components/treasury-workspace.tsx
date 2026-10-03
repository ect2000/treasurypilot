"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, useReducedMotion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileText,
  Fingerprint,
  Gauge,
  Landmark,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { Brand, SandboxBadge } from "./brand";
import { Inspector } from "./ui/dialog";
import {
  buildPlan,
  initialForecast,
  POLICY,
  reserveCheck,
} from "@/lib/treasury";
import { currencies, formatMoney, minor } from "@/lib/money";
import type {
  AuditEvent,
  Decision,
  Forecast,
  Interpretation,
  Obligation,
  Plan,
  Snapshot,
} from "@/lib/types";
import type { Proposal } from "@/lib/server/authorization";
const tabs = [
  { id: "overview", title: "Treasury overview", icon: Layers3 },
  { id: "obligations", title: "Obligations", icon: FileText },
  { id: "evidence", title: "Evidence inbox", icon: ArrowDownLeft },
  { id: "audit", title: "Activity & audit", icon: Workflow },
] as const;
type Tab = (typeof tabs)[number]["id"];
async function api<T>(path: string, payload?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: payload === undefined ? "GET" : "POST",
    headers:
      payload === undefined ? {} : { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result;
}
const evidenceSchema = z.object({
  text: z
    .string()
    .min(10, "Add at least 10 characters of evidence.")
    .max(6000, "Keep the document under 6,000 characters."),
});
const delayEmail =
  "From: Customer finance team\nSubject: Updated payment timing\n\nThe expected USD 20,000 payment is delayed by 5 days. We will send it next week. Please update your cash forecast.";
function evaluate(
  live: Snapshot,
  forecast: Forecast,
  previous?: Plan,
  custom: Obligation[] = [],
) {
  return buildPlan(
    live.rates,
    forecast,
    previous,
    custom,
    new Date().toISOString(),
    live.evidence.find((e) => e.kind === "FX_CONVERSION")?.sellAmount,
  );
}
function actionLabel(action: Decision["action"]) {
  return {
    PAY_NOW: "Pay now",
    CONVERT_AND_PAY: "Convert + pay",
    DEFER: "Defer",
    ESCALATE: "Escalate",
  }[action];
}
function ActionBadge({ decision }: { decision: Decision }) {
  return (
    <span className={`action-badge action-${decision.action.toLowerCase()}`}>
      {decision.action === "CONVERT_AND_PAY" ? (
        <ArrowUpRight size={12} />
      ) : decision.action === "PAY_NOW" ? (
        <Check size={12} />
      ) : decision.action === "DEFER" ? (
        <Clock3 size={12} />
      ) : (
        <CircleHelp size={12} />
      )}{" "}
      {actionLabel(decision.action)}
    </span>
  );
}
export function TreasuryWorkspace() {
  const reduced = useReducedMotion();
  const [tab, setTab] = useState<Tab>("overview");
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [plan, setPlan] = useState<Plan>();
  const [forecast, setForecast] = useState<Forecast>(initialForecast);
  const [custom, setCustom] = useState<Obligation[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [blocked, setBlocked] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [interpretation, setInterpretation] = useState<Interpretation>();
  const [proposal, setProposal] = useState<Proposal>();
  const [approval, setApproval] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  const currentPlan = useRef<Plan | undefined>(undefined);
  const form = useForm<z.infer<typeof evidenceSchema>>({
    resolver: zodResolver(evidenceSchema),
    defaultValues: { text: delayEmail },
  });
  function record(actor: AuditEvent["actor"], title: string, detail: string) {
    const event: AuditEvent = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actor,
      title,
      detail,
    };
    setEvents((previous) => {
      const next = [event, ...previous].slice(0, 150);
      localStorage.setItem("tp_audit_v1", JSON.stringify(next));
      return next;
    });
  }
  function clearAuthorization() {
    setProposal(undefined);
    setApproval(undefined);
    setConfirmed(false);
  }
  async function task(label: string, run: () => Promise<void>) {
    setBusy(label);
    setError(undefined);
    try {
      await run();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(undefined);
    }
  }
  async function refresh() {
    await task("Refreshing live state", async () => {
      const live = await api<Snapshot>("snapshot");
      setSnapshot(live);
      clearAuthorization();
      record(
        "AIRWALLEX",
        "Live wallet refreshed",
        `Read ${live.balances.length} balances, ${live.globalAccounts.length} Global Account and ${live.beneficiaries.length} beneficiary corridors through Sandbox REST.`,
      );
      if (currentPlan.current) {
        const next = evaluate(live, forecast, currentPlan.current, custom);
        currentPlan.current = next;
        setPlan(next);
        record(
          "TREASURY_ENGINE",
          "Rates reconciled with plan",
          `${next.reopened.length} decisions reopened; ${next.unchanged.length} preserved. Live wallet remains separate from the policy allocation.`,
        );
      }
    });
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      api<Snapshot>("snapshot"),
      api<{ forecast: Forecast }>("session"),
    ])
      .then(([live, session]) => {
        if (!active) return;
        setSnapshot(live);
        setForecast(session.forecast);
        try {
          const stored = JSON.parse(
            localStorage.getItem("tp_audit_v1") ?? "[]",
          );
          if (Array.isArray(stored)) setEvents(stored.slice(0, 150));
        } catch {
          /* Local history is optional. */
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  function createPlan() {
    if (!snapshot) return;
    const next = evaluate(snapshot, forecast, currentPlan.current, custom);
    currentPlan.current = next;
    setPlan(next);
    clearAuthorization();
    record(
      "USER",
      "Treasury plan requested",
      "Five clearly labelled synthetic obligations within a 72-hour horizon.",
    );
    record(
      "TREASURY_ENGINE",
      "Deterministic plan evaluated",
      `${next.decisions.length} obligations ranked. ${formatMoney(next.remaining)} remains in the authorized allocation. Forecast cash is excluded from execution authority.`,
    );
    record(
      "POLICY_ENGINE",
      "Reserve and autonomy evaluated",
      `${formatMoney(POLICY.reserve)} minimum reserve. ${formatMoney(next.autonomy)} current autonomy limit.`,
    );
  }
  async function changeForecast(delayDays: number) {
    await task("Updating forecast", async () => {
      const session = await api<{ forecast: Forecast }>("forecast", {
        delayDays,
      });
      setForecast(session.forecast);
      clearAuthorization();
      record(
        "USER",
        "Forecast evidence accepted",
        `Reported delay: ${delayDays} days. All previous approvals invalidated.`,
      );
      const next = snapshot
        ? evaluate(snapshot, session.forecast, currentPlan.current, custom)
        : undefined;
      if (next) {
        currentPlan.current = next;
        setPlan(next);
        record(
          "POLICY_ENGINE",
          "Autonomy recalculated",
          `Confidence ${Math.round(session.forecast.confidence * 100)}%; limit ${formatMoney(next.autonomy)}. The reserve floor remains ${formatMoney(POLICY.reserve)}.`,
        );
        record(
          "TREASURY_ENGINE",
          "Incremental replan completed",
          `${next.reopened.length} reopened (${next.reopened.join(", ") || "none"}); ${next.unchanged.length} unchanged. Evaluation identities preserved for unchanged decisions.`,
        );
      }
    });
  }
  async function interpret(data: z.infer<typeof evidenceSchema>) {
    await task("Interpreting evidence", async () => {
      record(
        "USER",
        "Document submitted for interpretation",
        "Untrusted document submitted. No account data, credentials or beneficiary identifiers sent to the model.",
      );
      const parsed = await api<Interpretation>("interpret", data);
      setInterpretation(parsed);
      record(
        "AGENT",
        "Evidence candidate returned",
        `${parsed.provider} · ${parsed.model}. ${parsed.summary}${parsed.rejectedInstructions ? " Instruction attempt flagged; no policy changes accepted." : ""}`,
      );
    });
  }
  function addInvoice() {
    const invoice = interpretation?.invoice;
    if (!invoice || interpretation?.rejectedInstructions || !snapshot) return;
    const obligation: Obligation = {
      id: `invoice-${crypto.randomUUID()}`,
      title: invoice.title,
      category: "Imported evidence · synthetic scenario only",
      amount: minor(invoice.amountMajor, invoice.currency),
      currency: invoice.currency,
      dueHours: invoice.dueHours,
      priority: "MEDIUM",
      synthetic: true,
    };
    const nextCustom = [...custom, obligation];
    setCustom(nextCustom);
    const next = evaluate(snapshot, forecast, currentPlan.current, nextCustom);
    currentPlan.current = next;
    setPlan(next);
    clearAuthorization();
    record(
      "USER",
      "Invoice candidate accepted into plan",
      `${invoice.currency} ${invoice.amountMajor}, due ${invoice.dueHours} hours. Planning only; imported invoices cannot execute through the fixed supplier campaign.`,
    );
    setTab("obligations");
  }
  async function prepare() {
    await task("Requesting real Sandbox proposal", async () => {
      const operation = snapshot?.evidence.some(
        (e) => e.kind === "FX_CONVERSION",
      )
        ? "TRANSFER"
        : "CONVERT";
      const next = await api<Proposal>("proposal", { operation });
      setProposal(next);
      setApproval(undefined);
      setConfirmed(false);
      record(
        "AIRWALLEX",
        operation === "CONVERT"
          ? "Guaranteed FX quote received"
          : "Supplier transfer validated",
        `${next.quote.buyCurrency} ${formatMoney(next.quote.buyAmount, next.quote.buyCurrency)} funded by ${formatMoney(next.cost)}. Proposal bound to current financial state.`,
      );
      record(
        "POLICY_ENGINE",
        "Execution proposal passed reserve check",
        `Resulting reserve ${formatMoney(next.reserveAfter)}. Exact fingerprint ${next.fingerprint}. Human approval required.`,
      );
    });
  }
  async function approve() {
    if (!proposal || !confirmed) return;
    await task("Binding exact approval", async () => {
      const result = await api<{ approval: string }>("approve", {
        token: proposal.token,
        fingerprint: proposal.fingerprint,
        confirmed,
      });
      setApproval(result.approval);
      record(
        "USER",
        "Exact Sandbox action approved",
        `${proposal.operation} · fingerprint ${proposal.fingerprint}. Approval expires within five minutes and is invalidated by financial state changes.`,
      );
    });
  }
  async function execute() {
    if (!approval) return;
    await task("Executing approved Sandbox action", async () => {
      const result = await api<{ evidence: Snapshot["evidence"][number] }>(
        "execute",
        { approval },
      );
      record(
        "AIRWALLEX",
        "Real Sandbox action accepted",
        `${result.evidence.kind} · ${result.evidence.id} · ${result.evidence.status} · stable request_id ${result.evidence.requestId}`,
      );
      const fresh = await api<Snapshot>("snapshot");
      setSnapshot(fresh);
      clearAuthorization();
      record(
        "AIRWALLEX",
        "Financial evidence verified",
        `Fresh API reads confirm ${fresh.evidence.length} campaign operations. No new financial request IDs generated.`,
      );
    });
  }
  async function transition(nextStatus: "SENT" | "PAID") {
    await task("Simulating transfer transition", async () => {
      const result = await api<{ evidence: Snapshot["evidence"][number] }>(
        "transition",
        { nextStatus, confirmed: true },
      );
      record(
        "AIRWALLEX",
        "Sandbox transfer status simulated",
        `Simulation API requested ${nextStatus}; GET transfer verified ${result.evidence.status}. This is a provider Sandbox simulation.`,
      );
      setSnapshot(await api<Snapshot>("snapshot"));
      clearAuthorization();
    });
  }
  function exportAudit() {
    const data = {
      project: "TreasuryPilot",
      environment: "SANDBOX",
      exportedAt: new Date().toISOString(),
      source: snapshot?.source,
      financialEvidence: snapshot?.evidence,
      plan,
      audit: events,
      disclosure:
        "Synthetic obligations; live API balances and financial evidence. Local audit history is not a durable accounting ledger.",
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "treasurypilot-sandbox-audit.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  const decision = plan?.decisions.find((d) => d.id === selected);
  const converted = snapshot?.evidence.find((e) => e.kind === "FX_CONVERSION");
  const transferred = snapshot?.evidence.find((e) => e.kind === "TRANSFER");
  const allocation = plan?.allocation ?? POLICY.allocation;
  return (
    <div className="workspace">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <Link href="/" aria-label="TreasuryPilot home">
          <Brand small />
        </Link>
        <button
          className="icon-button mobile-close"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        >
          <X size={19} />
        </button>
        <div className="workspace-label">
          <span className="workspace-avatar">SB</span>
          <div>
            Sandbox Business<small>Airwallex · test environment</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => {
                setTab(t.id);
                setMobileMenu(false);
              }}
            >
              <t.icon size={17} />
              {t.title}
              {t.id === "evidence" && <span className="nav-count">1</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-policy">
          <ShieldCheck size={18} />
          <div>
            Policy protected<small>$15,000 reserve floor</small>
          </div>
        </div>
        <div className="sidebar-bottom">
          <SandboxBadge />
          <span>
            Independent hackathon project
            <br />
            No real money
          </span>
          <a
            href="https://github.com/ect2000/treasurypilot"
            target="_blank"
            rel="noreferrer"
          >
            View source <ArrowUpRight size={13} />
          </a>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="app-topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={19} />
            </button>
            <span>TreasuryPilot</span>
            <ChevronRight size={13} />
            <strong>{tabs.find((t) => t.id === tab)?.title}</strong>
          </div>
          <div>
            <span
              className={`connection ${snapshot ? "" : "connection-pending"}`}
            >
              <span />
              {snapshot ? "Airwallex connected" : "Connecting to Sandbox"}
            </span>
            <SandboxBadge />
          </div>
        </header>
        <main className="main-workspace">
          <div className="page-heading">
            <div>
              <div className="eyebrow small">YOUR NEXT 72 HOURS</div>
              <h1>
                {tab === "overview"
                  ? "Treasury, under control."
                  : tabs.find((t) => t.id === tab)?.title}
              </h1>
              <p>
                {tab === "overview"
                  ? "Know what to move. Know what to protect."
                  : tab === "evidence"
                    ? "Understand the evidence before it changes the plan."
                    : tab === "audit"
                      ? "A clear record of every decision and real Sandbox action."
                      : "Five obligations. A deliberate order of operations."}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="button secondary"
                onClick={refresh}
                disabled={!!busy}
              >
                <RefreshCw size={15} />
                Refresh
              </button>
              <button
                className="button primary"
                onClick={createPlan}
                disabled={!snapshot || !!busy}
              >
                <Sparkles size={16} />
                {plan ? "Re-evaluate plan" : "Build treasury plan"}
              </button>
            </div>
          </div>
          {error && (
            <div className="notice error" role="alert">
              <CircleHelp size={17} />
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError(undefined)}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {busy && (
            <div className="busy-status" role="status">
              <LoaderCircle size={14} className="spin" />
              {busy}…
            </div>
          )}
          {!snapshot && !error && (
            <div className="loading-state">
              <LoaderCircle className="spin" size={23} />
              <h2>Reading your Sandbox.</h2>
              <p>
                Authenticating once, then fetching balances, rates and existing
                beneficiaries.
              </p>
            </div>
          )}
          {(tab === "overview" || tab === "obligations") && (
            <>
              <section
                className="kpi-band"
                aria-label="Treasury policy metrics"
              >
                <div>
                  <span>
                    Authorized allocation <CircleHelp size={12} />
                  </span>
                  <strong>{formatMoney(allocation, "USD", true)}</strong>
                  <small>Explicit policy envelope</small>
                </div>
                <div>
                  <span>
                    Protected reserve <LockKeyhole size={12} />
                  </span>
                  <strong>{formatMoney(POLICY.reserve, "USD", true)}</strong>
                  <small>Deterministic minimum floor</small>
                </div>
                <div>
                  <span>Available to allocate</span>
                  <strong>
                    {formatMoney(allocation - POLICY.reserve, "USD", true)}
                  </strong>
                  <small>Within the policy envelope</small>
                </div>
                <div>
                  <span>
                    Agent autonomy <Gauge size={12} />
                  </span>
                  <strong>
                    {formatMoney(
                      plan?.autonomy ??
                        (forecast.confidence >= 0.85
                          ? minor("10000")
                          : minor("2500")),
                      "USD",
                      true,
                    )}
                  </strong>
                  <small>
                    {Math.round(forecast.confidence * 100)}% forecast confidence
                  </small>
                </div>
              </section>
              <div className="allocation-explainer">
                <ShieldCheck size={15} />
                <span>
                  The agent can allocate <strong>$48,000</strong> of the test
                  wallet. Live Airwallex balances are shown separately below.
                  Forecast cash is never spendable authority.
                </span>
              </div>
              {tab === "overview" && (
                <div className="forecast-layout">
                  <section className="timeline-section">
                    <div className="section-heading">
                      <div>
                        <h2>Liquidity outlook</h2>
                        <span>Authorized allocation · USD equivalent</span>
                      </div>
                      <span className="quiet-label">72-HOUR HORIZON</span>
                    </div>
                    <div className="chart-legend">
                      <span>
                        <i className="legend-cash" />
                        Committed plan
                      </span>
                      <span>
                        <i className="legend-forecast" />
                        Including expected receipt
                      </span>
                      <span>
                        <i className="legend-reserve" />
                        Reserve floor
                      </span>
                    </div>
                    <div className="liquidity-chart">
                      {plan ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={plan.timeline}
                            margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient
                                id="cash-fill"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#ff8555"
                                  stopOpacity={0.14}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#ff8555"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              vertical={false}
                              stroke="#ffffff0d"
                            />
                            <XAxis
                              dataKey="hour"
                              type="number"
                              domain={[0, 72]}
                              ticks={[0, 12, 24, 36, 48, 60, 72]}
                              tickFormatter={(v) =>
                                v === 0 ? "Now" : `+${v}h`
                              }
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#81887f", fontSize: 11 }}
                            />
                            <YAxis
                              domain={[0, 70000]}
                              tickFormatter={(v) => `$${v / 1000}k`}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#81887f", fontSize: 11 }}
                              width={42}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "#232823",
                                border: "1px solid #454d44",
                                borderRadius: 8,
                                color: "#f1f1e8",
                              }}
                              formatter={(value) =>
                                `$${Number(value).toLocaleString()}`
                              }
                              labelFormatter={(h) => `+${h} hours`}
                            />
                            <Area
                              name="With expected receipt"
                              type="stepAfter"
                              dataKey="expected"
                              stroke="#7c8874"
                              strokeDasharray="4 5"
                              fill="transparent"
                              isAnimationActive={!reduced}
                            />
                            <Area
                              name="Committed plan"
                              type="stepAfter"
                              dataKey="cash"
                              stroke="#ff8555"
                              strokeWidth={2}
                              fill="url(#cash-fill)"
                              isAnimationActive={!reduced}
                            />
                            <ReferenceLine
                              y={15000}
                              stroke="#b19463"
                              strokeDasharray="3 4"
                              label={{
                                value: "RESERVE",
                                position: "insideBottomRight",
                                fill: "#b19463",
                                fontSize: 10,
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="chart-empty">
                          <Activity size={26} />
                          <p>Build a plan to see the liquidity path.</p>
                          <span>Live rates. Deterministic calculations.</span>
                        </div>
                      )}
                    </div>
                    <div className="timeline-footer">
                      <span>Ending committed allocation</span>
                      <strong>
                        {plan
                          ? formatMoney(plan.remaining)
                          : "Plan not evaluated"}
                      </strong>
                      {plan && (
                        <span className="pass-label">
                          <ShieldCheck size={13} />
                          Reserve protected
                        </span>
                      )}
                    </div>
                  </section>
                  <section className="forecast-panel">
                    <div className="section-heading">
                      <h2>Expected receipt</h2>
                      <span className="quiet-label">SYNTHETIC</span>
                    </div>
                    <div className="forecast-amount">
                      {formatMoney(forecast.amount, "USD", true)}
                      <span>USD · customer payment</span>
                    </div>
                    <div className="confidence-row">
                      <span>Confidence</span>
                      <strong className={forecast.delayed ? "amber-text" : ""}>
                        {Math.round(forecast.confidence * 100)}%
                      </strong>
                    </div>
                    <div className="confidence-track">
                      <span
                        style={{ width: `${forecast.confidence * 100}%` }}
                      />
                    </div>
                    <p>
                      {forecast.delayed
                        ? "Delayed by five days. Outside the planning horizon."
                        : "Expected tomorrow. An estimate, not available cash."}
                    </p>
                    <div className="forecast-status">
                      <Clock3 size={14} />
                      {forecast.delayed
                        ? "Arrival postponed · +144h"
                        : "Expected in 24 hours"}
                    </div>
                    <button
                      className="button secondary full-width"
                      onClick={() => setTab("evidence")}
                    >
                      <FileText size={15} />
                      Review customer update <ArrowRight size={14} />
                    </button>
                  </section>
                </div>
              )}
              {plan && plan.reopened.length > 0 && (
                <motion.div
                  className="replan-strip"
                  initial={reduced ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Workflow size={17} />
                  <div>
                    <strong>
                      {plan.reopened.length} decisions reopened ·{" "}
                      {plan.unchanged.length} unchanged
                    </strong>
                    <span>
                      Only affected decisions were revised. Unchanged evaluation
                      identities and timestamps are preserved.
                    </span>
                  </div>
                </motion.div>
              )}
              <section className="obligations-section">
                <div className="section-heading">
                  <div>
                    <h2>
                      Obligation ledger{" "}
                      <span className="number-tag">
                        {plan?.decisions.length ?? 5}
                      </span>
                    </h2>
                    <span>
                      Synthetic demo obligations · ranked by business priority
                    </span>
                  </div>
                  <span className="quiet-label">
                    {plan ? "PLAN EVALUATED" : "AWAITING PLAN"}
                  </span>
                </div>
                <div className="ledger-scroll">
                  <table className="obligations-table">
                    <thead>
                      <tr>
                        <th>OBLIGATION</th>
                        <th>AMOUNT</th>
                        <th>DUE</th>
                        <th>PRIORITY</th>
                        <th>DECISION</th>
                        <th aria-label="Details" />
                      </tr>
                    </thead>
                    <tbody>
                      {plan?.decisions.map((d, i) => (
                        <motion.tr
                          key={d.id}
                          layout={!reduced}
                          initial={reduced ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.035 }}
                        >
                          <td>
                            <button
                              className="obligation-name"
                              onClick={() => {
                                setSelected(d.id);
                                clearAuthorization();
                              }}
                            >
                              <span
                                className={`obligation-symbol ${d.id === "logistics" ? "symbol-accent" : ""}`}
                              >
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <span>
                                {d.obligation.title}
                                <small>{d.obligation.category}</small>
                              </span>
                            </button>
                          </td>
                          <td className="mono amount-cell">
                            {formatMoney(
                              d.obligation.amount,
                              d.obligation.currency,
                            )}
                            <small>{d.obligation.currency}</small>
                          </td>
                          <td>
                            <span
                              className={
                                d.obligation.dueHours < 24 ? "due-soon" : ""
                              }
                            >
                              {d.obligation.dueHours}h
                            </span>
                          </td>
                          <td>
                            <span
                              className={`priority priority-${d.obligation.priority.toLowerCase()}`}
                            >
                              <i />
                              {d.obligation.priority}
                            </span>
                          </td>
                          <td>
                            <ActionBadge decision={d} />
                            {d.id === "logistics" && transferred ? (
                              <small className="approval-note">
                                Campaign transfer verified
                              </small>
                            ) : (
                              d.approvalRequired && (
                                <small className="approval-note">
                                  Approval required
                                </small>
                              )
                            )}
                          </td>
                          <td>
                            <button
                              className="icon-button"
                              aria-label={`Explain ${d.obligation.title}`}
                              onClick={() => {
                                setSelected(d.id);
                                clearAuthorization();
                              }}
                            >
                              <ArrowUpRight size={17} />
                            </button>
                          </td>
                        </motion.tr>
                      )) ?? (
                        <tr>
                          <td colSpan={6}>
                            <div className="empty-ledger">
                              <Sparkles size={18} />
                              Build the treasury plan to evaluate all five
                              obligations.
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              {tab === "overview" && (
                <section className="live-wallet">
                  <div className="section-heading">
                    <div>
                      <h2>
                        <Landmark size={17} />
                        Airwallex Sandbox wallet
                      </h2>
                      <span>
                        Actual test balances · never combined across currencies
                      </span>
                    </div>
                    <span className="connection">
                      <span />
                      LIVE REST
                    </span>
                  </div>
                  <div className="wallet-grid">
                    {currencies.map((c) => {
                      const b = snapshot?.balances.find(
                        (b) => b.currency === c,
                      );
                      return (
                        <div key={c}>
                          <div className="wallet-currency">
                            <span>{c}</span>
                            <ArrowUpRight size={13} />
                          </div>
                          <strong>
                            {b ? formatMoney(b.available, c, true) : "Reading…"}
                          </strong>
                          <small>Available · {c}</small>
                          <dl>
                            <div>
                              <dt>Pending</dt>
                              <dd>{b ? formatMoney(b.pending, c) : "—"}</dd>
                            </div>
                            <div>
                              <dt>Reserved</dt>
                              <dd>{b ? formatMoney(b.reserved, c) : "—"}</dd>
                            </div>
                            <div>
                              <dt>Total</dt>
                              <dd>{b ? formatMoney(b.total, c, true) : "—"}</dd>
                            </div>
                          </dl>
                        </div>
                      );
                    })}
                  </div>
                  <div className="wallet-footer">
                    <span>
                      {snapshot
                        ? `Read ${new Date(snapshot.fetchedAt).toLocaleTimeString("en-GB")} · ${snapshot.globalAccounts.map((a) => `${a.currency} Global Account / ${a.country} / ${a.status}`).join(", ")} · ${snapshot.beneficiaries.length} beneficiary corridors`
                        : "Awaiting real API response"}
                    </span>
                    <button
                      className="text-link"
                      onClick={() => {
                        setBlocked(true);
                        record(
                          "POLICY_ENGINE",
                          "Reserve violation demonstration",
                          "Hypothetical $34,200 allocation would leave $13,800. Rejected by the same deterministic reserve guard; no API mutation requested.",
                        );
                      }}
                    >
                      Test reserve guard <ArrowRight size={13} />
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
          {tab === "evidence" && (
            <div className="evidence-layout">
              <section className="evidence-editor">
                <div className="section-heading">
                  <div>
                    <h2>Customer update / invoice</h2>
                    <span>Document text is untrusted input</span>
                  </div>
                  <FileText size={18} />
                </div>
                <form onSubmit={form.handleSubmit(interpret)}>
                  <label htmlFor="evidence-text">Evidence content</label>
                  <textarea
                    id="evidence-text"
                    {...form.register("text")}
                    rows={12}
                  />
                  {form.formState.errors.text && (
                    <p className="error-text">
                      {form.formState.errors.text.message}
                    </p>
                  )}
                  <div className="editor-footer">
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        form.setValue("text", delayEmail);
                        setInterpretation(undefined);
                      }}
                    >
                      Load delay email
                    </button>
                    <button className="button primary" disabled={!!busy}>
                      <Sparkles size={16} />
                      Interpret evidence
                    </button>
                  </div>
                </form>
                <div className="document-disclosure">
                  <ShieldCheck size={16} />
                  <span>
                    Evidence cannot change the reserve, the beneficiary or
                    execution permissions. Only reviewed facts enter the plan.
                  </span>
                </div>
              </section>
              <section className="interpretation-panel">
                <div className="section-heading">
                  <h2>Agent interpretation</h2>
                  <Sparkles size={17} />
                </div>
                {interpretation ? (
                  <>
                    <span
                      className={`provider-label ${interpretation.provider === "DETERMINISTIC_FALLBACK" ? "provider-fallback" : ""}`}
                    >
                      {interpretation.provider === "OPENROUTER"
                        ? "REAL OPENROUTER INFERENCE"
                        : "DETERMINISTIC FALLBACK"}
                    </span>
                    <p className="model-name">{interpretation.model}</p>
                    <h3>{interpretation.summary}</h3>
                    {interpretation.warning && (
                      <p className="muted-copy">{interpretation.warning}</p>
                    )}
                    {interpretation.rejectedInstructions && (
                      <div className="notice error">
                        Instruction attempt flagged. No policy or beneficiary
                        change accepted.
                      </div>
                    )}
                    {interpretation.forecastDelayDays !== null && (
                      <>
                        <dl className="detail-list">
                          <div>
                            <dt>Reported delay</dt>
                            <dd>{interpretation.forecastDelayDays} days</dd>
                          </div>
                          <div>
                            <dt>Policy impact</dt>
                            <dd>Re-evaluate forecast confidence</dd>
                          </div>
                          <div>
                            <dt>Financial authority</dt>
                            <dd>None</dd>
                          </div>
                        </dl>
                        <button
                          className="button primary full-width"
                          onClick={() =>
                            changeForecast(interpretation.forecastDelayDays!)
                          }
                          disabled={!!busy}
                        >
                          Accept evidence & replan <ArrowRight size={16} />
                        </button>
                      </>
                    )}
                    {interpretation.invoice &&
                      !interpretation.rejectedInstructions && (
                        <>
                          <dl className="detail-list">
                            <div>
                              <dt>Invoice amount</dt>
                              <dd>
                                {interpretation.invoice.currency}{" "}
                                {interpretation.invoice.amountMajor}
                              </dd>
                            </div>
                            <div>
                              <dt>Due</dt>
                              <dd>{interpretation.invoice.dueHours}h</dd>
                            </div>
                          </dl>
                          <button
                            className="button secondary full-width"
                            onClick={addInvoice}
                          >
                            Add reviewed invoice to demo plan
                          </button>
                        </>
                      )}
                    <button
                      className="text-link reset-forecast"
                      onClick={() => changeForecast(0)}
                      disabled={!!busy}
                    >
                      Restore baseline forecast
                    </button>
                  </>
                ) : (
                  <div className="interpret-empty">
                    <Sparkles size={27} />
                    <h3>
                      A fact candidate,
                      <br />
                      never a financial command.
                    </h3>
                    <p>
                      Interpret the email to see the provider, structured facts
                      and the proposed effect on the treasury plan.
                    </p>
                    <span>Free-only model routing · validated output</span>
                  </div>
                )}
              </section>
            </div>
          )}
          {tab === "audit" && (
            <>
              <section className="financial-evidence">
                <div className="section-heading">
                  <div>
                    <h2>Verified financial evidence</h2>
                    <span>Fresh Airwallex Sandbox API responses</span>
                  </div>
                  <button className="button secondary" onClick={exportAudit}>
                    <Download size={15} />
                    Export JSON
                  </button>
                </div>
                {snapshot?.evidence.length ? (
                  snapshot.evidence.map((e) => (
                    <article className="financial-row" key={e.id}>
                      <span className="evidence-icon">
                        {e.kind === "FX_CONVERSION" ? (
                          <RefreshCw size={20} />
                        ) : (
                          <ArrowUpRight size={20} />
                        )}
                      </span>
                      <div>
                        <h3>
                          {e.kind === "FX_CONVERSION"
                            ? "Real Sandbox FX conversion"
                            : "Real Sandbox supplier transfer"}
                        </h3>
                        <p>
                          {e.kind === "FX_CONVERSION"
                            ? `${formatMoney(e.sellAmount!, e.sellCurrency)} → ${formatMoney(e.buyAmount!, e.buyCurrency)}`
                            : formatMoney(e.amount!, e.currency)}
                        </p>
                        <code>{e.id}</code>
                        <small>request_id {e.requestId}</small>
                        {e.kind === "TRANSFER" &&
                          ["SENT", "PAID"].includes(e.status) && (
                            <small>
                              State produced by the Sandbox simulation API
                            </small>
                          )}
                      </div>
                      <span className="action-badge action-pay_now">
                        {e.status}
                      </span>
                    </article>
                  ))
                ) : (
                  <div className="empty-ledger">
                    No campaign financial actions have been performed yet.
                  </div>
                )}
                {transferred && transferred.status !== "PAID" && (
                  <div className="simulation-controls">
                    <span>Sandbox state simulation · explicitly labelled</span>
                    <button
                      className="button secondary"
                      disabled={!!busy || !snapshot?.executionAvailable}
                      onClick={() =>
                        transition(
                          transferred.status === "SENT" ? "PAID" : "SENT",
                        )
                      }
                    >
                      Simulate {transferred.status === "SENT" ? "PAID" : "SENT"}{" "}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </section>
              <section className="audit-section">
                <div className="section-heading">
                  <div>
                    <h2>Decision & activity trail</h2>
                    <span>High-level actions · browser-local history</span>
                  </div>
                  <span className="quiet-label">{events.length} EVENTS</span>
                </div>
                {events.length ? (
                  <ol className="audit-list">
                    {events.map((event) => (
                      <li key={event.id}>
                        <span
                          className={`audit-dot actor-${event.actor.toLowerCase()}`}
                        />
                        <time>
                          {new Date(event.at).toLocaleTimeString("en-GB")}
                        </time>
                        <div>
                          <span className="actor-label">
                            {event.actor.replaceAll("_", " ")}
                          </span>
                          <h3>{event.title}</h3>
                          <p>{event.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="empty-ledger">
                    Build a plan or refresh live data to start the audit trail.
                  </div>
                )}
              </section>
            </>
          )}
          {snapshot?.evidence.length
            ? tab !== "audit" && (
                <div className="evidence-banner">
                  <CheckCheck size={18} />
                  <div>
                    <strong>
                      {snapshot.evidence.length} real Sandbox actions verified
                    </strong>
                    <span>
                      {converted ? "FX conversion" : ""}
                      {transferred ? " + supplier transfer" : ""} · Inspect
                      provider IDs, states and request IDs.
                    </span>
                  </div>
                  <button className="text-link" onClick={() => setTab("audit")}>
                    View evidence <ArrowRight size={14} />
                  </button>
                </div>
              )
            : null}
          <footer className="app-footer">
            <span>AI interprets. Policy protects. Airwallex executes.</span>
            <span>Synthetic scenario · Sandbox only · No real money</span>
          </footer>
        </main>
      </div>
      <Inspector
        open={!!decision}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(undefined);
            clearAuthorization();
          }
        }}
        title={decision?.obligation.title ?? "Decision"}
        description="Synthetic obligation · deterministic treasury evaluation"
      >
        {decision && (
          <>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            {busy && (
              <div className="busy-status" role="status">
                <LoaderCircle size={13} className="spin" />
                {busy}…
              </div>
            )}
            <div className="decision-hero">
              <strong>
                {formatMoney(
                  decision.obligation.amount,
                  decision.obligation.currency,
                )}
              </strong>
              <ActionBadge decision={decision} />
            </div>
            <div className="decision-meta">
              <span>Due in {decision.obligation.dueHours} hours</span>
              <span>{decision.obligation.priority}</span>
              <span>Revision {decision.revision}</span>
            </div>
            <section className="inspector-section">
              <h3>Why this decision</h3>
              <p>{decision.reason}</p>
              <dl className="detail-list">
                <div>
                  <dt>USD equivalent / settled funding</dt>
                  <dd>{formatMoney(decision.cost)}</dd>
                </div>
                <div>
                  <dt>Reserve after proposed commitment</dt>
                  <dd>
                    {decision.action === "DEFER"
                      ? "No execution proposed"
                      : formatMoney(decision.reserveAfter)}
                  </dd>
                </div>
                <div>
                  <dt>Minimum reserve</dt>
                  <dd>{formatMoney(POLICY.reserve)}</dd>
                </div>
                <div>
                  <dt>Approval</dt>
                  <dd>
                    {decision.approvalRequired
                      ? "Human approval required"
                      : decision.action === "ESCALATE"
                        ? "Resolution required"
                        : "Within autonomy / planning only"}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="inspector-section">
              <h3>Decision dependencies</h3>
              <div className="dependency-tags">
                {decision.dependencies.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <p className="muted-copy">
                Evaluated{" "}
                {new Date(decision.evaluatedAt).toLocaleTimeString("en-GB")}.
                Unchanged decisions keep their evaluation identity.
              </p>
            </section>
            {selected === "logistics" ? (
              <section className="inspector-section execution-section">
                <h3>
                  <ShieldCheck size={16} />
                  Real Sandbox execution
                </h3>
                <p className="muted-copy">
                  One fixed supplier lifecycle shared across this public
                  campaign. Maximum USD funding: $18,000. Existing beneficiary
                  only. Live balances are checked again immediately before
                  execution.
                </p>
                {transferred ? (
                  <div className="execution-complete">
                    <CheckCheck size={25} />
                    <strong>Supplier transfer verified</strong>
                    <span>
                      {transferred.status} ·{" "}
                      {formatMoney(transferred.amount!, transferred.currency)}
                    </span>
                    {["SENT", "PAID"].includes(transferred.status) && (
                      <span>Provider Sandbox state simulation</span>
                    )}
                    <code>{transferred.id}</code>
                    <button
                      className="button secondary full-width"
                      onClick={() => {
                        setSelected(undefined);
                        setTab("audit");
                      }}
                    >
                      Inspect Airwallex evidence <ArrowRight size={15} />
                    </button>
                  </div>
                ) : !proposal ? (
                  <>
                    <div className="execution-sequence">
                      <span className={converted ? "done" : "current"}>
                        01 · FX conversion {converted && <Check size={13} />}
                      </span>
                      <ChevronRight size={12} />
                      <span className={converted ? "current" : ""}>
                        02 · Supplier transfer
                      </span>
                    </div>
                    <button
                      className="button primary full-width"
                      onClick={prepare}
                      disabled={!!busy || !snapshot?.executionAvailable}
                    >
                      {converted
                        ? "Prepare supplier transfer"
                        : "Get real FX quote"}
                      <ArrowRight size={16} />
                    </button>
                    {!snapshot?.executionAvailable && (
                      <p className="muted-copy">
                        Execution window is closed. Read and plan capabilities
                        remain available.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="proposal-review">
                    <div className="provider-label">
                      REAL AIRWALLEX SANDBOX{" "}
                      {proposal.operation === "CONVERT"
                        ? "QUOTE"
                        : "TRANSFER PROPOSAL"}
                    </div>
                    <dl className="detail-list">
                      <div>
                        <dt>
                          {proposal.operation === "CONVERT"
                            ? "Buy"
                            : "Transfer"}
                        </dt>
                        <dd>
                          {formatMoney(
                            proposal.quote.buyAmount,
                            proposal.quote.buyCurrency,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>USD funding / commitment</dt>
                        <dd>{formatMoney(proposal.cost)}</dd>
                      </div>
                      <div>
                        <dt>Resulting reserve</dt>
                        <dd>{formatMoney(proposal.reserveAfter)}</dd>
                      </div>
                      <div>
                        <dt>Reserve policy</dt>
                        <dd className="pass-label">
                          <ShieldCheck size={13} />
                          PASS · server evaluated
                        </dd>
                      </div>
                      <div>
                        <dt>Current autonomy</dt>
                        <dd>{formatMoney(proposal.autonomy)}</dd>
                      </div>
                      <div>
                        <dt>Beneficiary</dt>
                        <dd>{proposal.beneficiary}</dd>
                      </div>
                      <div>
                        <dt>Valid until</dt>
                        <dd>
                          {new Date(
                            proposal.quote.validUntil,
                          ).toLocaleTimeString("en-GB")}
                        </dd>
                      </div>
                    </dl>
                    <div className="fingerprint-block">
                      <Fingerprint size={15} />
                      <div>
                        <span>Approval fingerprint</span>
                        <code>{proposal.fingerprint}</code>
                      </div>
                    </div>
                    <label className="confirmation">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        disabled={!!approval}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      <span>
                        I approve this exact Sandbox action, amount and
                        beneficiary. No real money is involved.
                      </span>
                    </label>
                    {!approval ? (
                      <button
                        className="button primary full-width"
                        disabled={!confirmed || !!busy}
                        onClick={approve}
                      >
                        <LockKeyhole size={15} />
                        Approve exact action
                      </button>
                    ) : (
                      <>
                        <div className="approval-bound">
                          <ShieldCheck size={16} />
                          Approval bound to current financial state
                        </div>
                        <button
                          className="button primary full-width"
                          disabled={!!busy}
                          onClick={execute}
                        >
                          Execute Sandbox{" "}
                          {proposal.operation === "CONVERT"
                            ? "conversion"
                            : "transfer"}{" "}
                          <ArrowRight size={16} />
                        </button>
                      </>
                    )}
                    <p className="muted-copy">
                      A balance, quote, beneficiary or accepted forecast change
                      invalidates this approval. Reusing the campaign action
                      reuses its request_id.
                    </p>
                  </div>
                )}
              </section>
            ) : (
              <section className="inspector-section">
                <div className="document-disclosure">
                  <LockKeyhole size={16} />
                  <span>
                    This obligation is evaluated for planning. The public
                    financial demonstration is limited to the fixed critical
                    supplier campaign.
                  </span>
                </div>
              </section>
            )}
          </>
        )}
      </Inspector>
      <Inspector
        open={blocked}
        onOpenChange={setBlocked}
        title="Reserve floor enforced."
        description="Hypothetical policy test · no Airwallex mutation requested"
      >
        <div className="blocked-hero">
          <ShieldCheck size={34} />
          <strong>Action blocked</strong>
          <span>A human approval cannot override the reserve floor.</span>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Authorized allocation</dt>
            <dd>$48,000</dd>
          </div>
          <div>
            <dt>Requested allocation</dt>
            <dd>$34,200</dd>
          </div>
          <div>
            <dt>Resulting reserve</dt>
            <dd className="amber-text">
              {formatMoney(
                reserveCheck(POLICY.allocation, minor("34200")).after,
              )}
            </dd>
          </div>
          <div>
            <dt>Minimum reserve</dt>
            <dd>$15,000</dd>
          </div>
          <div>
            <dt>Shortfall</dt>
            <dd>$1,200</dd>
          </div>
          <div>
            <dt>API execution</dt>
            <dd>Not requested</dd>
          </div>
        </dl>
        <div className="document-disclosure">
          <ShieldCheck size={17} />
          <span>
            The same deterministic guard protects the real supplier action.
            Model suggestions and approval cannot bypass it.
          </span>
        </div>
      </Inspector>
    </div>
  );
}
