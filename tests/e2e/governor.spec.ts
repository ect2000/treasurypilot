import { test, expect, type Page } from "@playwright/test";
import { initializeWorld, governorView } from "../../lib/server/governor";
import { calculatePlan, cashPlacement } from "../../lib/governor/engine";
import { updateForecast } from "../../lib/treasury";
import { verifiedSnapshot } from "../fixtures/governor";
test.beforeEach(async ({ page }) => {
  const state = initializeWorld("browser-fixture", verifiedSnapshot());
  await page.route("**/api/governor", async (route) => {
    if (route.request().method() === "POST") {
      const command = route.request().postDataJSON();
      if (command.tool === "interpret_context")
        state.contexts.push({
          id: "29e8a319-6538-43ea-bde3-12eeb40aebc0",
          text: command.text,
          interpretation: {
            provider: "DETERMINISTIC_FALLBACK",
            model: "Browser fixture parser",
            summary: "Payment delayed by five days.",
            forecastDelayDays: 5,
            invoice: null,
            rejectedInstructions: false,
          },
        });
      if (
        command.tool === "accept_context" ||
        command.tool === "allocate_receipt"
      ) {
        const old = state.plans.at(-1)!;
        if (command.tool === "accept_context") {
          state.forecast = updateForecast(state.forecast, 5);
          state.contexts[0].acceptedAt = new Date().toISOString();
        } else state.receiptApplied = true;
        const plan = calculatePlan(
          state.snapshot,
          state.forecast,
          old.plan,
          undefined,
          state.receiptApplied,
        );
        old.state = "SUPERSEDED";
        state.plans.push({
          id: `plan-${state.plans.length + 1}`,
          contextVersion: `fixture-${state.revision}`,
          createdAt: new Date().toISOString(),
          state: "CURRENT",
          cause: command.tool,
          plan,
        });
        state.placement = cashPlacement(state.snapshot, plan);
      }
      state.revision++;
    }
    await route.fulfill({ json: governorView(state) });
  });
});
async function navigate(page: Page, label: string) {
  if ((page.viewportSize()?.width ?? 1440) < 768)
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Treasury navigation" })
    .getByRole("button", { name: label, exact: true })
    .click();
}
test("reviewed evidence changes the actual plan graph and authority; deposit allocation preserves four decisions", async ({
  page,
}) => {
  await page.goto("/treasury");
  await expect(
    page.getByRole("heading", { name: "Current plan", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("$10,000", { exact: true })).toHaveCount(2);
  await navigate(page, "Evidence");
  await page
    .getByRole("button", { name: "Interpret evidence", exact: true })
    .click();
  await expect(
    page.getByText("DETERMINISTIC FALLBACK", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Accept evidence & replan" }).click();
  await navigate(page, "Plan");
  await expect(page.getByText("3 reopened", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/2 unchanged · identities retained/),
  ).toBeVisible();
  await navigate(page, "Overview");
  await expect(page.getByRole("img", { name: /confidence 31%/ })).toBeVisible();
  await navigate(page, "Evidence");
  await page
    .getByRole("button", { name: "Allocate verified receipt & replan" })
    .click();
  await navigate(page, "Plan");
  await expect(page.getByText("1 reopened", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/4 unchanged · identities retained/),
  ).toBeVisible();
  await page.reload();
  await navigate(page, "Plan");
  await expect(page.getByText("1 reopened", { exact: true })).toBeVisible();
});
test("financial evidence, movement reconciliation, policy refusal and inspectors remain accessible", async ({
  page,
}) => {
  await page.goto("/treasury");
  await expect(
    page.getByRole("heading", { name: "Current plan", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect Critical logistics supplier" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Original supplier transfer PAID",
  );
  await page.keyboard.press("Escape");
  await navigate(page, "Reconciliation");
  await expect(page.getByText("4 verified matches")).toBeVisible();
  await expect(page.getByText("$0.00", { exact: true }).first()).toBeVisible();
  await navigate(page, "Policies");
  await page.getByRole("button", { name: "Inspect reserve refusal" }).click();
  await expect(page.getByRole("dialog")).toContainText("$13,800.00");
  await expect(page.getByRole("dialog")).toContainText("not requested");
});
test("all requested widths fit the cockpit, currency placement and approval view with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [
    [375, 812],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/treasury");
    await expect(
      page.getByRole("heading", { name: "Current plan", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await navigate(page, "Cash position");
    await expect(page.getByText("Conservation checked")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await navigate(page, "Approvals");
    await expect(page.getByText("Supplier mandate fulfilled")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
});
test("a duplicate click issues one command and a failed read never appears as financial success", async ({
  page,
}) => {
  let posts = 0;
  const state = initializeWorld("double-click-fixture", verifiedSnapshot());
  await page.route("**/api/governor", async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await new Promise((r) => setTimeout(r, 250));
      return route.fulfill({
        status: 503,
        json: { error: "Provider read unavailable; original action unchanged" },
      });
    }
    return route.fulfill({ json: governorView(state) });
  });
  await page.goto("/treasury");
  await expect(
    page.getByRole("heading", { name: "Current plan", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run agent cycle" }).dblclick();
  await expect(
    page.getByRole("alert").filter({ hasText: "Provider read unavailable" }),
  ).toContainText("Provider read unavailable");
  expect(posts).toBe(1);
});
test("the inspector traps keyboard focus and restores the invoking action after Escape", async ({
  page,
}) => {
  await page.goto("/treasury");
  const trigger = page.getByRole("button", {
    name: "Inspect Cloud infrastructure",
  });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest('[role="dialog"]'),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
test("shows exact plan reserve and an expired approval cannot show an executable action", async ({
  page,
}) => {
  const state = initializeWorld("expired-approval-fixture", verifiedSnapshot());
  state.approvals.push({
    id: "c8c9ad64-f5bb-4b4f-90fb-47e798f1db61",
    actionType: "CONVERT",
    obligation: "logistics",
    planId: state.plans[0].id,
    contextVersion: state.contextVersion,
    fingerprint: "fixture-fingerprint",
    amount: 1400000,
    currency: "EUR",
    counterparty: "Fixture supplier",
    quoteId: "fixture-quote",
    quoteExpiresAt: new Date(Date.now() + 900000).toISOString(),
    requestId: "fixture-request",
    reserveAfter: 3202813,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    status: "APPROVED",
    sealedProposal: "fixture-sealed",
  });
  await page.route("**/api/governor", (route) =>
    route.fulfill({ json: governorView(state) }),
  );
  await page.goto("/treasury");
  await expect(
    page.getByText("$18,828.13", { exact: true }).first(),
  ).toBeVisible();
  await navigate(page, "Approvals");
  await expect(page.getByText("EXPIRED", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Execute exact Sandbox action" }),
  ).toHaveCount(0);
});
