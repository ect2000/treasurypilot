# V1 forensic audit

6 October 2026. Read source, API routes, adapter, authorization, deposit locking, AI, money/planner, tests, scripts, configuration, docs and existing evidence; ran the application and baseline suites before implementation.

## WORKING

Exact Sandbox origin guard; scoped credentials confined to server; coalesced login; strict request schemas; decimal major/minor conversion; live balances, indicative FX and existing account/beneficiary reads. Fixed-campaign FX and transfer use stable distinct UUIDs, exact quote/wallet/beneficiary/forecast binding, expiry and provider read-before-write. Paid transfer and settled conversion verified by fresh reads. One-time deposit latch and immutable statement reference protected the previously ambiguous response from being replayed. All 21 unit/12 browser cases pass.

## PARTIALLY WORKING

Policy planning is client computed while financial authorization is server enforced. Decision signatures preserve semantic identity but candidate planning reevaluates all inputs; no durable plan revision model. Deposit proof is committed evidence plus local lock; the hosted mutation is correctly unavailable. Quote single-use has provider/campaign protections but no application operation ledger. “Verified” means provider resource readback, not a first-class expected/observed accounting comparison. Approvals are sealed rather than durably inspectable. Audit is mainly browser local. Financial operations support only the fixed EUR supplier, intentionally.

## BROKEN

No baseline functional failure reproduced. Cannot claim durable audit across browsers, full reconciliation or continuous agent orchestration. Initial deposit POST had a local response-shape rejection after provider acceptance; subsequent read-only reconciliation recovered it without retry. This historical ambiguity is disclosed, not erased.

## MOCKED

Five invoices, USD 48,000 operating authority and USD 20,000 forecast are deliberately synthetic. Actual Sandbox wallet balances are about ten million per funded currency: this account is not cash-poor. The constrained allocation, not invented bank balances, creates the planning problem. Test network fixtures are test-only. PAID is a provider Sandbox simulation, not real bank settlement.

## UNUSED

No database or partner integration exists. Imported invoices are planning only. Additional beneficiaries and unallocated funds do not grant execution permission. Historical scripts capable of financial mutation must not be rerun for screenshots.

## MISSING

Server-owned financial world; durable revision/approval/action/incident/audit records; reconciliation ledger with mismatch detection; currency placement; safe exception workflow; typed orchestration and operation-state locks; chaos tests for ambiguous outcomes; configurable policy tiers; contextual status freshness and structured correlation logs.

## UX_DEBT

Large single component. Planning and evidence updates involve manually navigating tabs. Recent provider evidence can obscure the before/after planning story. Authority and provider cash have separate concepts but require too much explanation. No dedicated cash-position, approval queue, reconciliation or incident surface. Browser-local audit is a material limitation.

## VISUAL_DEBT

Solid v1 composition, typography, drawer and monetary formatting; desktop screenshot has no horizontal overflow. Long overview stacks chart, receipt, ledger, wallets, evidence and footer. Warm orange drives routine actions; a quieter mint system can connect safety, authority and liquidity. Chart capture must wait for animation; reference reserve must derive from policy. Dense desktop content needs explicit small-screen prioritization and all seven requested widths.
