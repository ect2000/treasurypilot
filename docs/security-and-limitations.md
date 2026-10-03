# Financial authorization and practical limits

TreasuryPilot is a bounded public Sandbox demonstration, not an accounting ledger or production banking system.

## Boundaries implemented

1. Exact origin check: only `https://api.sandbox.airwallex.com` is allowed. Redirects are refused. A trailing slash, HTTP origin, suffix hostname or production host fails closed.
2. Credentials and authentication cache exist only in server modules. No `NEXT_PUBLIC_` banking credentials. Client ID, API key and bearer token never enter API responses, evidence exports or logs.
3. USD 48,000 authorized envelope and USD 15,000 reserve are deterministic constants. Unallocated test wallet liquidity is not authority. Forecast receipts never fund an execution.
4. Public financial execution is limited to ONE fixed critical supplier lifecycle: EUR 14,000 bought using at most USD 18,000, followed by one EUR 14,000 local transfer. Other obligations and imported invoices are planning-only. This restriction avoids a database and prevents arbitrary visitor-controlled financial operations.
5. Stable campaign-derived UUIDs are shared across sessions and retries. Existing provider transactions are checked before a new mutation. Airwallex request-ID duplicate protection prevents parallel submissions of the same operation from creating multiple transactions. A lost or rejected local response is reconciled before another attempt.
6. Fingerprints include action, obligation, amounts, currencies, quote, financial wallet state, full beneficiary hash, reserve, forecast, state revision, campaign and request ID. Financial execution re-reads the wallet, beneficiary and quote. Accepted forecast changes invalidate approvals through the signed session revision.
7. AES-256-GCM sealed authorization tokens conceal their content and detect tampering. Five-minute approval lifetime, quote expiry and an explicit execution cutoff are enforced. Cookie is HTTP-only, same-site strict and secure in deployment.
8. Server-side authorization independently recomputes policy. Client-supplied PASS, cost, amount, recipient, reserve or autonomy fields are rejected by strict schemas. Human approval cannot override a failed reserve or campaign cap.
9. Untrusted documents go only to a tools-free interpretation provider. Strict candidate schemas accept facts, not permission changes. Imported invoices require review and cannot enter the fixed financial campaign. Prompt-injection markers are flagged.
10. OpenRouter permits only the two configured free model IDs. Catalog pricing is checked, provider price caps are zero, and paid fallbacks are disabled. Provider failure returns a labelled deterministic fallback.

## Deliberate limits

- No authentication, multitenancy, database or general payment API is implemented. All visitors view the same test account and fixed financial campaign. The demo is unsuitable for production or arbitrary payment execution.
- The execution cutoff is a short operator-controlled window. Keep it within Airwallex's transfer request-ID duplicate protection period (seven days). Do not extend a campaign or reuse its IDs for a different amount. A new validation campaign requires deliberate operator configuration and a fresh bounded window.
- Local audit and plan history are convenience records, not immutable durable audit storage. Airwallex is the financial source of truth. No claim of exactly-once infrastructure across arbitrary campaigns, unlimited historical pagination or independent external account activity is made.
- Forecast/session cookies are sealed but there is no central session revocation service. The fixed campaign cap, current live wallet/beneficiary/quote checks and short-lived approvals bound the exposure. This is not a reusable approval architecture for unbounded payments.
- Token caching is per warm server instance; a serverless cold start authenticates again. A 401 invalidates the token. A financial POST is never blindly replayed with a fresh request ID.
- No webhook signature handling is implemented. State is refreshed through provider GETs. Transfer PAID in the evidence was produced by a labelled Sandbox simulation.
- Free provider availability/quota varies. Model interpretation is not required for reserve safety. Catalog verification and malformed output failures fail to a labelled local parser.
- Fixed demo time offsets represent a scenario horizon, not a real invoice due-date scheduler. Uploaded text is not proof that an invoice is genuine.
- The installed linter dependency graph currently has five high-severity development-only advisory paths rooted in `braces` stack exhaustion. Registry latest `braces` remains 3.0.3 and no compatible patched release was available at verification. `npm audit --omit=dev` reports zero vulnerabilities. Lint pattern inputs are local configuration, not browser-provided documents.

## Before extending financial execution

Use durable atomic reservations and a durable idempotency/approval ledger, independent operator authorization, precise fee handling, paginated reconciliation, centrally revocable approvals, authenticated webhook updates and recipient verification. These are not added merely to make the hackathon demo heavier.
