# TreasuryPilot v1 baseline

Recorded 6 October 2026, before implementation of the Autonomous Cash Governor iteration.

- Baseline: `041a430556958f4b9aaebc6eed18b07aa6427a8a`.
- Tag: `pre-agentic-banking-v1`. Branch: `agentic-banking-2026`.
- Working tree was clean. Existing work was already committed; no synthetic history was created.
- v1 supplied Next.js, the restrained dark UI, five synthetic obligations, 72-hour planning, confidence-dependent limits, free-only OpenRouter interpretation, exact encrypted approval binding, and the Airwallex Sandbox adapter.
- Its actual conversion sold USD 15,971.87 for EUR 14,000. Its EUR 14,000 supplier transfer reached PAID through Sandbox SENT/PAID simulation. A single EUR 8,000 deposit was already settled. These are pre-existing financial actions, not v2 accomplishments. Their campaign/request identities must survive this iteration.
- Baseline verification: 21 unit tests and 12 Playwright cases passed; real local API reads and desktop screenshot completed. Screenshot: `docs/screenshots/v1/baseline.png`.

## Competition provenance

The [official page](https://airwallex.hackerearth.com/) checked on 6 October states applications close 23 October, the official build period begins 25 October, submissions are due 13 November, and Demo Day is 19 November. The walkthrough must be **under five minutes**. Its marketing also says “48 hours” and “3 weeks”; the dated timeline is recorded rather than resolving this inconsistency by assumption.

v1 and this 6 October preparation predate the official build period. Do not describe them as built inside that period. The accessible landing page does not establish eligibility of pre-existing projects. The [HackerEarth portal](https://www.hackerearth.com/community/challenges/hackathon/agentic-banking-hackathon/) links registration, but full entry terms/submission fields could not be verified from its public rendered content. Eligibility and provenance acceptance remain organizer questions before submission. No registration, organizer message or irreversible submission is performed here.

Primary technical sources: [Developer Lab guide](https://airwallexdev.com/guide), [Sandbox setup and MCPs](https://airwallexdev.com/), [API reference](https://www.airwallex.com/docs/api), and live hosted Docs MCP. Developer MCP responds HTTP 405 to a plain GET (reachable transport, not authenticated tool access); it is not exposed as a callable developer tool in this session. The already authenticated REST adapter remains the financial integration.
