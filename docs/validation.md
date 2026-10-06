# Validation — v2, 6 October 2026

Windows, Node 24.13.1, Next.js 16.3.8 and React 19.3.0.

| Check                                       | Result                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Baseline v1                                 | 21 unit tests / 12 Playwright cases passed before refactor                         |
| Current Vitest                              | 50 tests across 9 files pass                                                       |
| Current Playwright                          | 24 cases pass; v1 retained and new cockpit covered                                 |
| Lint                                        | Pass, zero warnings                                                                |
| TypeScript                                  | Pass                                                                               |
| Local production build                      | Pass                                                                               |
| Runtime dependency audit                    | Zero vulnerabilities, npm audit --omit=dev                                         |
| Secret scan                                 | Zero known credential matches in source/evidence and built client files            |
| Actual local world                          | Private Blob persistence, refresh survival and conditional write verified          |
| Actual provider reconciliation              | FX / transfer / deposit / ending wallets all MATCHED                               |
| Selective replan                            | Delay 3 reopened; historical receipt allocation 1 reopened / 4 identities retained |
| Replay / forged command                     | Stale revision HTTP 409; extra execution amount HTTP 400; no write                 |
| Actual responsive captures                  | 375, 390, 768, 1024, 1280, 1440, 1920; no horizontal overflow                      |
| Actual browser                              | No page/console errors recorded                                                    |
| New financial operations in v2 verification | Zero                                                                               |

The actual live walkthrough records the current provider/fallback. Free inference may fail or be throttled; labelled deterministic extraction preserves review and treasury controls. A prior real free model response remains in original live-read evidence. No paid fallback is enabled.

Fixture tests are explicit and isolated from real provider evidence. HTTP failures, response loss, partial/uncertain operation claims, storage absence, strong-version refusal, quote/approval expiry, tampering, policy injection, stale context and nonterminal payment cases are tested.

Real storage validation detected compressed weak ETags that mocked tests missed. Identity-encoded downloads plus strong-version checks fixed conditional writes; a regression test now refuses weak versions. No concurrency protection was removed to make the demo pass.

Original financial operations are dated 3 October. The v2 script blocks banking mutations, compares unchanged real wallets and never resets IDs. Current calculated reserves use observed indicative rates; historical deposit reserve is separate.

Five development-only linter advisory paths remain disclosed in security-and-limitations.md. Final deployment readback and production screenshots are recorded in docs/evidence/v2/deployed-verification.json and docs/screenshots/v2/deployed.
