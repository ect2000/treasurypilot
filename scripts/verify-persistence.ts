import { chromium, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import type { GovernorView } from "../lib/governor/types";
async function main() {
  const original = JSON.parse(
    await readFile("docs/evidence/v2/local-persistence-baseline.json", "utf8"),
  ) as GovernorView;
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      storageState: ".operator/local-validation-state.json",
    });
    const page = await context.newPage();
    await page.route("**/api/**", (route) =>
      route.request().method() === "GET" ? route.continue() : route.abort(),
    );
    await page.goto("http://127.0.0.1:3000/treasury");
    await expect(
      page.getByRole("heading", { name: "Current plan", exact: true }),
    ).toBeVisible({ timeout: 45000 });
    const after = (await page.evaluate(async () =>
      (await fetch("/api/governor", { cache: "no-store" })).json(),
    )) as GovernorView;
    const identities = (view: GovernorView) =>
      view.operations.map(
        ({ id, requestId, resourceId, kind, provenance }) => ({
          id,
          requestId,
          resourceId,
          kind,
          provenance,
        }),
      );
    if (
      after.id !== original.id ||
      !after.receiptApplied ||
      JSON.stringify(after.plans) !== JSON.stringify(original.plans) ||
      after.contextVersion !== original.contextVersion ||
      JSON.stringify(identities(after)) !== JSON.stringify(identities(original))
    )
      throw new Error(
        "Persisted financial identity changed across local production restart",
      );
    const proof = {
      checkedAt: new Date().toISOString(),
      mode: "LOCAL_PRODUCTION_PROCESS_RESTART_WITH_PRIVATE_BLOB",
      persistence: after.persistence,
      workspaceId: after.id,
      contextVersion: after.contextVersion,
      planIds: after.plans.map((p) => p.id),
      actionIds: after.operations.map((o) => o.requestId),
      reconciliationIds: after.reconciliations.map((r) => r.id),
      approvalIds: after.approvals.map((a) => a.id),
      receiptApplied: after.receiptApplied,
      revision: after.revision,
      identityPreserved: true,
      bankingMutations: 0,
      cookieDisclosure: "Private saved browser state reused; never published",
      limitation:
        "Actual local process restart, not a forced Vercel cold start. Vercel refresh/new requests separately verified.",
    };
    await writeFile(
      "docs/evidence/v2/persistence-restart.json",
      JSON.stringify(proof, null, 2),
    );
    console.log(JSON.stringify(proof));
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Persistence check failed",
  );
  process.exitCode = 1;
});
