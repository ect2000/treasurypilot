# Resource-boundary remediation

Outcome: fixed, subject to the explicit ingress/read-cost limitations below. Original finding csf_4dd985156c510a7f70f8634e, occurrence occ_ca29ccac19c05266bcbbe6f1, scan a09622c9-0757-4c19-a1ed-e0cd01cd4eda.

The vulnerable path was anonymous cookie-less governor GET → initialize world → provider snapshot → durable private Blob write, followed by unbounded aggregate growth. Legitimate existing reads, evidence retention, central approval state and permanent financial identities had to survive.

The narrow shared boundary is `lib/server/demo-limits.ts`, used before workspace creation and in the shared snapshot, interpretation, proposal, execution and transition paths. `governor-store` refuses oversized/over-revision saves; `governor` reserves readback capacity before commands. The singleton CAS ledger caps daily work and lifetime new contexts without generating a file per rejected visitor. Expired quotas rotate monotonically; permanent operation claims never rotate. Local storage uses an exclusive admission lock and bounded immutable world revisions.

Source files changed: demo-limits, governor/store, shared airwallex/ai/authorization/http, transition route. Adjacent financial correctness repairs and UI/documentation are separately described in the final audit, not claimed as the CWE-400 root fix.

Verification gates:

1. Type/import/diff review: typecheck and lint passed; mandatory Sandbox guard, strict schemas, expiry, CAS and claims retained.
2. Focused substitutes: demo-limits tests exercise exhaustion, fixed singleton writes, concurrent admission, UTC rollover and backward-day resumption, weak versions, missing deployed storage, aggregate caps and reserved capacity. AI tests prove exhausted admission precedes networking/fallback. Governor tests prove refusal before provider work and retained state.
3. Legitimate controls: initial world, reviewed delay, one-time receipt authority and original-resource reconciliation pass with real private Blob. Existing GET reads do not spend provider admission. Full 68-unit / 30-browser suite and production build passed. Actual server hero evidence is indexed separately.

One fresh prepatch investigator and one fresh postpatch reviewer were used, as required by the fix-finding skill. The reviewer identified midnight rollback and cutoff expiry during authentication. Both were confirmed in source, corrected and covered by tests; no second review cycle or live attack was run.

The original unbounded newly created world/aggregate/provider-work path is now structurally bounded and focused tests reject its equivalents before sink work. The live normal scenario still works, retaining four unchanged decision evaluations and completed campaign identities.

Uncertainty: quotas are not edge request throttling; admission and existing-world reads still have cost. The lifetime cap excludes pre-existing worlds. Uncertain actions eventually require private read-only operator investigation after bounded automatic reconciliation attempts. No public provider load test or exhaustive penetration test is claimed. The completed scan report remains an immutable prepatch record.
