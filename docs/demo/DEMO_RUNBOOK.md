# Safe recording runbook

Use the live [cockpit](https://treasurypilot-sooty.vercel.app/treasury) at 1440×900. The [4:40 script](../demo-script.md) fits the official under-five-minute limit. Source branch: agentic-banking-2026. Verify `/api/version` against [deployment evidence](../evidence/v2/deployment.json).

## Exact starting state

The saved [video-ready evidence](../evidence/v2/video-ready.json) records actual timestamp, world/context/plan IDs and rates. Start at plan-001, confidence 92%, autonomous FX limit USD 10,000, receiptApplied=false and no accepted delay. Five synthetic obligations: EUR 14k logistics (already PAID in Sandbox), USD 8,200 cloud, GBP 7,500 contractor, USD 5,000 insurance, USD 6,000 discretionary marketing. Synthetic mandate USD 48,000; floor USD 15,000; expected USD 20,000 at +24h; initial reserve USD 18,828.13.

Real available wallets: USD 9,984,028.13; EUR 10,008,000; GBP/CNY 10,000,000. The original EUR 8,000 deposit is already settled and included in the real wallet. Only its operating-plan authority allocation is initially unapplied. Do not imply the bank deposit happens again.

## Prepare and open

From the repository, with the existing server environment already configured:

```powershell
npx tsx scripts/prepare-video.ts
npx tsx scripts/prepare-video.ts --open
```

The first command permits GETs only, creates or reuses a bounded initial planning context, saves a **private ignored** browser cookie state and emits sanitized evidence. The second opens that saved context for recording. Do not share `.operator/video-ready-storage-state.json`. A normal browser can alternatively start in a fresh private profile; this creates a new planning context, not a bank campaign.

If the saved planning take has progressed or its seven-day cookie expired, keep its evidence and rename only the saved browser-state file before preparing another take. Never remove `.operator/deposit-TPKIT1-2026-ONE.lock`, global financial claims, original evidence or EXECUTION_CAMPAIGN. Do not extend the execution window. There is no banking reset endpoint.

## Steps and checkpoints

1. Overview: show separate actual wallets and synthetic mandate; original supplier already deducted from forward opening cash.
2. Plan: five obligations, initial USD 18,828.13 reserve. Contractor DEFER, marketing DEFER; existing supplier labelled Verified PAID.
3. Evidence: interpret the provided five-day delay. Show the actual free provider/model, or visible deterministic fallback. Facts remain unaccepted until operator review.
4. Accept evidence: confidence 31%, FX authority USD 2,500; three evaluations reopened, two retained. Cloud/insurance now require approval; contractor ESCALATE. Initial plan remains SUPERSEDED. No forecast funds become cash.
5. Approvals: show approval requirements; non-supplier proposals are planning-only. Use the dated original approval inspector footage for exact supplier authorization. Do not create a new approval for the completed campaign.
6. Policies: inspect USD 34,200 proposed spend → USD 13,800 remaining → refusal against USD 15,000 floor. This does not submit a financial operation.
7. Evidence: show historical BEFORE EUR 10m, DEPOSIT EUR 8k, AFTER EUR 10,008,000, actual settled receipt. Click **Allocate verified receipt & replan** once. This changes synthetic authority, not the actual wallet.
8. Plan: contractor ESCALATE → CONVERT + PAY; one reopened, four unchanged identities/timestamps. It still requires approval and remains planning-only. Reserve must be ≥ USD 15k; read its exact cents/current plan ID. GBP rates vary: never narrate an old fixed receipt-plan reserve as live.
9. Original financial footage/evidence: dated 3 October FX USD 15,971.87 → EUR 14k, supplier EUR 14k PAID through explicit Sandbox SENT/PAID simulation. No real settlement or second payment is claimed.
10. Reconciliation: FX, transfer, deposit and current recorded-wallet comparison should be MATCHED. A variance means investigate actual data, not edit proof or fabricate zero variance.
11. Cash position: current/target/gap, conservative indicative proposals and reserve. Proposals do not execute.
12. Incidents: supplier complaint investigates the original payment, no replacement. Audit: context → plan → original resource → reconciliation; export sanitized evidence.

The automated hero uses these steps, blocks all banking execution routes/tools, checks unchanged wallets/decision evaluations, and records actual timings/screenshots. Run `npm run verify:governor` with VERIFY_URL set to the site for a separate validation context.

## Recovery during recording

| Symptom                                        | Safe response                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Free model throttled/unavailable               | Keep the labelled deterministic candidate, review it, continue; do not call it model reasoning. No paid fallback.                                                                    |
| Provider/Blob timeout                          | Wait for the error; refresh current context. Do not double-click or reconstruct a banking action.                                                                                    |
| HTTP 409                                       | Refresh; use the current revision. Do not replay an old approval.                                                                                                                    |
| HTTP 429 demo quota                            | Stop the take. Existing evidence remains readable. Daily provider budget may reopen next UTC day; lifetime world cap does not reset. Never delete the ledger/claims to bypass it.    |
| Context retained-state limit                   | Export evidence. Use a fresh bounded planning browser context for a new take; financial campaign identities remain unchanged.                                                        |
| Unexpected wallet/reconciliation difference    | Investigate original provider IDs privately; preserve the exception. Do not edit recorded ending wallets to force MATCHED.                                                           |
| Rate drift reopens another affected evaluation | This is real material context; explain it or restart the planning take. Do not freeze/fake provider rates as live.                                                                   |
| Expired approval                               | No execution control should remain visible. Obtain fresh exact authorization only for an actually eligible unfinished campaign; this completed campaign is not replayed.             |
| Lost financial response/uncertain claim        | No new ID, no automatic retry/replacement. Private original-resource readback only. Never delete a claim.                                                                            |
| Local admission lock left by a crashed process | Stop local processes, inspect only the resource-budget lock and complete ledger, preserve permanent financial locks. Manual operator recovery; no automatic uncertain-lock deletion. |

Prepare immediately before filming. Visible polling every 60s consumes bounded observations/revisions, so do not leave a prepared tab idle for hours. Browser refresh and a new server process retain private Blob state. Final narration/encoding/upload and competition eligibility/submission remain human release steps.
