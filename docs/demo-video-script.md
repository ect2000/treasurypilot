# Demo narration — target 2:50

No recording is claimed here. Use the genuine one-time before/deposit/after screenshots or footage captured during the single Sandbox execution. Do not press the deposit action again or reset its campaign identity. Confirm final competition duration rules before submission.

| Time | Screen and action | Narration |
| --- | --- | --- |
| 0:00–0:16 | Open workspace; show actual USD, EUR, GBP and CNY balances | “TreasuryPilot starts with live Airwallex Sandbox balances. The wallet is large, but agent authority begins at a $48,000 base allocation with a protected $15,000 reserve.” |
| 0:16–0:36 | Show five synthetic obligations and initial treasury plan | “Five obligations compete over the next 72 hours. Code ranks them and decides pay, convert and pay, defer or escalate. A forecast is not spendable cash.” |
| 0:36–0:58 | Show customer-delay email, interpretation and reviewed acceptance | “A customer reports a five-day delay. The interpreter extracts that fact; a human reviews it before any policy input changes.” |
| 0:58–1:17 | Show confidence and autonomy after accepted evidence | “Confidence falls from 92 to 31 percent, and autonomy from $10,000 to $2,500. The UK contractor is now escalated because the delayed receipt cannot fund it.” |
| 1:17–1:35 | Show reserve-blocked hypothetical action | “A proposed $34,200 allocation would leave $13,800. The deterministic guard rejects it below the $15,000 reserve, regardless of an AI suggestion or human approval.” |
| 1:35–1:57 | Show [before deposit](screenshots/11-deposit-before.png), the explicit Sandbox action, then [after deposit](screenshots/12-deposit-after.png) | “The operator simulated one €8,000 customer deposit into the existing EUR Global Account. Airwallex shows the EUR balance rising from €10,000,000 to €10,008,000. That is an exact provider-verified delta, not an animated fake.” |
| 1:57–2:19 | Show BEFORE / DEPOSIT / AFTER and highlighted contractor | “Only one decision reopens. Four decisions keep their identities and timestamps. The contractor changes from ESCALATE to planned CONVERT + PAY. The resulting reserve is $17,025.12; no contractor payment is executed.” |
| 2:19–2:37 | Show previously verified FX and supplier transfer evidence | “The earlier real Sandbox campaign spent USD 15,971.87 to buy EUR 14,000, then created the supplier transfer. Its PAID state is a clearly labelled Sandbox simulation. We did not repeat those actions.” |
| 2:37–2:50 | Show [audit trail](screenshots/13-deposit-audit.png) and export | “The audit shows DEPOSIT_SIMULATED, BALANCES_REFRESHED and PLAN_RECALCULATED. The public demo is read-only for deposit writes, and the one-time campaign cannot replay.” |

The deposit action was executed once. The provider created a settled deposit, but its simulation response omitted the optional `statement_ref` field and the initial local route returned a 400 after the POST. A durable lock prevented another POST. Read-only deposit and balance GETs established the settled provider record and exact +€8,000 delta; the response guard now tolerates the omitted field. Explain this honestly if asked.
