import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import type { Snapshot } from "../lib/types";
async function main() {
  await mkdir("docs/screenshots", { recursive: true });
  await mkdir("docs/evidence", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const shot = async (name: string) => {
    await page.screenshot({
      path: `docs/screenshots/${name}.png`,
      fullPage: true,
    });
    console.log(`Screenshot: ${name}`);
  };
  await page.goto("http://127.0.0.1:3000/");
  await page.locator(".approach-steps").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.evaluate(() => scrollTo(0, 0));
  await shot("01-landing");
  await page.getByRole("link", { name: "Enter the treasury" }).click();
  await expect(
    page.getByText("Airwallex connected", { exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await shot("02-treasury-dashboard");
  await page.getByRole("button", { name: "Build treasury plan" }).click();
  await shot("03-five-obligations-plan");
  await page
    .getByRole("button", { name: "Explain Critical logistics supplier" })
    .click();
  await shot("04-critical-supplier-decision");
  if (await page.getByRole("button", { name: "Get real FX quote" }).count()) {
    await page.getByRole("button", { name: "Get real FX quote" }).click();
    await expect(
      page.getByRole("button", { name: "Approve exact action" }),
    ).toBeVisible({ timeout: 45000 });
    await page
      .getByRole("button", { name: "Approve exact action" })
      .scrollIntoViewIfNeeded();
    await shot("05-fx-action");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Approve exact action" }).click();
    await expect(
      page.getByRole("button", { name: "Execute Sandbox conversion" }),
    ).toBeVisible();
    await shot("07-human-approval");
    await page
      .getByRole("button", { name: "Execute Sandbox conversion" })
      .click();
  }
  if (
    !(await page
      .getByText("Supplier transfer verified", { exact: true })
      .count())
  ) {
    await expect(
      page.getByRole("button", { name: "Prepare supplier transfer" }),
    ).toBeVisible({ timeout: 45000 });
    await page
      .getByRole("button", { name: "Prepare supplier transfer" })
      .click();
    await expect(
      page.getByRole("button", { name: "Approve exact action" }),
    ).toBeVisible({ timeout: 45000 });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Approve exact action" }).click();
    await page
      .getByRole("button", { name: "Execute Sandbox transfer" })
      .click();
  }
  await expect(
    page.getByText("Supplier transfer verified", { exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await shot("09-airwallex-transfer");
  await page.getByRole("button", { name: "Close inspector" }).click();
  await page.getByRole("button", { name: "Test reserve guard" }).click();
  await shot("08-policy-blocked");
  await page.getByRole("button", { name: "Close inspector" }).click();
  await page.getByRole("button", { name: "Review customer update" }).click();
  await page.getByRole("button", { name: "Interpret evidence" }).click();
  await expect(
    page.getByRole("button", { name: "Accept evidence & replan" }),
  ).toBeVisible({ timeout: 110000 });
  await page.getByRole("button", { name: "Accept evidence & replan" }).click();
  await expect(
    page.getByRole("button", { name: "Restore baseline forecast" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Treasury overview", exact: true })
    .click();
  await expect(page.getByText("$2,500", { exact: true })).toBeVisible();
  await shot("06-confidence-change");
  await page.getByRole("button", { name: "Activity & audit" }).click();
  await shot("10-audit-replan");
  const snapshot: Snapshot = await page.evaluate(async () =>
    (await fetch("/api/snapshot")).json(),
  );
  await writeFile(
    "docs/evidence/financial-actions.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        environment: "SANDBOX",
        authorization:
          "Owner-authorized live browser validation through proposal, checkbox, exact approval and execution gates",
        unit: "integer minor units in JSON; all Airwallex requests use major units",
        evidence: snapshot.evidence,
        verifiedSnapshot: snapshot,
        browserErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { financialEvidence: snapshot.evidence, browserErrors: errors },
      null,
      2,
    ),
  );
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("http://127.0.0.1:3000/treasury");
    await expect(
      page.getByText("Airwallex connected", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Build treasury plan" }).click();
    await shot(`responsive-${width}`);
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error(`Horizontal overflow at ${width}px`);
  }
  await browser.close();
  if (errors.length) throw new Error("Browser runtime errors were observed");
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Live capture failed");
  process.exitCode = 1;
});
