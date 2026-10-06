# Controls and limits

A bounded public Airwallex Sandbox demonstrator, not production banking or an authenticated treasury SaaS.

Controls: exact Sandbox origin/redirect refusal; server-only credentials; strict tools/origin checks; bounded allocation/reserve; forecast never funds execution; stable campaign IDs; provider read-before-write; exact beneficiary/wallet/quote/context approval fingerprints; approval/quote expiry and operator cutoff; private aggregate revisions; permanent global operation claims; execution locks; no blind financial POST retry.

Public views strip sealed proposal/approval payloads, banking credentials, auth tokens and raw beneficiary/Global Account IDs. Audit correlations identify operations/resources, never secrets. The scanner checks credential values against source, evidence and client bundles, including Blob/OIDC credentials.

Deployment requires private Blob and strong conditional-write versions. Missing storage/weak ETags stops actions. Local immutable revisions publish complete JSON atomically. Uncertain claims remain claimed. There is no financial identity reset endpoint.

The tools-free model returns validated facts for review. Deterministic instruction detection rejects policy/credential/payment overrides even if the model misses them. Only zero-priced allowlisted models can run; unavailable inference is visibly deterministic.

All visitors read one Sandbox account. Sealed cookies isolate application context, not authenticated bank operators. Only the completed fixed supplier campaign can execute; additional obligations/placement are planning-only. No general replacement transfer, signed webhooks, verified invoices or ERP is implemented.

v2 centrally stores plans, approvals and audit; it supersedes v1 browser-local convenience history. It is not independently immutable regulatory storage or a double-entry ledger. Broader execution needs authenticated operators, complete multi-campaign reservations and external reconciliation.

Wallet variance may be external activity. Matching provider resources does not prove real bank settlement. PAID was deliberately simulated. Late costs are synthetic assumptions; exact new fees require validation. Indicative placement never executes automatically.

Polling runs only while visible. Token cache is per warm instance; 401 invalidates without financial replay. No lost response creates a fresh operation ID.

Runtime audit is clean. Five development-only advisory paths remain in the linter braces graph, with no compatible patched version at the recorded check. Do not force incompatible toolchain downgrades. Never reset IDs/extend the existing window to repeat a recording.
