import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, access } from "node:fs/promises";
import type { GovernorView } from "../lib/governor/types";
const base = process.env.VERIFY_URL ?? "https://treasurypilot-sooty.vercel.app";
const privatePath = ".operator/video-ready-storage-state.json";
async function main() {
  await mkdir(".operator", { recursive: true });
  const existing = await access(privatePath).then(
    () => true,
    () => false,
  );
  const open = process.argv.includes("--open");
  const browser = await chromium.launch({ headless: !open });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
      ...(existing ? { storageState: privatePath } : {}),
    });
    const page = await context.newPage();
    // This operator preparation allows GETs only. Financial campaign identities never change.
    if (!open)
      await page.route("**/api/**", (route) =>
        route.request().method() === "GET" ? route.continue() : route.abort(),
      );
    await page.goto(`${base}/treasury`);
    await expect(
      page.getByRole("heading", { name: "Current plan", exact: true }),
    ).toBeVisible({ timeout: 45000 });
    const world = (await page.evaluate(async () =>
      (await fetch("/api/governor", { cache: "no-store" })).json(),
    )) as GovernorView;
    if (
      !open &&
      (world.forecast.confidence !== 0.92 ||
        world.receiptApplied ||
        world.contexts.some((c) => c.acceptedAt))
    )
      throw new Error(
        "This saved planning workspace has already progressed. Keep its evidence; use a fresh browser context for another take, without changing any banking campaign IDs.",
      );
    await context.storageState({ path: privatePath });
    if (!open) {
      const version = await context.request
        .get(`${base}/api/version`)
        .then((r) => r.json());
      await mkdir("docs/evidence/v2", { recursive: true });
      await writeFile(
        "docs/evidence/v2/video-ready.json",
        JSON.stringify(
          {
            checkedAt: new Date().toISOString(),
            url: base,
            version,
            workspaceId: world.id,
            contextVersion: world.contextVersion,
            planId: world.plans.at(-1)!.id,
            revision: world.revision,
            forecast: world.forecast,
            receiptApplied: world.receiptApplied,
            obligations: world.obligations,
            balances: world.snapshot.balances,
            reserve: world.plans.at(-1)!.plan.remaining,
            floor: world.policy.reserve,
            executionAvailable: world.snapshot.executionAvailable,
            operations: world.operations,
            persistence: world.persistence,
            financialMutations: 0,
            privateCookieFile: "Ignored .operator file; never publish or share",
            disclosure:
              "Fresh planning context only. Historical FX, transfer and deposit remain completed; no financial reset.",
          },
          null,
          2,
        ),
      );
      console.log(
        JSON.stringify({
          prepared: true,
          planId: world.plans.at(-1)!.id,
          confidence: world.forecast.confidence,
          receiptApplied: world.receiptApplied,
          reserveMinor: world.plans.at(-1)!.plan.remaining,
          privateStateSaved: true,
          financialMutations: 0,
        }),
      );
    } else {
      console.log(
        "Recording browser opened using private saved planning state. Close it to finish; original banking operations must not be replayed.",
      );
      await new Promise((resolve) => page.on("close", resolve));
      await context.storageState({ path: privatePath });
    }
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Preparation failed");
  process.exitCode = 1;
});
