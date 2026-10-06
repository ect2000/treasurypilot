# Work provenance

All dates are actual preparation dates, before the official 25 October build start. No history was manufactured to resemble work inside the build window.

| Date       | Feature                                                                        | Commit                  | Why / evidence                                                                                                   |
| ---------- | ------------------------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 2026-10-03 | Pre-existing v1 adapter, UI, FX, transfer and deposit                          | 041a430 baseline        | Original financial-action JSON; not v2 financial work                                                            |
| 2026-10-06 | Audit, tagged baseline, current rules and UX/architecture plan                 | c4e76d2                 | 21 baseline unit / 12 browser cases; v1/baseline.png                                                             |
| 2026-10-06 | Normalized financial world and central durable state                           | e9b3ea3                 | Persisted obligations, receivables, context and plans                                                            |
| 2026-10-06 | Selective planning and centrally invalidated approvals                         | e9b3ea3                 | Delay 3 reopened; receipt 1 reopened / 4 unchanged                                                               |
| 2026-10-06 | Reconciliation, currency placement and incident safety                         | e9b3ea3                 | Four real provider matches; current/target/gap; duplicate refusal                                                |
| 2026-10-06 | Typed tools, operation claims and execution locks                              | e9b3ea3                 | Strict schemas, stable campaign and uncertain-response protection                                                |
| 2026-10-06 | Strong ETag writes, atomic local publication and committed-event correlations  | 76a4814                 | Real Blob round-trip uncovered weak compressed ETag; fixed without weakening CAS                                 |
| 2026-10-06 | Free-provider abstraction, financial/model chaos validation and secret scanner | 76a4814                 | 50 unit tests including 401/429/500, malformed output, timeout, injection, concurrency                           |
| 2026-10-06 | Responsive nine-section cockpit, charts, inspectors and v1 migration           | 559388c                 | 24 Playwright cases; seven-width actual captures; v1 preserved at /treasury/v1                                   |
| 2026-10-06 | Exact approval/action/provider audit correlations                              | 2958f8f                 | Each approval maps to its own operation; unrelated receipt IDs are excluded                                      |
| 2026-10-06 | Documentation, genuine local production captures and recording script          | 3a259a3                 | Real free inference, Blob persistence, no banking replay                                                         |
| 2026-10-06 | Forward forecast excludes the already-paid original supplier                   | f5b154e                 | Opening cash agrees with current operating position; payment is not projected twice                              |
| 2026-10-06 | Final hosted build and actual public walkthrough                               | f5b154e deployed source | READY deployment; real free inference; one reopened / four unchanged; four matches; zero new financial mutations |

Original financial request IDs remain unchanged. Deployment verification is recorded after the hosted build, not claimed from fixture tests.

v2 verification creates application workspaces, reviewed context, receipt allocation and incident records. It sends no new deposit, conversion, supplier transfer or transfer-state simulation. Provider resources remain PRE_EXISTING_V1. Pre-existing-work eligibility requires organizer confirmation.
