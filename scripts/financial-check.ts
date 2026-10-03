import { mkdir, writeFile } from "node:fs/promises";
import {
  airwallex,
  conversionEvidence,
  readSnapshot,
  transferEvidence,
} from "../lib/server/airwallex";
import {
  approveProposal,
  campaignIds,
  executeApproved,
  prepareProposal,
} from "../lib/server/authorization";
import { initialForecast } from "../lib/treasury";
// Explicit operator command. Never run as part of unit tests, builds or deployment.
// The project owner authorized these Sandbox validation actions in the task brief.
async function main() {
  const client = airwallex(),
    ids = campaignIds();
  const evidence = [];
  for (const operation of ["CONVERT", "TRANSFER"] as const) {
    const existing =
      operation === "CONVERT"
        ? (await client.conversions()).find(
            (x) => x.request_id === ids.conversion,
          )
        : (await client.transfers()).find((x) => x.request_id === ids.transfer);
    if (existing) {
      evidence.push(
        operation === "CONVERT"
          ? conversionEvidence(existing)
          : transferEvidence(existing),
      );
      continue;
    }
    const proposal = await prepareProposal(
      operation,
      initialForecast,
      "operator-brief-authorization",
    );
    const approval = approveProposal(
      proposal.token,
      proposal.fingerprint,
      true,
      "operator-brief-authorization",
    );
    const result = await executeApproved(
      approval,
      "operator-brief-authorization",
    );
    evidence.push(result);
    console.log(
      JSON.stringify(
        {
          evidence: result,
          approvedFingerprint: proposal.fingerprint,
          reserveAfterMinor: proposal.reserveAfter,
          authorization: "Explicit owner Sandbox validation instruction",
        },
        null,
        2,
      ),
    );
  }
  const snapshot = await readSnapshot();
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    "docs/evidence/financial-actions.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        environment: "SANDBOX",
        unit: "integer minor units in evidence; REST requests use major units",
        evidence,
        verifiedSnapshot: snapshot,
      },
      null,
      2,
    ),
  );
  console.log(
    `Verified ${snapshot.evidence.length} campaign actions through fresh Sandbox API reads.`,
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Financial validation failed");
  process.exitCode = 1;
});
