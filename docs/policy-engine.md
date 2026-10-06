# Deterministic policy and selective plans

POLICY centralizes USD 48,000 allocation, USD 15,000 reserve, USD 8,000 receipt cap, USD 18,000 FX cap and the fixed EUR 14,000 supplier amount.

| Confidence |   FX limit | Transfer limit |
| ---------- | ---------: | -------------: |
| ≥85%       | USD 10,000 |     USD 10,000 |
| ≥60%       |  USD 5,000 |      USD 5,000 |
| <60%       |  USD 2,500 |      USD 2,500 |

Five synthetic obligations are ranked by operational priority and deadline. Funding costs use live indicative rates; the settled supplier uses actual USD 15,971.87. Sequential commitments must preserve reserve. Marketing is deferred. Expected receipts can explain deferral but never fund execution. A reviewed five-day delay deterministically assigns 31% confidence.

Normalized obligations record absolute scenario dates, criticality, synthetic daily late-cost assumptions, corridor availability and status. Late costs are inspectable assumptions; this demonstrator does not claim a global fee-optimized scheduler. Exact future payout fees require provider validation.

Semantic signatures, IDs, revisions, timestamps and dependencies identify decisions. Forecast-only changes evaluate forecast/authority dependents. Receipt allocation evaluates the liquidity-dependent shortfall. Unaffected decision objects survive. Rate/cost changes may legitimately reopen further decisions.

Fingerprints bind wallet state, rates, resources, deposit identity, forecast, policy and receipt allocation. Material changes supersede the plan and invalidate centrally stored pending/approved intents.

Execution independently checks exact amount/currency, campaign/request ID, full beneficiary hash, wallet fingerprint, fresh quote/expiry, reserve, approval lifetime and operator cutoff. Approval cannot override reserve or the fixed cap.

The hypothetical USD 34,200 commitment leaves USD 13,800 and is refused before banking execution. It is a policy example, not an executed transaction.
