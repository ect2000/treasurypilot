import { chromium, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import type { GovernorView } from "../lib/governor/types";
const base = process.env.VERIFY_URL ?? "http://127.0.0.1:3000";
const dir = base.includes("127.0.0.1") ? "local" : "deployed";
async function navigate(page: Page, label: string) {
  if ((page.viewportSize()?.width ?? 1440) < 768)
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Treasury navigation" })
    .getByRole("button", { name: label, exact: true })
    .click();
}
async function main() {
  await mkdir(`docs/screenshots/v2/${dir}`, { recursive: true });
  await mkdir("docs/evidence/v2", { recursive: true });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    context.setDefaultTimeout(30000);
    const page = await context.newPage();
    const errors: string[] = [];
    const timings: { path: string; method: string; durationMs: number }[] = [];
    let publicScriptBytes = 0;
    page.on("requestfinished", (request) => {
      const timing = request.timing();
      if (new URL(request.url()).pathname.startsWith("/api/"))
        timings.push({
          path: new URL(request.url()).pathname,
          method: request.method(),
          durationMs: Math.round(timing.responseEnd),
        });
      if (request.resourceType() === "script")
        void request.sizes().then((size) => {
          publicScriptBytes += size.responseBodySize;
        });
    });
    let financialMutationAttempts = 0;
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.route(
      /\/api\/(execute|deposit|transition|proposal|approve)(?:\?|$)/,
      (route) => {
        financialMutationAttempts++;
        return route.abort();
      },
    );
    await page.route("**/api/governor", async (route) => {
      if (
        route.request().method() === "POST" &&
        ["execute_action", "request_human_approval", "approve_action"].includes(
          route.request().postDataJSON().tool,
        )
      ) {
        financialMutationAttempts++;
        return route.abort();
      }
      await route.continue();
    });
    const read = async () =>
      page.evaluate(async () => {
        // Browser fetch retains its secure loopback cookie in local production QA too.
        const response = await fetch("/api/governor", { cache: "no-store" });
        if (!response.ok)
          throw new Error(
            `Financial world read failed: HTTP ${response.status}`,
          );
        return response.json();
      }) as Promise<GovernorView>;
    const save = async (name: string, value: unknown) =>
      writeFile(
        `docs/evidence/v2/${dir}-${name}.json`,
        JSON.stringify(value, null, 2),
      );
    const shot = async (name: string) =>
      page.screenshot({
        path: `docs/screenshots/v2/${dir}/${name}.png`,
        fullPage: !["05-policy-refusal", "12-mobile-inspector"].includes(name),
      });
    const started = Date.now();
    await page.goto(`${base}/treasury`);
    await expect(
      page.getByRole("heading", { name: "Current plan", exact: true }),
    ).toBeVisible({ timeout: 45000 });
    const firstUsefulMs = Date.now() - started;
    const before = await read();
    await save("balances-before", before.snapshot);
    await save("plan-v1", before.plans.at(-1));
    await save("forecast-before", before.forecast);
    await shot("01-overview");
    await navigate(page, "Plan");
    await shot("02-initial-plan");
    await navigate(page, "Evidence");
    await page
      .getByRole("button", { name: "Interpret evidence", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Accept evidence & replan" }),
    ).toBeEnabled({ timeout: 110000 });
    const interpretation = (await read()).contexts.at(-1)!;
    await save("context-change", interpretation);
    await page
      .getByRole("button", { name: "Accept evidence & replan" })
      .click();
    await expect(
      page.getByText("Evidence accepted", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await navigate(page, "Plan");
    await expect(page.getByText("3 reopened", { exact: true })).toBeVisible();
    await shot("03-confidence-change");
    const delayed = await read();
    await save("plan-v2", delayed.plans.at(-1));
    await navigate(page, "Approvals");
    await shot("04-approval-requirements");
    await save("approval", {
      current: delayed.approvals,
      disclosure:
        "No new approval or financial execution created. Prior exact approval controls preserved in v1; original approval was not reconstructed or invented.",
    });
    await navigate(page, "Policies");
    await shot("13-policies");
    await page.getByRole("button", { name: "Inspect reserve refusal" }).click();
    await expect(page.getByRole("dialog")).toContainText("$13,800.00");
    await shot("05-policy-refusal");
    await page.keyboard.press("Escape");
    await navigate(page, "Evidence");
    await shot("14-receipt-evidence");
    await page
      .getByRole("button", { name: "Allocate verified receipt & replan" })
      .click();
    await expect(page.getByText(/Receipt allocated once/)).toBeVisible({
      timeout: 15000,
    });
    await navigate(page, "Plan");
    await expect(page.getByText("1 reopened", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/4 unchanged · identities retained/),
    ).toBeVisible();
    await shot("06-deposit-replan");
    const after = await read();
    await save("plan-after-receipt", after.plans.at(-1));
    await save("balances-after", after.snapshot);
    await save("financial-world", after);
    for (const row of after.reconciliations)
      if (row.status !== "MATCHED")
        throw new Error(`Reconciliation requires investigation: ${row.kind}`);
    for (const d of delayed.plans
      .at(-1)!
      .plan.decisions.filter((d) => d.id !== "contractor")) {
      const next = after.plans
        .at(-1)!
        .plan.decisions.find((n) => n.id === d.id)!;
      if (next.evaluatedAt !== d.evaluatedAt || next.revision !== d.revision)
        throw new Error(`Unchanged decision identity lost: ${d.id}`);
    }
    if (after.plans.at(-1)!.plan.remaining < after.policy.reserve)
      throw new Error("Reserve breach");
    for (const b of before.snapshot.balances) {
      if (
        after.snapshot.balances.find((n) => n.currency === b.currency)
          ?.available !== b.available
      )
        throw new Error("Read-only demo unexpectedly changed a wallet");
    }
    await navigate(page, "Reconciliation");
    await shot("07-reconciliation");
    await save("reconciliation", after.reconciliations);
    await navigate(page, "Cash position");
    await shot("08-currency-placement");
    await save("cash-placement", after.placement);
    await navigate(page, "Incidents");
    await page
      .getByRole("button", { name: "Investigate original payment" })
      .click();
    await expect(page.getByText("INVESTIGATE", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await shot("09-incident");
    const investigated = await read();
    await save("incident", investigated.incidents);
    await save("audit", investigated.events);
    await navigate(page, "Audit trail");
    await shot("10-audit");
    const responsive = [];
    for (const [width, height] of [
      [375, 812],
      [390, 844],
      [768, 1024],
      [1024, 768],
      [1440, 900],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width, height });
      await navigate(page, "Overview");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      responsive.push({ width, height, overflow });
      await shot(`overview-${width}`);
      if (overflow) throw new Error(`Horizontal overflow at ${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await navigate(page, "Approvals");
    await shot("11-mobile-approval");
    await page
      .getByRole("button", { name: "Inspect Cloud infrastructure" })
      .click();
    await shot("12-mobile-inspector");
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Current plan", exact: true }),
    ).toBeVisible();
    const persisted = await read();
    await save("persistence-baseline", persisted);
    if (
      !persisted.receiptApplied ||
      JSON.stringify(persisted.plans) !== JSON.stringify(investigated.plans) ||
      persisted.contextVersion !== investigated.contextVersion
    )
      throw new Error("Durable state did not survive browser refresh");
    const identityHeaders = {
      Cookie: (await context.cookies())
        .map((c) => `${c.name}=${c.value}`)
        .join("; "),
      Origin: base,
    };
    const invalid = await page.request.post(`${base}/api/governor`, {
      headers: identityHeaders,
      data: { tool: "run_cycle", revision: 999999 },
    });
    const forged = await page.request.post(`${base}/api/governor`, {
      headers: identityHeaders,
      data: {
        tool: "execute_action",
        revision: persisted.revision,
        approvalId: "9ad1dd38-ae3b-49bd-961b-ed0adfda7049",
        amount: 1,
      },
    });
    const summary = {
      checkedAt: new Date().toISOString(),
      url: base,
      environment: "AIRWALLEX_SANDBOX_ONLY",
      financialMutationsDuringValidation: financialMutationAttempts,
      persistence: persisted.persistence,
      provider: interpretation.interpretation.provider,
      model: interpretation.interpretation.model,
      confidenceBefore: before.forecast.confidence,
      confidenceAfter: after.forecast.confidence,
      autonomyBefore: before.plans.at(-1)!.plan.autonomy,
      autonomyAfter: after.plans.at(-1)!.plan.autonomy,
      receiptWalletDeltaHistorical: after.snapshot.deposit.delta,
      newWalletDelta: 0,
      reopened: after.plans.at(-1)!.plan.reopened,
      unchanged: after.plans.at(-1)!.plan.unchanged,
      reserveAfter: after.plans.at(-1)!.plan.remaining,
      reconciliation: after.reconciliations.map((r) => ({
        kind: r.kind,
        status: r.status,
      })),
      responsive,
      browserErrors: errors,
      performance: { firstUsefulMs, publicScriptBytes, apiRequests: timings },
      staleRevisionHttp: invalid.status(),
      forgedOperationHttp: forged.status(),
      priorActions: after.operations,
      disclosure:
        "Provider FX/transfer/deposit are pre-existing v1 financial operations. This v2 validation only reads/reconciles them and mutates application planning context.",
    };
    await save("verification", summary);
    await mkdir(".operator", { recursive: true });
    await context.storageState({
      path: `.operator/${dir}-validation-state.json`,
    });
    console.log(JSON.stringify(summary, null, 2));
    if (
      errors.length ||
      financialMutationAttempts ||
      invalid.status() !== 409 ||
      forged.status() !== 400
    )
      throw new Error("Browser, replay or authority validation failed");
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Verification failed");
  process.exitCode = 1;
});
