"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
  Workflow,
  X,
} from "lucide-react";
import { Brand, SandboxBadge } from "./brand";
import { Inspector } from "./ui/dialog";
import { treasuryApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { reserveCheck } from "@/lib/treasury";
import type { GovernorView, Reconciliation } from "@/lib/governor/types";
import type { Command } from "@/lib/server/governor";
import type { Decision } from "@/lib/types";

const navigation = [
  { id: "overview", label: "Overview", icon: Layers3 },
  { id: "plan", label: "Plan", icon: Workflow },
  { id: "position", label: "Cash position", icon: Landmark },
  { id: "evidence", label: "Evidence", icon: FileText },
  { id: "approvals", label: "Approvals", icon: LockKeyhole },
  { id: "reconciliation", label: "Reconciliation", icon: CheckCheck },
  { id: "incidents", label: "Incidents", icon: CircleHelp },
  { id: "audit", label: "Audit trail", icon: Activity },
  { id: "policies", label: "Policies", icon: ShieldCheck },
] as const;
type Tab = (typeof navigation)[number]["id"];
type ToolInput = Command extends infer C
  ? C extends Command
    ? Omit<C, "revision">
    : never
  : never;
const labels = {
  PAY_NOW: "Pay",
  CONVERT_AND_PAY: "Convert + pay",
  DEFER: "Defer",
  ESCALATE: "Escalate",
};
const delayMessage =
  "Customer update · INV-4092\n\nThe expected USD 20,000 payment is delayed by 5 days. We expect to send it next week.";
function Status({
  children,
  tone = "safe",
}: {
  children: React.ReactNode;
  tone?: "safe" | "warning" | "quiet";
}) {
  return (
    <span className={`g-status g-status-${tone}`}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}
function SectionTitle({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="g-section-title">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}
function ReconciliationRow({ row }: { row: Reconciliation }) {
  return (
    <article className="g-reconciliation-row">
      <div className="g-rec-header">
        <div>
          <h3>{row.kind.replaceAll("_", " ")}</h3>
          <small>
            {row.basis === "LIVE_RESOURCE"
              ? "Current provider resource vs recorded instruction"
              : "Recorded balances + current provider verification"}
          </small>
        </div>
        <Status tone={row.status === "MATCHED" ? "safe" : "warning"}>
          {row.status}
        </Status>
      </div>
      <div className="g-rec-grid">
        <div className="g-rec-label" />
        <strong>EXPECTED</strong>
        <strong>OBSERVED</strong>
        <strong>VARIANCE</strong>
        {row.expected.map((m, i) => (
          <div className="g-rec-movement" key={m.currency}>
            <span>{m.currency}</span>
            <span>{formatMoney(m.amount, m.currency)}</span>
            <span>
              {row.observedStatus === "NOT_OBSERVED"
                ? "Not observed"
                : formatMoney(row.observed[i]?.amount ?? 0, m.currency)}
            </span>
            <span
              className={row.difference[i]?.amount ? "g-warning" : "g-muted"}
            >
              {row.observedStatus === "NOT_OBSERVED"
                ? "Not established"
                : formatMoney(row.difference[i]?.amount ?? 0, m.currency)}
            </span>
          </div>
        ))}
        <div className="g-rec-movement">
          <span>Status</span>
          <span>{row.expectedStatus}</span>
          <span>{row.observedStatus}</span>
          <span>
            {row.expectedStatus === row.observedStatus
              ? "—"
              : "Pending / exception"}
          </span>
        </div>
      </div>
      <p className="g-note">{row.detail}</p>
      <small>Checked {new Date(row.checkedAt).toLocaleString("en-GB")}</small>
    </article>
  );
}
export function CashGovernor() {
  const reduced = useReducedMotion();
  const [world, setWorld] = useState<GovernorView>();
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [mobile, setMobile] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [text, setText] = useState(delayMessage);
  const [complaint, setComplaint] = useState(
    "Supplier reports that the payment has not arrived. Please investigate the original transfer.",
  );
  const [confirm, setConfirm] = useState(false);
  const [guard, setGuard] = useState(false);
  const [now, setNow] = useState(0);
  const flight = useRef(false);
  const reload = useCallback(async () => {
    if (flight.current) return;
    flight.current = true;
    setBusy("Reading durable treasury state");
    setError(undefined);
    try {
      setWorld(await treasuryApi());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to read treasury state",
      );
    } finally {
      flight.current = false;
      setBusy(undefined);
    }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    treasuryApi()
      .then((state) => {
        if (active) setWorld(state);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Treasury read unavailable",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function tool(command: ToolInput, label: string) {
    if (!world || flight.current) return;
    flight.current = true;
    setBusy(label);
    setError(undefined);
    try {
      setWorld(
        await treasuryApi({ ...command, revision: world.revision } as Command),
      );
      setConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Treasury request failed");
    } finally {
      flight.current = false;
      setBusy(undefined);
    }
  }
  // A fresh read-only cycle observes provider changes; no timer sends financial writes.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !flight.current && world)
        void tool(
          { tool: "run_cycle" },
          "Observing and reconciling provider state",
        );
    }, 60000);
    return () => clearInterval(timer);
    // The interval captures the currently persisted revision and is renewed after every update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world?.revision]);
  const latest = world?.plans.at(-1),
    plan = latest?.plan,
    previous = world?.plans.at(-2);
  const decision = plan?.decisions.find((d) => d.id === selected);
  const transfer = world?.snapshot.evidence.find((e) => e.kind === "TRANSFER");
  const nextObligation = plan?.decisions.find(
    (d) => !(d.id === "logistics" && transfer?.status === "PAID"),
  );
  const confidence = Math.round((world?.forecast.confidence ?? 0) * 100);
  const changed = new Set(plan?.reopened);
  const needed =
    plan?.decisions.filter(
      (d) => d.approvalRequired && !(d.id === "logistics" && transfer),
    ) ?? [];
  function navigate(id: Tab) {
    setTab(id);
    setMobile(false);
    setError(undefined);
  }
  function exportEvidence() {
    if (!world) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(world, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "treasurypilot-governor-evidence.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  function planRows(items: Decision[]) {
    return (
      <div className="g-plan-list" role="list" aria-label="Treasury decisions">
        {items.map((d, i) => (
          <motion.button
            layout={!reduced}
            initial={false}
            transition={{ duration: reduced ? 0 : 0.24 }}
            className={`g-plan-row ${changed.has(d.id) ? "g-plan-changed" : ""}`}
            key={d.id}
            onClick={() => setSelected(d.id)}
            aria-label={`Inspect ${d.obligation.title}`}
          >
            <span className="g-row-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="g-vendor">
              <strong>{d.obligation.title}</strong>
              <small>
                {d.obligation.category} · {d.obligation.priority}
              </small>
            </div>
            <div className="g-row-money">
              <strong>
                {formatMoney(d.obligation.amount, d.obligation.currency)}
              </strong>
              <small>Due +{d.obligation.dueHours}h</small>
            </div>
            <div className="g-row-decision">
              <Status
                tone={
                  ["DEFER", "ESCALATE"].includes(d.action) ? "warning" : "safe"
                }
              >
                {d.id === "logistics" && transfer
                  ? `Verified ${transfer.status}`
                  : labels[d.action]}
              </Status>
              <small>
                {changed.has(d.id) ? "Reopened · " : ""}
                {d.id === "logistics" && transfer
                  ? "Original Sandbox action"
                  : d.approvalRequired
                    ? "Approval required · planning"
                    : "Planning mandate"}
              </small>
            </div>
            <ChevronRight size={16} />
          </motion.button>
        ))}
      </div>
    );
  }
  const receipt = world?.snapshot.deposit;
  const refusal = world
    ? reserveCheck(
        world.policy.baseAllocation,
        3420000,
        world.policy.reserve,
        world.policy.baseAllocation,
      )
    : undefined;
  const title =
    tab === "overview"
      ? "Treasury overview"
      : navigation.find((n) => n.id === tab)!.label;
  return (
    <div className="governor">
      <aside className={`g-sidebar ${mobile ? "g-sidebar-open" : ""}`}>
        <Link href="/" aria-label="TreasuryPilot home">
          <Brand small />
        </Link>
        <button
          className="g-mobile-close"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <div className="g-workspace-name">
          <span>SB</span>
          <div>
            Sandbox Business<small>Autonomous Cash Governor</small>
          </div>
        </div>
        <small className="g-nav-kicker">TREASURY WORKSPACE</small>
        <nav aria-label="Treasury navigation">
          {navigation.map((n) => (
            <button
              aria-current={tab === n.id ? "page" : undefined}
              aria-label={n.label}
              key={n.id}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={17} />
              {n.label}
              {n.id === "approvals" && needed.length > 0 && (
                <span className="g-nav-count">{needed.length}</span>
              )}
              {n.id === "incidents" && !!world?.incidents.length && (
                <span className="g-nav-count">{world.incidents.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="g-side-bottom">
          <ShieldCheck size={18} />
          <strong>Bounded authority</strong>
          <small>Sandbox only · No real money</small>
          <Link href="/treasury/v1">
            v1 workspace <ArrowUpRight size={12} />
          </Link>
        </div>
      </aside>
      <div className="g-body">
        <header className="g-topbar">
          <div>
            <button
              className="g-mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>TreasuryPilot</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div>
            <Status tone={world ? "safe" : "quiet"}>
              {world ? "Airwallex connected" : "Connecting"}
            </Status>
            <SandboxBadge />
          </div>
        </header>
        <main className="g-main">
          <div className="g-heading">
            <div>
              <small className="g-kicker">AUTONOMOUS CASH GOVERNOR / 72H</small>
              <h1>{title}</h1>
              <p>
                {tab === "overview"
                  ? "Liquidity, decisions and authority in one place."
                  : tab === "reconciliation"
                    ? "Compare the instruction with what Airwallex actually reports."
                    : tab === "position"
                      ? "Place operating liquidity where the next obligations need it."
                      : tab === "evidence"
                        ? "Review the facts before they change the mandate."
                        : "Inspect the state behind every treasury decision."}
              </p>
            </div>
            <div className="g-heading-actions">
              <button
                className="g-button secondary"
                disabled={!!busy}
                onClick={() =>
                  world
                    ? void tool(
                        { tool: "observe" },
                        "Observing Airwallex and replanning",
                      )
                    : void reload()
                }
              >
                <RefreshCw size={15} />
                Refresh
              </button>
              <button
                className="g-button"
                disabled={!world || !!busy}
                onClick={() =>
                  void tool(
                    { tool: "run_cycle" },
                    "Observing, checking policy and reconciling",
                  )
                }
              >
                <Activity size={15} />
                Run agent cycle
              </button>
            </div>
          </div>
          {error && (
            <div className="g-notice error" role="alert">
              <CircleHelp size={18} />
              <span>{error}</span>
              <button
                aria-label="Dismiss error"
                onClick={() => setError(undefined)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="g-live-status" role="status" aria-live="polite">
            {busy ? (
              <>
                <LoaderCircle size={13} className="spin" />
                {busy}…
              </>
            ) : world ? (
              <>
                <span className="g-dot" />
                Observed{" "}
                {new Date(world.snapshot.fetchedAt).toLocaleTimeString(
                  "en-GB",
                )}{" "}
                · {latest?.id} · revision {world.revision} · durable{" "}
                {world.persistence === "PRIVATE_BLOB"
                  ? "private storage"
                  : "local revisions"}
              </>
            ) : (
              "Reading provider balances and persisted context…"
            )}
          </div>
          {!world && !error && (
            <div className="g-skeleton" aria-label="Loading treasury">
              <div />
              <div />
              <div />
            </div>
          )}
          {world && plan && (
            <>
              {(tab === "overview" || tab === "plan") && (
                <>
                  <section className="g-metrics" aria-label="Treasury mandate">
                    <div>
                      <span>Operating allocation</span>
                      <strong>
                        {formatMoney(plan.allocation, "USD", true)}
                      </strong>
                      <small>Bounded authority · USD equivalent</small>
                    </div>
                    <div>
                      <span>
                        Reserve after plan <ShieldCheck size={12} />
                      </span>
                      <strong>{formatMoney(plan.remaining, "USD")}</strong>
                      <small>
                        Floor {formatMoney(plan.reserve, "USD", true)} ·
                        protected · {latest?.id}
                      </small>
                    </div>
                    <div>
                      <span>Autonomous FX limit</span>
                      <motion.strong
                        key={plan.autonomy}
                        initial={reduced ? false : { opacity: 0.35, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.24 }}
                      >
                        {formatMoney(plan.autonomy, "USD", true)}
                      </motion.strong>
                      <small>{confidence}% receipt confidence</small>
                    </div>
                    <div>
                      <span>Next obligation</span>
                      <strong className="g-metric-small">
                        {nextObligation
                          ? `+${nextObligation.obligation.dueHours}h`
                          : "None"}
                      </strong>
                      <small>
                        {nextObligation?.obligation.title ??
                          "No remaining obligations"}{" "}
                        · scenario horizon
                      </small>
                    </div>
                  </section>
                  <div className="g-mandate-note">
                    <LockKeyhole size={14} />
                    <span>
                      Operating allocation is a synthetic mandate. Actual
                      Sandbox wallets are shown separately. Forecast receipts
                      never authorize spending. The reserve floor is a policy
                      constraint, not a bank-held reserve.
                    </span>
                  </div>
                </>
              )}
              {tab === "overview" && (
                <>
                  <div className="g-overview-grid">
                    <section className="g-forecast">
                      <SectionTitle
                        title="72-hour liquidity"
                        detail="Remaining operating cash · original paid supplier already deducted"
                        action={<Status>Reserve safe</Status>}
                      />
                      <div className="g-chart-legend">
                        <span>
                          <i />
                          Committed cash
                        </span>
                        <span className="expected">
                          <i />
                          With expected receipt
                        </span>
                        <span className="floor">
                          <i />
                          Reserve floor
                        </span>
                      </div>
                      <div
                        className="g-chart"
                        role="img"
                        aria-label={`72-hour cash projection ends at ${formatMoney(plan.remaining)}; reserve floor ${formatMoney(plan.reserve)}; confidence ${confidence}%`}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={plan.timeline}
                            margin={{ top: 16, right: 14, left: 0, bottom: 4 }}
                          >
                            <defs>
                              <linearGradient
                                id="governorCash"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#94e7c3"
                                  stopOpacity={0.17}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#94e7c3"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              vertical={false}
                              stroke="#ffffff0c"
                            />
                            <XAxis
                              dataKey="hour"
                              type="number"
                              domain={[0, 72]}
                              ticks={[0, 12, 24, 36, 48, 60, 72]}
                              tickFormatter={(v) =>
                                v === 0 ? "Now" : `+${v}h`
                              }
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "#9ba4a1", fontSize: 11 }}
                            />
                            <YAxis
                              domain={[
                                0,
                                Math.ceil(
                                  Math.max(
                                    plan.allocation + world.forecast.amount,
                                    6000000,
                                  ) / 1000000,
                                ) * 10000,
                              ]}
                              width={48}
                              tickFormatter={(v) => `$${v / 1000}k`}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "#9ba4a1", fontSize: 11 }}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "#222b2a",
                                border: "1px solid #46504d",
                                borderRadius: 5,
                                color: "#f0f3ef",
                              }}
                              formatter={(v) =>
                                formatMoney(Math.round(Number(v) * 100))
                              }
                              labelFormatter={(v) => `Horizon +${v}h`}
                            />
                            <Area
                              type="stepAfter"
                              dataKey="expected"
                              name="Including expected receipt"
                              stroke="#83918d"
                              strokeDasharray="5 5"
                              fill="transparent"
                              isAnimationActive={!reduced}
                              animationDuration={500}
                            />
                            <Area
                              type="stepAfter"
                              dataKey="cash"
                              name="Committed cash"
                              stroke="#94e7c3"
                              strokeWidth={2}
                              fill="url(#governorCash)"
                              isAnimationActive={!reduced}
                              animationDuration={500}
                            />
                            <ReferenceLine
                              y={plan.reserve / 100}
                              stroke="#d9bc83"
                              strokeDasharray="4 4"
                              label={{
                                value: "RESERVE",
                                position: "insideBottomRight",
                                fill: "#d9bc83",
                                fontSize: 10,
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="g-chart-summary">
                        <span>72h ending allocation</span>
                        <strong>{formatMoney(plan.remaining)}</strong>
                        <small>
                          {world.forecast.delayed
                            ? "Delayed receipt excluded from horizon"
                            : "Expected receipt shown as uncertain, never spendable"}
                        </small>
                      </div>
                    </section>
                    <section className="g-authority">
                      <SectionTitle
                        title="Adaptive authority"
                        detail="Confidence controls the mandate"
                      />
                      <div className="g-confidence">
                        <strong>
                          {confidence}
                          <span>%</span>
                        </strong>
                        <Gauge size={28} />
                      </div>
                      <div className="g-confidence-track">
                        <motion.span
                          initial={false}
                          animate={{ width: `${confidence}%` }}
                          transition={{ duration: reduced ? 0 : 0.5 }}
                        />
                      </div>
                      <p>
                        {world.forecast.delayed
                          ? `Customer receipt delayed ${(world.forecast.dueHours - 24) / 24} days. Authority reduced; the reserve floor stays fixed.`
                          : "Receipt expected in 24 hours. Evidence supports the higher autonomy tier."}
                      </p>
                      <dl>
                        <div>
                          <dt>Expected receipt</dt>
                          <dd>
                            {formatMoney(world.forecast.amount, "USD", true)}
                          </dd>
                        </div>
                        <div>
                          <dt>Autonomous limit</dt>
                          <dd>{formatMoney(plan.autonomy, "USD", true)}</dd>
                        </div>
                        <div>
                          <dt>Approval threshold</dt>
                          <dd>Above current limit</dd>
                        </div>
                      </dl>
                      <button
                        className="g-text-button"
                        onClick={() => navigate("evidence")}
                      >
                        Review customer evidence <ArrowRight size={14} />
                      </button>
                    </section>
                  </div>
                  <section className="g-loop-strip" aria-label="Agent state">
                    <Activity size={17} />
                    <div>
                      <strong>
                        {world.executionLock
                          ? "Action uncertain · reconciliation required"
                          : world.nextStep === "MONITOR"
                            ? "Agent monitoring financial state"
                            : world.nextStep.replaceAll("_", " ")}
                      </strong>
                      <p>
                        {world.executionLock
                          ? "The original request remains locked. No replacement or context change is permitted."
                          : "Observe → plan → policy → verify → reconcile. Only actual persisted events appear in the audit."}
                      </p>
                    </div>
                    <button
                      className="g-text-button"
                      onClick={() => navigate("audit")}
                    >
                      Inspect cycle <ArrowRight size={13} />
                    </button>
                  </section>
                  <section className="g-section">
                    <SectionTitle
                      title="Current plan"
                      detail="Five synthetic obligations · ranked by business priority and deadline"
                      action={
                        <button
                          className="g-text-button"
                          onClick={() => navigate("plan")}
                        >
                          Inspect revisions <ArrowRight size={13} />
                        </button>
                      }
                    />
                    {planRows(plan.decisions)}
                  </section>
                  <section className="g-section">
                    <SectionTitle
                      title="Airwallex wallet"
                      detail="Actual available Sandbox balances · exact amounts, separate currencies"
                      action={<span className="g-kicker">LIVE REST</span>}
                    />
                    <div className="g-wallets">
                      {["USD", "EUR", "GBP"].map((c) => (
                        <div key={c}>
                          <span>
                            {c}
                            <ArrowUpRight size={13} />
                          </span>
                          <strong>
                            {formatMoney(
                              world.snapshot.balances.find(
                                (b) => b.currency === c,
                              )?.available ?? 0,
                              c,
                            )}
                          </strong>
                          <small>Available · {c}</small>
                        </div>
                      ))}
                    </div>
                    <p className="g-note">
                      {world.snapshot.globalAccounts
                        .map(
                          (a) =>
                            `${a.currency} Global Account / ${a.country} / ${a.status}`,
                        )
                        .join(" · ")}{" "}
                      · {world.snapshot.beneficiaries.length} existing
                      beneficiary corridors. CNY and other currencies remain
                      visible in the evidence export.
                    </p>
                  </section>
                </>
              )}
              {tab === "plan" && (
                <>
                  {previous && (
                    <div className="g-change-summary">
                      <div>
                        <small>PREVIOUS · {previous.id}</small>
                        <strong>
                          {previous.plan.allocation !== plan.allocation ? (
                            <>
                              {formatMoney(
                                previous.plan.allocation,
                                "USD",
                                true,
                              )}{" "}
                              allocation
                            </>
                          ) : (
                            <>
                              {Math.round(
                                previous.plan.forecast.confidence * 100,
                              )}
                              % /{" "}
                              {formatMoney(previous.plan.autonomy, "USD", true)}
                            </>
                          )}
                        </strong>
                        <Status tone="quiet">SUPERSEDED</Status>
                      </div>
                      <ArrowRight size={21} />
                      <div>
                        <small>CURRENT · {latest?.id}</small>
                        <strong>
                          {previous.plan.allocation !== plan.allocation ? (
                            <>
                              {formatMoney(plan.allocation, "USD", true)}{" "}
                              allocation
                            </>
                          ) : (
                            <>
                              {confidence}% /{" "}
                              {formatMoney(plan.autonomy, "USD", true)}
                            </>
                          )}
                        </strong>
                        <Status>CURRENT</Status>
                      </div>
                      <div className="g-change-count">
                        <strong>{plan.reopened.length} reopened</strong>
                        <small>
                          {plan.unchanged.length} unchanged · identities
                          retained
                        </small>
                      </div>
                    </div>
                  )}
                  <SectionTitle
                    title="Decision ledger"
                    detail="What, why, evidence and policy are available in each inspector"
                  />
                  {planRows(plan.decisions)}
                  <section className="g-section">
                    <SectionTitle
                      title="Plan revisions"
                      detail="Server-generated, persisted and bound to financial context"
                    />
                    <div className="g-revisions">
                      {world.plans.toReversed().map((p) => (
                        <div key={p.id}>
                          <strong>{p.id}</strong>
                          <span>{p.cause.replaceAll("_", " ")}</span>
                          <span>{formatMoney(p.plan.remaining)} reserve</span>
                          <Status
                            tone={p.state === "CURRENT" ? "safe" : "quiet"}
                          >
                            {p.state}
                          </Status>
                          <small>
                            {p.contextVersion.slice(0, 12)} ·{" "}
                            {new Date(p.createdAt).toLocaleTimeString("en-GB")}
                          </small>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
              {tab === "position" && (
                <>
                  <SectionTitle
                    title="Currency placement"
                    detail="Authorized currency positions, not the entire funded test wallet"
                    action={<Status>Conservation checked</Status>}
                  />
                  <div className="g-position-list">
                    {world.placement.positions.map((p) => (
                      <article key={p.currency}>
                        <div className="g-position-currency">
                          <strong>{p.currency}</strong>
                          <small>{p.why}</small>
                        </div>
                        <div className="g-position-bars">
                          <div>
                            <span>Current</span>
                            <div>
                              <i
                                style={{
                                  width: `${(p.current / Math.max(p.current, p.target, 1)) * 100}%`,
                                }}
                              />
                            </div>
                            <strong>
                              {formatMoney(p.current, p.currency)}
                            </strong>
                          </div>
                          <div className="target">
                            <span>Target</span>
                            <div>
                              <i
                                style={{
                                  width: `${(p.target / Math.max(p.current, p.target, 1)) * 100}%`,
                                }}
                              />
                            </div>
                            <strong>{formatMoney(p.target, p.currency)}</strong>
                          </div>
                        </div>
                        <div>
                          <small>GAP</small>
                          <strong className={p.gap > 0 ? "g-warning" : ""}>
                            {formatMoney(p.gap, p.currency)}
                          </strong>
                        </div>
                      </article>
                    ))}
                  </div>
                  <section className="g-section">
                    <SectionTitle
                      title="Minimum movement proposal"
                      detail={world.placement.reason}
                    />
                    {world.placement.proposals.length ? (
                      world.placement.proposals.map((p, i) => (
                        <div className="g-placement-proposal" key={i}>
                          <RefreshCw size={19} />
                          <strong>
                            {formatMoney(p.sellAmount, p.sellCurrency)}
                          </strong>
                          <ArrowRight size={16} />
                          <strong>
                            {formatMoney(p.buyAmount, p.buyCurrency)}
                          </strong>
                          <Status tone="warning">Planning only</Status>
                        </div>
                      ))
                    ) : (
                      <p className="g-empty">
                        No FX movement is needed for the funded positions.
                      </p>
                    )}
                    <p className="g-note">
                      Indicative valuation. These proposals cannot execute
                      through the completed fixed supplier campaign; a fresh
                      quote, fees, beneficiary verification and separate
                      operator mandate would be required.
                    </p>
                    <dl className="g-summary-dl">
                      <div>
                        <dt>Reserve after indicated movement</dt>
                        <dd>{formatMoney(world.placement.reserveAfter)}</dd>
                      </div>
                      <div>
                        <dt>Minimum reserve</dt>
                        <dd>{formatMoney(world.policy.reserve)}</dd>
                      </div>
                    </dl>
                  </section>
                </>
              )}
              {tab === "evidence" && (
                <>
                  <div className="g-evidence-grid">
                    <section>
                      <SectionTitle
                        title="Customer update"
                        detail="Synthetic receivable evidence · untrusted text"
                      />
                      <label htmlFor="g-evidence">Evidence content</label>
                      <textarea
                        id="g-evidence"
                        rows={7}
                        maxLength={6000}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                      />
                      <button
                        className="g-button"
                        disabled={!!busy || text.length < 10}
                        onClick={() =>
                          void tool(
                            { tool: "interpret_context", text },
                            "Interpreting evidence with free-only inference",
                          )
                        }
                      >
                        <FileText size={15} />
                        Interpret evidence
                      </button>
                    </section>
                    <section>
                      <SectionTitle
                        title="Reviewed facts"
                        detail="The model interprets; deterministic code changes authority"
                      />
                      {world.contexts.length ? (
                        world.contexts.toReversed().map((c) => (
                          <article className="g-fact" key={c.id}>
                            <Status
                              tone={
                                c.interpretation.provider === "OPENROUTER"
                                  ? "safe"
                                  : "warning"
                              }
                            >
                              {c.interpretation.provider === "OPENROUTER"
                                ? "FREE MODEL INFERENCE"
                                : "DETERMINISTIC FALLBACK"}
                            </Status>
                            <small>{c.interpretation.model}</small>
                            <h3>{c.interpretation.summary}</h3>
                            {c.interpretation.warning && (
                              <p>{c.interpretation.warning}</p>
                            )}
                            <dl>
                              <div>
                                <dt>Reported delay</dt>
                                <dd>
                                  {c.interpretation.forecastDelayDays ??
                                    "Not identified"}{" "}
                                  days
                                </dd>
                              </div>
                              <div>
                                <dt>Policy authority</dt>
                                <dd>None from model</dd>
                              </div>
                            </dl>
                            {c.acceptedAt ? (
                              <Status>Evidence accepted</Status>
                            ) : (
                              <button
                                className="g-button"
                                disabled={
                                  !!busy ||
                                  c.interpretation.rejectedInstructions ||
                                  c.interpretation.forecastDelayDays === null
                                }
                                onClick={() =>
                                  void tool(
                                    { tool: "accept_context", contextId: c.id },
                                    "Applying reviewed context and recalculating authority",
                                  )
                                }
                              >
                                Accept evidence & replan{" "}
                                <ArrowRight size={14} />
                              </button>
                            )}
                            {c.interpretation.rejectedInstructions && (
                              <p className="g-warning">
                                Instruction attempt rejected. No permission or
                                policy changes accepted.
                              </p>
                            )}
                          </article>
                        ))
                      ) : (
                        <div className="g-empty">
                          <FileText size={24} />
                          <p>
                            Interpret the customer message to create a reviewed
                            fact candidate.
                          </p>
                          <small>
                            Only explicit facts enter the plan. No balances or
                            payment authority reach the model.
                          </small>
                        </div>
                      )}
                    </section>
                  </div>
                  {receipt?.state === "RECEIVED" && (
                    <section className="g-section g-receipt">
                      <SectionTitle
                        title="Customer deposit"
                        detail="Pre-existing Sandbox receipt · verified through fresh provider reads"
                        action={<Status>DEPOSIT RECEIVED</Status>}
                      />
                      <div className="g-receipt-flow">
                        <div>
                          <small>BEFORE · EUR AVAILABLE</small>
                          <strong>
                            {formatMoney(receipt.beforeAvailable ?? 0, "EUR")}
                          </strong>
                        </div>
                        <div>
                          <small>DEPOSIT · HISTORICAL SETTLED</small>
                          <strong>
                            + {formatMoney(receipt.delta ?? 0, "EUR")}
                          </strong>
                        </div>
                        <div>
                          <small>AFTER · VERIFIED HISTORICAL DELTA</small>
                          <strong>
                            {formatMoney(receipt.afterAvailable ?? 0, "EUR")}
                          </strong>
                        </div>
                      </div>
                      <p className="g-note">
                        The EUR 8,000 deposit was simulated once on 3 October.
                        This button assigns bounded receipt-backed authority to
                        the current plan; it never simulates another deposit or
                        changes the current wallet.
                      </p>
                      {world.receiptApplied ? (
                        <div className="g-change-result">
                          <Check size={17} />
                          Receipt allocated once · {plan.reopened.length}{" "}
                          reopened / {plan.unchanged.length} unchanged in latest
                          revision
                        </div>
                      ) : (
                        <button
                          className="g-button"
                          disabled={!!busy}
                          onClick={() =>
                            void tool(
                              { tool: "allocate_receipt" },
                              "Verifying receipt and reopening liquidity-dependent decisions",
                            )
                          }
                        >
                          <ArrowDownLeft size={15} />
                          Allocate verified receipt & replan
                        </button>
                      )}
                    </section>
                  )}
                </>
              )}
              {tab === "approvals" && (
                <>
                  <SectionTitle
                    title="Approval requirements"
                    detail="Human judgment is required above current authority; reserve failures cannot be approved"
                    action={
                      <Status tone={needed.length ? "warning" : "safe"}>
                        {needed.length} planning decisions above autonomy
                      </Status>
                    }
                  />
                  {needed.length ? (
                    planRows(needed)
                  ) : (
                    <div className="g-empty">
                      No unexecuted planning decision exceeds current authority.
                    </div>
                  )}
                  <div className="g-mandate-note">
                    <LockKeyhole size={15} />
                    <span>
                      Only the fixed logistics supplier can execute in this
                      campaign. Other invoices remain planning decisions and
                      confer no payment permission.
                    </span>
                  </div>
                  {transfer ? (
                    <section className="g-section">
                      <SectionTitle
                        title="Supplier mandate fulfilled"
                        detail="Pre-existing exact-approved financial actions preserved; no duplicate approval or execution"
                      />
                      <div className="g-completed">
                        <CheckCheck size={26} />
                        <div>
                          <strong>
                            EUR 14,000 supplier transfer · {transfer.status}
                          </strong>
                          <p>
                            USD 15,971.87 settled funding. Terminal transfer
                            state was produced through Airwallex Sandbox
                            simulation.
                          </p>
                        </div>
                        <button
                          className="g-text-button"
                          onClick={() => navigate("reconciliation")}
                        >
                          Inspect reconciliation <ArrowRight size={14} />
                        </button>
                      </div>
                    </section>
                  ) : (
                    <section className="g-section">
                      <SectionTitle
                        title="Exact supplier approval"
                        detail="Binds action, amount, counterparty, quote, plan and current financial context"
                      />
                      <button
                        className="g-button"
                        disabled={!!busy || !world.snapshot.executionAvailable}
                        onClick={() =>
                          void tool(
                            { tool: "request_human_approval" },
                            "Preparing exact supplier approval",
                          )
                        }
                      >
                        Prepare exact action
                      </button>
                    </section>
                  )}
                  {world.approvals.map((a) => {
                    const expired =
                      ["PENDING", "APPROVED"].includes(a.status) &&
                      Math.min(
                        Date.parse(a.quoteExpiresAt),
                        Date.parse(a.expiresAt),
                      ) <= now;
                    const status = expired ? "EXPIRED" : a.status;
                    return (
                      <section className="g-section" key={a.id}>
                        <SectionTitle
                          title={`${a.actionType} · ${formatMoney(a.amount, a.currency)}`}
                          action={
                            <Status
                              tone={status === "APPROVED" ? "safe" : "warning"}
                            >
                              {status}
                            </Status>
                          }
                        />
                        <dl className="g-summary-dl">
                          <div>
                            <dt>Counterparty</dt>
                            <dd>{a.counterparty}</dd>
                          </div>
                          <div>
                            <dt>Plan / context</dt>
                            <dd>
                              {a.planId} / {a.contextVersion.slice(0, 12)}
                            </dd>
                          </div>
                          <div>
                            <dt>Reserve after action</dt>
                            <dd>{formatMoney(a.reserveAfter)}</dd>
                          </div>
                          <div>
                            <dt>Quote expiry</dt>
                            <dd>
                              {new Date(a.quoteExpiresAt).toLocaleString(
                                "en-GB",
                              )}
                            </dd>
                          </div>
                        </dl>
                        <div className="g-fingerprint">
                          <Fingerprint size={16} />
                          <code>{a.fingerprint}</code>
                        </div>
                        {status === "PENDING" && (
                          <>
                            <label className="confirmation">
                              <input
                                type="checkbox"
                                checked={confirm}
                                onChange={(e) => setConfirm(e.target.checked)}
                              />
                              <span>
                                Authorize only this exact Sandbox action, amount
                                and counterparty.
                              </span>
                            </label>
                            <button
                              className="g-button"
                              disabled={!confirm || !!busy}
                              onClick={() =>
                                void tool(
                                  {
                                    tool: "approve_action",
                                    approvalId: a.id,
                                    confirmed: true,
                                  },
                                  "Binding exact approval",
                                )
                              }
                            >
                              Approve exact action
                            </button>
                          </>
                        )}
                        {status === "APPROVED" && (
                          <button
                            className="g-button"
                            disabled={!!busy}
                            onClick={() =>
                              void tool(
                                { tool: "execute_action", approvalId: a.id },
                                "Executing approved Sandbox action",
                              )
                            }
                          >
                            Execute exact Sandbox action
                          </button>
                        )}
                      </section>
                    );
                  })}
                </>
              )}
              {tab === "reconciliation" && (
                <>
                  <div className="g-reconciliation-summary">
                    <CheckCheck size={26} />
                    <div>
                      <strong>
                        {
                          world.reconciliations.filter(
                            (r) => r.status === "MATCHED",
                          ).length
                        }{" "}
                        verified matches
                      </strong>
                      <p>
                        Original instructions, provider resources and recorded
                        campaign balances.
                      </p>
                    </div>
                    <Status
                      tone={
                        world.reconciliations.every(
                          (r) => r.status === "MATCHED",
                        )
                          ? "safe"
                          : "warning"
                      }
                    >
                      {world.reconciliations.every(
                        (r) => r.status === "MATCHED",
                      )
                        ? "MATCHED"
                        : "INVESTIGATION REQUIRED"}
                    </Status>
                  </div>
                  {world.reconciliations.map((r) => (
                    <ReconciliationRow row={r} key={r.id} />
                  ))}
                  <p className="g-note">
                    Matching Sandbox records is not proof of real-world bank
                    settlement. Reserve safety concerns the operating mandate,
                    not invented wallet liquidity.
                  </p>
                </>
              )}
              {tab === "incidents" && (
                <>
                  <SectionTitle
                    title="Payment operations"
                    detail="Investigate the original payment before considering any replacement"
                  />
                  <label htmlFor="g-complaint">
                    Supplier receipt complaint · operator evidence
                  </label>
                  <textarea
                    id="g-complaint"
                    rows={3}
                    maxLength={1500}
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                  />
                  <button
                    className="g-button secondary"
                    disabled={!!busy || complaint.length < 10 || !transfer}
                    onClick={() =>
                      void tool(
                        { tool: "open_incident", complaint },
                        "Reading original transfer and opening investigation",
                      )
                    }
                  >
                    Investigate original payment <ArrowRight size={15} />
                  </button>
                  {world.incidents.length ? (
                    world.incidents.map((i) => (
                      <section className="g-section g-incident" key={i.id}>
                        <SectionTitle
                          title={`Payment incident · ${i.id.slice(0, 8)}`}
                          detail={i.complaint}
                          action={<Status tone="warning">{i.state}</Status>}
                        />
                        <div className="g-incident-decision">
                          <strong>{i.decision}</strong>
                          <span>Original transfer {i.providerStatus}</span>
                        </div>
                        <p>{i.reason}</p>
                        <div className="g-incident-history">
                          {i.history.map((h, n) => (
                            <span key={n}>
                              {new Date(h.at).toLocaleTimeString("en-GB")} ·{" "}
                              {h.status} · {h.source}
                            </span>
                          ))}
                        </div>
                        <div className="g-heading-actions">
                          <button
                            className="g-button secondary"
                            disabled={!!busy}
                            onClick={() =>
                              void tool(
                                { tool: "run_cycle" },
                                "Refreshing original transfer and reconciliation",
                              )
                            }
                          >
                            <RefreshCw size={14} />
                            Refresh original status
                          </button>
                          <button
                            className="g-button secondary"
                            disabled={!!busy || i.state === "ESCALATED"}
                            onClick={() =>
                              void tool(
                                { tool: "escalate_incident", incidentId: i.id },
                                "Recording human escalation",
                              )
                            }
                          >
                            Escalate investigation
                          </button>
                        </div>
                        <div className="g-mandate-note">
                          <LockKeyhole size={14} />
                          <span>
                            Replacement blocked. Finality and returned funding
                            must both be proven; no second supplier transfer is
                            available in this campaign.
                          </span>
                        </div>
                      </section>
                    ))
                  ) : (
                    <div className="g-empty">
                      <ShieldCheck size={25} />
                      <p>
                        No payment incident has been reported in this workspace.
                      </p>
                      <small>
                        A complaint starts an investigation, never another
                        payment.
                      </small>
                    </div>
                  )}
                </>
              )}
              {tab === "audit" && (
                <>
                  <SectionTitle
                    title="Decision and action trail"
                    detail="Durable server events · historical financial actions explicitly marked"
                    action={
                      <button
                        className="g-button secondary"
                        onClick={exportEvidence}
                      >
                        <Download size={14} />
                        Export evidence
                      </button>
                    }
                  />
                  <div className="g-audit">
                    {world.events.toReversed().map((e) => (
                      <motion.article
                        initial={reduced ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        key={e.id}
                      >
                        <time>
                          {new Date(e.at).toLocaleTimeString("en-GB")}
                        </time>
                        <i aria-hidden="true" />
                        <div>
                          <span>{e.actor.replaceAll("_", " ")}</span>
                          <h3>{e.title.replaceAll("_", " ")}</h3>
                          <p>{e.detail}</p>
                        </div>
                      </motion.article>
                    ))}
                  </div>
                  <section className="g-section">
                    <SectionTitle
                      title="Airwallex resource evidence"
                      detail="Original campaign identifiers · no raw Global Account or beneficiary details"
                    />
                    {world.operations.map((o) => (
                      <div className="g-operation" key={o.id}>
                        <div>
                          <strong>{o.kind.replaceAll("_", " ")}</strong>
                          <small>{o.provenance.replaceAll("_", " ")}</small>
                        </div>
                        <code>{o.resourceId}</code>
                        <Status>{o.status}</Status>
                      </div>
                    ))}
                  </section>
                </>
              )}
              {tab === "policies" && (
                <>
                  <SectionTitle
                    title="Execution policy"
                    detail="Source-controlled deterministic rules; the model has no authority to alter them"
                  />
                  <dl className="g-policy-list">
                    <div>
                      <dt>Minimum reserve</dt>
                      <dd>{formatMoney(world.policy.reserve)}</dd>
                    </div>
                    <div>
                      <dt>Base operating allocation</dt>
                      <dd>{formatMoney(world.policy.baseAllocation)}</dd>
                    </div>
                    <div>
                      <dt>Verified receipt authority cap</dt>
                      <dd>{formatMoney(world.policy.receiptCap)}</dd>
                    </div>
                    <div>
                      <dt>Campaign FX funding cap</dt>
                      <dd>{formatMoney(world.policy.fxCap)}</dd>
                    </div>
                    <div>
                      <dt>Approved financial corridor</dt>
                      <dd>Existing DE / EUR / LOCAL supplier</dd>
                    </div>
                    <div>
                      <dt>Financial campaign</dt>
                      <dd>One fixed EUR 14,000 supplier lifecycle</dd>
                    </div>
                  </dl>
                  <SectionTitle
                    title="Confidence and autonomy"
                    detail="The exact tier determines current financial authority"
                  />
                  <div className="g-tiers">
                    {world.policy.tiers.map((t, i) => (
                      <div
                        className={
                          world.forecast.confidence >= t.confidence &&
                          (i === 0 ||
                            world.forecast.confidence <
                              world.policy.tiers[i - 1].confidence)
                            ? "active"
                            : ""
                        }
                        key={t.confidence}
                      >
                        <strong>≥ {Math.round(t.confidence * 100)}%</strong>
                        <span>{formatMoney(t.fx)} FX</span>
                        <span>{formatMoney(t.transfer)} transfer</span>
                      </div>
                    ))}
                  </div>
                  <button
                    className="g-button secondary"
                    onClick={() => setGuard(true)}
                  >
                    <ShieldCheck size={15} />
                    Inspect reserve refusal
                  </button>
                  <p className="g-note">
                    Public visitors cannot edit policy, invent beneficiaries or
                    generate a new financial campaign. Paid model providers are
                    disabled.
                  </p>
                </>
              )}
              <footer className="g-footer">
                <span>TreasuryPilot · Autonomous Cash Governor</span>
                <span>
                  Synthetic operating context / real Airwallex Sandbox evidence
                  / no real money
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      <Inspector
        variant="governor"
        open={!!decision}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined);
        }}
        title={decision?.obligation.title ?? "Decision"}
        description="Deterministic decision · synthetic obligation · real provider context"
      >
        {decision && (
          <>
            <div className="decision-hero">
              <strong>
                {formatMoney(
                  decision.obligation.amount,
                  decision.obligation.currency,
                )}
              </strong>
              <Status
                tone={
                  ["DEFER", "ESCALATE"].includes(decision.action)
                    ? "warning"
                    : "safe"
                }
              >
                {labels[decision.action]}
              </Status>
            </div>
            <section className="inspector-section">
              <h3>Why this decision</h3>
              <p>{decision.reason}</p>
              <dl className="detail-list">
                <div>
                  <dt>Due / priority</dt>
                  <dd>
                    +{decision.obligation.dueHours}h /{" "}
                    {decision.obligation.priority}
                  </dd>
                </div>
                <div>
                  <dt>USD funding cost</dt>
                  <dd>{formatMoney(decision.cost)}</dd>
                </div>
                <div>
                  <dt>Operational criticality</dt>
                  <dd>
                    {world?.obligations
                      .find((o) => o.id === decision.id)
                      ?.criticality.replaceAll("_", " ")}
                  </dd>
                </div>
                <div>
                  <dt>Late cost / day · synthetic assumption</dt>
                  <dd>
                    {formatMoney(
                      world?.obligations.find((o) => o.id === decision.id)
                        ?.lateCostPerDay ?? 0,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Transfer corridor</dt>
                  <dd>
                    {
                      world?.obligations.find((o) => o.id === decision.id)
                        ?.transferMethod
                    }{" "}
                    ·{" "}
                    {world?.obligations
                      .find((o) => o.id === decision.id)
                      ?.beneficiaryStatus.replaceAll("_", " ")}
                  </dd>
                </div>
                <div>
                  <dt>Fees</dt>
                  <dd>
                    Fresh provider validation required before any new execution
                  </dd>
                </div>
                <div>
                  <dt>Authority</dt>
                  <dd>
                    {decision.approvalRequired
                      ? "Approval required"
                      : "Within planning mandate"}
                  </dd>
                </div>
                <div>
                  <dt>Minimum reserve</dt>
                  <dd>{world && formatMoney(world.policy.reserve)}</dd>
                </div>
                <div>
                  <dt>Evaluation</dt>
                  <dd>
                    Revision {decision.revision} ·{" "}
                    {new Date(decision.evaluatedAt).toLocaleTimeString("en-GB")}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="inspector-section">
              <h3>Evidence and dependencies</h3>
              <div className="dependency-tags">
                {decision.dependencies.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <p className="muted-copy">
                Context {latest?.contextVersion.slice(0, 12)}. Changes to a
                dependency can reopen this decision; unaffected evaluations
                retain identity.
              </p>
            </section>
            <section className="inspector-section">
              <h3>What would change this decision?</h3>
              <p>
                {decision.action === "ESCALATE"
                  ? "A verified receipt assigned to the operating mandate, or an operator resolution of the shortfall."
                  : decision.action === "DEFER"
                    ? "Confirmed liquidity after higher-priority commitments and a revised spending mandate."
                    : "A change to cost, obligation, available mandate or confidence-dependent authority."}
              </p>
              {decision.id === "logistics" && transfer ? (
                <div className="g-completed">
                  <CheckCheck size={20} />
                  <div>
                    <strong>
                      Original supplier transfer {transfer.status}
                    </strong>
                    <p>
                      Pre-existing Sandbox execution; repeating it is blocked.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="muted-copy">
                  Planning only. The completed supplier campaign cannot execute
                  additional invoices.
                </p>
              )}
              <button
                className="g-button secondary"
                onClick={() => {
                  setSelected(undefined);
                  navigate(
                    decision.id === "logistics"
                      ? "reconciliation"
                      : "approvals",
                  );
                }}
              >
                Inspect{" "}
                {decision.id === "logistics"
                  ? "financial evidence"
                  : "authority"}{" "}
                <ArrowRight size={14} />
              </button>
            </section>
          </>
        )}
      </Inspector>
      <Inspector
        variant="governor"
        open={guard}
        onOpenChange={setGuard}
        title="Reserve guard refuses the action"
        description="Deterministic policy demonstration · no financial API request"
      >
        <div className="decision-hero">
          <strong>{formatMoney(refusal?.after ?? 0)}</strong>
          <Status tone="warning">BLOCKED</Status>
        </div>
        <p>
          A USD 34,200 commitment against the current base mandate would leave{" "}
          {formatMoney(refusal?.after ?? 0)}, below the{" "}
          {world && formatMoney(world.policy.reserve)} reserve. Human approval
          cannot override this refusal.
        </p>
        <p className="g-note">Airwallex mutation: not requested.</p>
      </Inspector>
    </div>
  );
}
