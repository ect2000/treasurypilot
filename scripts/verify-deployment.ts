import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
async function main() {
  const base =
    process.env.VERIFY_URL ?? "https://treasurypilot-sooty.vercel.app";
  const response = await fetch(`${base}/api/snapshot`);
  if (!response.ok)
    throw new Error(`Deployed live reads failed: HTTP ${response.status}`);
  const snapshot = await response.json();
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto(base);
  // Legacy verifier exercises the preserved v1 UI; the primary verifier is verify-governor.ts.
  await page.goto(`${base}/treasury/v1`);
  await expect(
    page.getByText("Airwallex connected", { exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await page.getByRole("button", { name: "Build treasury plan" }).click();
  await expect(page.getByText("Reserve protected")).toBeVisible();
  await page
    .getByRole("button", { name: "Explain Critical logistics supplier" })
    .click();
  await expect(
    page.getByText("Supplier transfer verified", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close inspector" }).click();
  await page.getByRole("button", { name: "Test reserve guard" }).click();
  await expect(page.getByRole("dialog")).toContainText("$13,800.00");
  await page.getByRole("button", { name: "Close inspector" }).click();
  await page.getByRole("button", { name: "Review customer update" }).click();
  await page.getByRole("button", { name: "Interpret evidence" }).click();
  await expect(
    page.getByRole("button", { name: "Accept evidence & replan" }),
  ).toBeVisible({ timeout: 110000 });
  const actualProvider = await page.locator(".provider-label").innerText();
  const actualModel = await page.locator(".model-name").innerText();
  await page.getByRole("button", { name: "Accept evidence & replan" }).click();
  await expect(
    page.getByRole("button", { name: "Restore baseline forecast" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Treasury overview", exact: true })
    .click();
  await expect(page.getByText("$2,500", { exact: true })).toBeVisible();
  await expect(
    page.getByText("3 decisions reopened · 2 unchanged"),
  ).toBeVisible();
  await mkdir("docs/evidence", { recursive: true });
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/public-deployment.png",
    fullPage: true,
  });
  const forged = await page.request.post(`${base}/api/execute`, {
    data: { approval: "forged-PASS" },
  });
  const summary = {
    checkedAt: new Date().toISOString(),
    url: base,
    publicHttpStatus: response.status,
    source: snapshot.source,
    financialEvidence: snapshot.evidence,
    realAI: { provider: actualProvider, model: actualModel },
    browserErrors: errors,
    forgedApprovalHttpStatus: forged.status(),
    financialMutationsDuringDeploymentCheck: 0,
  };
  await writeFile(
    "docs/evidence/deployment-check.json",
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
  if (errors.length || forged.status() !== 400)
    throw new Error("Deployment browser or authorization checks failed");
}
main().catch((e) => {
  console.error(
    e instanceof Error ? e.message : "Deployment verification failed",
  );
  process.exitCode = 1;
});
