# Validation — final hardening, 6 October 2026

Windows, Node 24.13.1, Next.js 16.3.8, React 19.3.0. Fixture tests and actual financial observations are separate evidence.

| Check                    | Result                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest                   | 68 tests / 11 files pass                                                                                                                                   |
| Playwright               | 30 cases pass, desktop/tablet/mobile; v1 preserved                                                                                                         |
| Lint / typecheck         | Pass                                                                                                                                                       |
| Local production build   | Pass                                                                                                                                                       |
| Hosted release           | Commit/version/build status recorded in [deployment.json](evidence/v2/deployment.json)                                                                     |
| Runtime dependencies     | npm audit --omit=dev: zero vulnerabilities                                                                                                                 |
| Development dependencies | Five advisory paths rooted in unpatched braces development/linter graph; disclosed                                                                         |
| Secrets                  | Known values/patterns: source/evidence, built client, practical Git history, actual public HTML/JS; zero matches                                           |
| Real local/public hero   | Actual free-provider interpretation, confidence 92%→31%, autonomy USD 10k→2.5k, receipt 1 reopened/4 retained, four reconciliations MATCHED                |
| Financial mutations      | Zero new deposit, FX, transfer or transfer-state simulation; zero new wallet delta                                                                         |
| Persistence              | Actual Blob, browser refresh/new request and [local production process restart](evidence/v2/persistence-restart.json); no forced Vercel cold start claimed |
| Rejection behavior       | Stale revision 409, forged command 400, resource limit 429; no success invented                                                                            |
| Responsive captures      | 375×812, 390×844, 768×1024, 1024×768, 1440×900, 1920×1080; no overflow                                                                                     |
| Accessibility            | Semantics/labels/chart summaries/reduced motion, keyboard focus trap and restore, expired approval control tested; not exhaustive WCAG certification       |
| Browser/performance      | Actual first useful view and API timing captured; no recorded page/console errors                                                                          |

Current timestamps, exact models, rates, reserve cents and timing measurements are in [local](evidence/v2/local-verification.json) and [public](evidence/v2/deployed-verification.json) summaries. Original financial mutations are dated 3 October and never rerun. Current indicative GBP rates can change the receipt-plan reserve; initial USD 18,828.13 belongs to plan-001, not the receipt plan. The original historical USD 17,025.12 remains explicitly historical.

Meaningful added regressions cover singleton resource admission/CAS/daily rollover/lifetime retention; exhausted admission before networking/fallback; tier boundaries; received/out-of-horizon forecast consistency; concurrent FX/transfer and claims after lost response; changed plan/wallet/beneficiary/quote/expiry; cutoff closing during authentication; mismatch cannot clear execution lock; manual escalation persists; unparsable quote expiry; UI cents/approval expiry; keyboard focus. An actual provider GBP move during receipt readback exposed excessive replanning: a new regression retains four independent decisions while updating contractor cost. Subsequent rate-only refresh also retains unaffected decisions.

Actual storage testing previously detected weak compressed ETags that mocks missed. Identity encoding plus strong-version refusal preserve CAS. Process testing distinguishes immutable identity from refreshed observation timestamps. No financial boundary was weakened to make a test green.

The [final audit](hackathon/FINAL_TECHNICAL_AUDIT.md), [fix report](security/FIX_REPORT.md), [evidence index](evidence/INDEX.md) and [runbook](demo/DEMO_RUNBOOK.md) disclose coverage, public-demo limits and recovery. No offensive public load test, exhaustive penetration test, production banking certification or new supplier authorization is claimed.
