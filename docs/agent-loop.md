# Agent loop and typed tools

A cycle observes provider state, normalizes context, detects material changes, calculates the plan, enforces policy, reconciles instructions and derives the next allowed step. It persists results before displaying success.

Strict commands: observe, run_cycle, interpret_context, accept_context, allocate_receipt, open_incident, escalate_incident, request_human_approval, approve_action and execute_action. Every command binds its observed revision. Arbitrary amounts, URLs, beneficiaries and policy overrides are rejected. GET returns the financial world without credentials.

The server chooses ESCALATE for mismatches/escalated incidents, RECONCILE for pending outcomes, REVIEW_CONTEXT for unaccepted facts, REQUEST_APPROVAL for the unpaid fixed campaign above authority, otherwise MONITOR.

The interpreter receives untrusted text and no tools. It returns facts, never confidence, policy or payment commands. Only allowlisted zero-priced OpenRouter models are available, with catalog checks and zero provider ceilings. Throttling/unavailability/malformed output produces a labelled deterministic parser. Bounded timeouts keep interpretation within the route budget. A future grant-funded provider must implement the same contract and gains no financial authority.

The 60-second visible-page cycle sends financial GETs, never automatic financial writes. Explicit exact approval is required for execution. Lost responses leave a context lock and permanent operation claim. Subsequent cycles inspect the original resource; missing/nonterminal results never authorize duplication.

This is state-driven deterministic orchestration with bounded tools, not a model with unrestricted HTTP access.
