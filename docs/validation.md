# Validation evidence

Verified 3 October 2026, Windows Node 24.13.1, Next.js 16.3.8, React 19.3.0.

| Check                         | Outcome                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Vitest                        | 19 tests pass across money/policy, authorization, REST adapters and origin handling                                      |
| ESLint                        | Pass, zero warnings                                                                                                      |
| TypeScript                    | Pass                                                                                                                     |
| Production build              | Pass locally and on Vercel                                                                                               |
| Playwright fixture suite      | 9 tests pass, 1440 / 1024 / 390 viewport widths                                                                          |
| Live browser                  | Real balances/plan/reserve guard, actual quote and exact approval, real conversion and payout; zero page errors          |
| Live financial reconciliation | Exactly one fixed campaign conversion and one fixed campaign transfer, confirmed by fresh reads                          |
| Transfer simulation           | SENT then PAID verified through GET; explicitly simulated                                                                |
| OpenRouter live inference     | Real `nvidia/nemotron-3-super-120b-a12b:free` returned validated delay evidence; saved in `docs/evidence/live-read.json` |
| Deployment live reads         | Public HTTP 200, actual provider financial evidence                                                                      |
| Deployment false approval     | Forged approval rejected with HTTP 400, no mutation                                                                      |
| Deployment evidence/replan    | Works; free-model HTTP 429 activated the explicitly labelled deterministic fallback                                      |
| Client/source secret scan     | Zero full credential matches in source and built public chunks                                                           |
| Runtime dependency audit      | `npm audit --omit=dev`: zero vulnerabilities                                                                             |

The existing OpenRouter account subsequently returned HTTP 429 for both approved free model IDs. This is a current free inference availability limitation, not a fabricated successful deployed LLM call. The genuine earlier response remains preserved. No paid fallback was attempted. The public interface continues through a labelled deterministic fact parser and the same deterministic treasury policy. Retry after the provider's free quota becomes available; changing to a paid model is deliberately rejected.

Fixtures are used only in the browser test suite. Public/live screenshot captures and deployed checks do not intercept or fabricate Airwallex/OpenRouter responses.

Five development-only npm advisory paths remain in the linter's `braces` dependency graph; no compatible patched registry release was available. See security limitations. This is disclosed separately from the passing runtime audit.
