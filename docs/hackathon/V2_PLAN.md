# V2 implementation plan

1. Preserve the adapter and historical operations; introduce typed domain world, configurable policy, revisioned plans and dependency-aware recalculation in deterministic server code.
2. Persist the full aggregate (obligations, receivables, evidence, revisions, approvals, operations, reconciliation, incidents and audit). Private Vercel Blob conditional ETag writes; local atomic immutable revisions for development/tests. Storage failures stop actions. No secret or raw beneficiary details in stored public views.
3. Import previous financial receipts as historical actions, compare live provider resources and fresh wallets with recorded expected movements. Distinguish historic balance reconciliation from a current unrelated wallet change. Uncertain/nonterminal results stay pending and cannot become replacement payments.
4. Compute operational currency targets/gaps within the bounded authority. Forecasts never fund execution; proposed placement never grants new permission. Preserve the campaign's original IDs and supplier-only execution.
5. Add a typed tool coordinator which observes, interprets reviewed context, plans, checks policy, verifies/reconciles and selects the next permitted step. Financial writes keep exact approval and current server context checks. Existing completed actions are read/reconciled, never reproduced.
6. Build a new cockpit over server state; retain v1 at `/treasury/v1` for regression and migration. Working navigation: Overview, Plan, Cash position, Evidence, Approvals, Reconciliation, Incidents, Audit and Policies.
7. Financial invariants/chaos tests, endpoint tests, Playwright at seven widths, live read-only hero scenario, sanitized evidence, screenshot inspection, docs and bounded deployment. Record coherent feature commits and truthful pre-build-period dates.

Optional accounting provider remains an interface with synthetic context; paid Claude stays disabled until explicit grant credentials/budget exist. Incident replacement is a gated proposal, never a new arbitrary money-out route. Public demo visitors can alter their own planning context; financial authority remains the single shared completed campaign.
