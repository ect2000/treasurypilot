# Verification evidence

JSON amounts are integer minor units; Airwallex requests use major units.

local-/deployed- files come from scripts/verify-governor.ts against actual servers: before/after snapshots, initial/delayed/receipt plans, forecast, interpretation, approval disclosure, financial aggregate, reconciliation, placement and verification summary.

The script blocks execution commands and asserts no new wallet delta. It persists reviewed application context, receipt allocation and complaint, without sending funds. Fixtures are separate from this actual evidence.

Original FX/transfer/deposit remain in parent financial-actions.json and deposit-action.json and are marked PRE_EXISTING_V1. No missing historical approval token is invented. Current model/fallback is recorded truthfully.

Historical receipt delta: EUR +8,000. New v2 wallet delta: zero. Current reserve can differ from historical USD 17,025.12 because rates change; use each capture timestamp.

No credential, auth token, raw recipient detail or Global Account ID belongs here.

deployment.json identifies the immutable hosted build and its runtime source commit. Documentation and evidence may have a later Git commit without changing that deployed runtime. The final deployed walkthrough at 2026-10-06T08:55:39.985Z records successful free inference, one reopened decision, four unchanged decisions, USD 16,999.53 remaining planned reserve and four reconciliation matches.
