# Airwallex Sandbox integration

Only https://api.sandbox.airwallex.com is permitted. Production/suffix hosts, HTTP and redirects fail closed. Credentials and bearer tokens stay server-side. REST money uses major units; internal/evidence JSON uses integer minor units and decimal.js.

Preserved capabilities: authentication/login, current balances, Global Accounts, existing beneficiaries, indicative rates, guaranteed quote create/retrieve, conversion create/list, transfer validate/create/list/get, deposit simulation/list and transfer-state simulation. The active Netherlands EUR account and seven beneficiary corridors already exist. No new account or beneficiary was created.

The original EUR 8,000 simulation used POST /api/v1/simulation/deposit/create with unique statement_ref, not request_id. The local exclusive latch and deployed read-only proof remain intact. v2 assigns the historical receipt to planning; it never simulates another deposit.

FX/transfers retain stable campaign UUIDs and exact approval binding. An immutable global operation claim precedes authorized external writes. Uncertain responses block reuse pending original-resource reconciliation. New browser workspaces never create new financial identities.

Authentication coalesces login and caches valid tokens. A 401 invalidates its token without automatic financial replay. Payload validation and sanitized provider error codes prevent raw response leakage.

Docs MCP was used for official guidance. Developer MCP is not an exposed callable integration here; HTTP 405 on plain GET confirms transport reachability only. Authenticated REST works. No additional Starter Kit 1 enablement was required for previously verified operations.

Sources checked 6 October: [API reference](https://www.airwallex.com/docs/api), [deposit simulation](https://www.airwallex.com/docs/api/simulation/deposits/create), [Developer Lab guide](https://airwallexdev.com/guide). All financial evidence is Sandbox, no real funds.
