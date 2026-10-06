# Reconciliation and incident safety

Creation success is not completion. Rows compare recorded instructions, fresh observed resources, currency corridors, terminal status and variance.

| Resource | Expected                                                                                     |
| -------- | -------------------------------------------------------------------------------------------- |
| FX       | USD -15,971.87, EUR +14,000; original ID; SETTLED                                            |
| Transfer | EUR -14,000; original ID; PAID in Sandbox                                                    |
| Deposit  | Historical exact EUR +8,000 delta and fresh SETTLED resource                                 |
| Wallet   | Current available balances against recorded campaign ending balances, separately by currency |

MATCHED requires agreement. Missing/nonterminal resources remain PENDING. Amount/corridor differences or failed/cancelled/returned outcomes require investigation. Wallet variance may be newer external activity; it never proves an original payment failed.

Complaints store the original identity, operator message, provider history and decision. PAID → INVESTIGATE; nonterminal → WAIT, or ESCALATE past deadline. FAILED/CANCELLED requires verified returned funding before replacement is eligible. A lost HTTP response never means “pay again.”

The current original is PAID. The deployed demo exposes investigation and replacement refusal, not a second transfer route. Tests cover nonterminal/failure/cancellation/funding-return cases without manufacturing another financial action.

Currency-placement proposals conservatively conserve indicative value and reserve. Guaranteed quotes, exact fees and a separate operator mandate would be required to execute them. Matching Sandbox records does not establish real bank settlement.
