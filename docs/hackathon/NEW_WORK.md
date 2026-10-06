# Work provenance

All dates are actual preparation dates, before the official 25 October build start. No history was manufactured to resemble work inside the build window.

| Date       | Feature                                                                        | Commit           | Why / evidence                                                                         |
| ---------- | ------------------------------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------- |
| 2026-10-03 | Pre-existing v1 adapter, UI, FX, transfer and deposit                          | 041a430 baseline | Original financial-action JSON; not v2 financial work                                  |
| 2026-10-06 | Audit, tagged baseline, current rules and UX/architecture plan                 | c4e76d2          | 21 baseline unit / 12 browser cases; v1/baseline.png                                   |
| 2026-10-06 | Normalized financial world and central durable state                           | e9b3ea3          | Persisted obligations, receivables, context and plans                                  |
| 2026-10-06 | Selective planning and centrally invalidated approvals                         | e9b3ea3          | Delay 3 reopened; receipt 1 reopened / 4 unchanged                                     |
| 2026-10-06 | Reconciliation, currency placement and incident safety                         | e9b3ea3          | Four real provider matches; current/target/gap; duplicate refusal                      |
| 2026-10-06 | Typed tools, operation claims and execution locks                              | e9b3ea3          | Strict schemas, stable campaign and uncertain-response protection                      |
| 2026-10-06 | Strong ETag writes, atomic local publication and committed-event correlations  | 76a4814          | Real Blob round-trip uncovered weak compressed ETag; fixed without weakening CAS       |
| 2026-10-06 | Free-provider abstraction, financial/model chaos validation and secret scanner | 76a4814          | 50 unit tests including 401/429/500, malformed output, timeout, injection, concurrency |
| 2026-10-06 | Responsive nine-section cockpit, charts, inspectors and v1 migration           | 559388c          | 24 Playwright cases; seven-width actual captures; v1 preserved at /treasury/v1         |

Documentation/evidence commit can be resolved with git log -- docs/evidence/v2/README.md; it records actual verification and source rather than inventing new banking actions. Original financial request IDs remain unchanged.

v2 verification creates application workspaces, reviewed context, receipt allocation and incident records. It sends no new deposit, conversion, supplier transfer or transfer-state simulation. Provider resources remain PRE_EXISTING_V1. Pre-existing-work eligibility requires organizer confirmation.
| 2026-10-06 | Exact audit correlation for approval/action/provider identities | Resolve with git log -- lib/server/governor.ts | Invalidated approval maps to its own ID; no unrelated deposit resource attached |
