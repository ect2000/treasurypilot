# TreasuryPilot — submission draft

**Tagline:** Adaptive treasury that knows what to pay, convert, defer or escalate.

**Live URL:** https://treasurypilot-sooty.vercel.app

**Public repository:** https://github.com/ect2000/treasurypilot

## Problem

A balance alone does not tell a finance operator what to do next. Five obligations, three payment currencies, uncertain receipts and a reserve requirement compete for attention. An unconstrained agent can confidently propose an unsafe payment.

## Solution / how it works

TreasuryPilot reads a real Airwallex Sandbox wallet, evaluates five synthetic obligations within a $48,000 base allocation, and protects a $15,000 reserve. A single verified €8,000 Sandbox customer deposit adds at most $8,000 of receipt-backed planning authority. Deterministic arithmetic and priority rules choose pay, convert and pay, defer or escalate. Every decision has an explanation and dependencies. The large test wallet is shown honestly beside the smaller policy envelope.

## How AI is used

Real free OpenRouter inference extracts structured facts from invoice/email text. The live validation used `nvidia/nemotron-3-super-120b-a12b:free`; `openrouter/free` is the only permitted fallback router, and pricing is checked before inference. The AI has no financial tool or execution authority. The UI identifies deterministic fallback if free inference is unavailable.

## How Airwallex is used

Server-side REST authentication with token caching; live balances, Global Accounts, beneficiaries and indicative rates; guaranteed FX quotes; a genuine settled USD 15,971.87 → EUR 14,000 conversion; a EUR 14,000 supplier transfer; provider Sandbox simulation to SENT then PAID; **one settled €8,000 customer deposit simulation** to the existing EUR Global Account; fresh evidence reads. The EUR wallet moved from €10,000,000 to €10,008,000, an exact +€8,000. The previous FX/transfer were not rerun. The Developer MCP's optional OAuth 401 is not a product dependency.

## Why it is agentic / adaptive behavior

Evidence changes the state, the state changes autonomy, and dependent decisions are reopened. A reported five-day receipt delay moves confidence from 92% to 31% and autonomy from $10,000 to $2,500. The UK contractor changes from defer-until-receipt to escalation, while funded contracts require additional approval. That confidence change reopens three decisions and preserves two. After the real Sandbox deposit, only the liquidity-blocked UK contractor reopens and changes from `ESCALATE` to **planned `CONVERT_AND_PAY`**; four other decisions preserve identity and timestamps. The resulting reserve is **$17,025.12**, above the $15,000 floor. No new contractor FX or transfer was executed.

## Security and policy model

AI interprets the situation. Policy protects liquidity. Airwallex executes. An exact encrypted approval binds the quote, amount, beneficiary, wallet, policy and forecast revision. The server rechecks live state and policy immediately before execution. Public execution is one bounded supplier campaign with stable request IDs, no arbitrary amount/recipient input and an expiry. The deposit write is local-operator-only, uses the fixed provider-unique `statement_ref` and a durable local lock, and is absent from the deployed write path. A $34,200 hypothetical allocation is rejected because it leaves $13,800 below the $15,000 reserve.

## Challenges

Reconciling a huge Sandbox wallet with a constrained treasury problem without falsifying balances; understanding distinct indicative and guaranteed FX payloads; recovering a provider-booked conversion after a local schema rejection; recovering the one Sandbox deposit after its response omitted `statement_ref`, without reposting; protecting a public demonstration without adding a financial database; making free inference availability explicit.

## Accomplishments / lessons

The model-to-policy boundary is visible and tested. A real conversion and transfer passed actual financial gates. The deposit was posted once, reconciled by provider GET plus exact live-balance delta, and reopened only the affected contractor decision. Stable identities prevent financial replay. Bank state, treasury authority and uncertain forecast are distinct concepts. The UI explains all three in one working surface.

## What's next

Durable reservations for multiple authorized obligations, independently authorized operators, webhook reconciliation, verified invoice due dates, fee-aware recipient amounts and a durable audit ledger.

## Built with

Next.js App Router, React, TypeScript, Tailwind CSS, Radix dialog primitives, Motion, Lucide, Recharts, React Hook Form, Zod, decimal.js, Airwallex Sandbox REST, OpenRouter, Vitest, Playwright and Vercel. MIT licensed. Solo project.

## Competition fields

This is draft application content. No application has been submitted. Final eligibility, submission fields, video limit and build window must be checked against the published rules; do not fabricate them from this draft.
