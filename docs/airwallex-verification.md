# Airwallex Sandbox integration verification

## MCP status

Docs MCP: reachable; initialization, tool listing, best practices and public-document search returned HTTP 200.

Developer MCP: reachable, HTTP 401 without its separate OAuth authorization. An API access token did not resolve MCP OAuth. It is OPTIONAL / CURRENTLY UNAVAILABLE and does not block REST integration. Both URLs are configured in the local Codex config. No further repair work is required for this product.

## Verified account setup

REST authentication passed. Sandbox Business is ACTIVE. One ACTIVE EUR Global Account exists in the Netherlands with LOCAL EUR receiving capability. Seven existing beneficiaries cover DE/EUR LOCAL and SWIFT, CN/CNY LOCAL and SWIFT, GB/GBP SWIFT, US/USD LOCAL and SWIFT.

Initial balances: 10,000,000 major units in each CNY, EUR, GBP and USD; 42 other currency balances were zero. No cross-currency sum is shown. Current balances are fetched dynamically and differ after the validated financial actions.

## Capability matrix

| Capability                            | Verified access / product use                                  | Official endpoint                                                                                                        |
| ------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Authentication                        | Live; cached until expiry minus 60 seconds                     | POST `/api/v1/authentication/login`                                                                                      |
| Balances                              | Live reads; typed mapping                                      | GET `/api/v1/balances/current`                                                                                           |
| Global Accounts                       | Live list; existing account reused                             | GET `/api/v1/global_accounts`                                                                                            |
| Global Account creation               | Documented REST capability; unnecessary here                   | POST `/api/v1/global_accounts/create`                                                                                    |
| Indicative FX                         | Live reads; market-pair direction normalized                   | GET `/api/v1/fx/rates/current`                                                                                           |
| Guaranteed FX quote                   | Live creation and retrieval                                    | POST `/api/v1/fx/quotes/create`; GET `/api/v1/fx/quotes/{quote_id}`                                                      |
| FX conversion                         | Genuine conversion settled; stable request ID                  | POST `/api/v1/fx/conversions/create`; GET `/api/v1/fx/conversions`                                                       |
| Beneficiaries                         | Live list; existing DE/EUR/LOCAL contact reused                | GET `/api/v1/beneficiaries`                                                                                              |
| Beneficiary schema                    | Recon metadata request succeeded; no new contact               | POST `/api/v1/beneficiary_api_schemas/generate`                                                                          |
| Transfer                              | Validated, created and re-read                                 | POST `/api/v1/transfers/validate`; POST `/api/v1/transfers/create`; GET `/api/v1/transfers` and `/api/v1/transfers/{id}` |
| Transfer-state simulation             | Real Sandbox simulation requests; GET verified SENT, then PAID | POST `/api/v1/simulation/transfers/{id}/transition`                                                                      |
| Deposit simulation                    | Documented and scope enabled; not executed in this build       | POST `/api/v1/simulation/deposits/create`                                                                                |
| Funding limits / supported currencies | Recon metadata reads succeeded                                 | GET `/api/v1/account_capabilities/funding_limits`; GET `/api/v1/reference/supported_currencies`                          |

Relevant resource grants already present: wallet balances read, FX rates read, quotes read/write, conversions read/write, contact management read/write, Global Accounts read/write, transfers read/write and simulations write. No extra broad permission or account enablement was requested.

## Real financial evidence

- Conversion `1878f1df-3b32-4d92-8b1e-9bbd83287e4d`: USD 15,971.87 sold, EUR 14,000 bought, **SETTLED**. request_id `570cbe8f-2d8e-536e-af92-d6c017d390c9`.
- Transfer `9ad1dd38-ae3b-49bd-961b-ed0adfda7049`: EUR 14,000 to the existing Sandbox DE/EUR/LOCAL beneficiary, initially **PROCESSING**. request_id `de5b666d-b246-5bd0-abd6-21adc50ab756`.
- The Sandbox transition API then changed that transfer to **SENT**, then **PAID**. These terminal states are explicitly simulated and must not be described as real bank settlement.
- The conversion's USD commitment leaves **$32,028.13** of the $48,000 authorized allocation before other planned obligations, above the $15,000 floor. Conversion and supplier payment are one lifecycle commitment, counted once.

REST amounts are major units. Exported evidence uses integer minor units and explicitly states that unit. No credential, client ID, bearer token, bank account number or beneficiary identifier is included in public evidence.

## Sources and implementation details

Official [balances](https://www.airwallex.com/docs/api/core_resources/balances/current), [FX rates](https://www.airwallex.com/docs/api/transactional_fx/rates), [FX quotes](https://www.airwallex.com/docs/api/transactional_fx/quotes), [FX conversions](https://www.airwallex.com/docs/api/transactional_fx/conversion/create), [transfers](https://www.airwallex.com/docs/api/payouts/transfers/create), [state simulation](https://www.airwallex.com/docs/api/simulation/transfers/transition), [deposit simulation](https://www.airwallex.com/docs/api/simulation/deposits/create) and [scope reference](https://www.airwallex.com/docs/developer-tools/api/api-key-scopes).

Observed adapters use indicative `rate`, quote `client_rate`, conversion `conversion_id`, Global Account `required_features[].currency`, and transfer `id`. The initial conversion response failed local validation after the provider had booked it; the corrected adapter recovered it by the stable request ID. No second conversion was booked.

READY FOR STARTER KIT 1: **YES** through REST. MCP OAuth is not required.
