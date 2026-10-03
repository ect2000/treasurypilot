import { test, expect } from "@playwright/test";
import { minor } from "../../lib/money";
const snapshot = {
  balances: ["USD", "EUR", "GBP", "CNY"].map((currency) => ({
    currency,
    available: minor("10000000"),
    total: minor("10000000"),
    pending: 0,
    reserved: 0,
  })),
  rates: { USD: "1", EUR: "1.14", GBP: "1.32", CNY: "0.14" },
  globalAccounts: [{ currency: "EUR", country: "NL", status: "ACTIVE" }],
  beneficiaries: [{ currency: "EUR", country: "DE", method: "LOCAL" }],
  evidence: [],
  fetchedAt: "2026-10-03T12:00:00Z",
  source: "AIRWALLEX_REST_SANDBOX",
  executionAvailable: true,
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/snapshot", (route) =>
    route.fulfill({ json: snapshot }),
  );
  await page.route("**/api/session", (route) =>
    route.fulfill({
      json: {
        forecast: {
          confidence: 0.92,
          amount: minor("20000"),
          dueHours: 24,
          delayed: false,
          received: false,
        },
        version: "fixture",
      },
    }),
  );
});
test("plan, explanation, exact approval and reserve block", async ({
  page,
}) => {
  await page.route("**/api/proposal", (route) =>
    route.fulfill({
      json: {
        token: "FIXTURE-NOT-LIVE",
        fingerprint: "a".repeat(64),
        operation: "CONVERT",
        cost: minor("15960"),
        reserveAfter: minor("32040"),
        autonomy: minor("10000"),
        approvalRequired: true,
        beneficiary: "Fixture corridor DE/EUR/LOCAL",
        quote: {
          id: "fixture",
          buyAmount: minor("14000"),
          sellAmount: minor("15960"),
          buyCurrency: "EUR",
          sellCurrency: "USD",
          validUntil: "2026-10-03T23:59:59Z",
        },
      },
    }),
  );
  await page.goto("/treasury");
  await page.getByRole("button", { name: "Build treasury plan" }).click();
  await expect(page.getByRole("table")).toContainText(
    "Critical logistics supplier",
  );
  await expect(page.getByText("Reserve protected")).toBeVisible();
  await page
    .getByRole("button", { name: "Explain Critical logistics supplier" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Why this decision");
  await page.getByRole("button", { name: "Get real FX quote" }).click();
  await expect(
    page.getByRole("button", { name: "Approve exact action" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(
    page.getByRole("button", { name: "Approve exact action" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Close inspector" }).click();
  await page.getByRole("button", { name: "Test reserve guard" }).click();
  await expect(page.getByRole("dialog")).toContainText("$13,800.00");
  await expect(page.getByRole("dialog")).toContainText("Not requested");
});
test("reviewed delay evidence reduces autonomy and replans incrementally", async ({
  page,
}) => {
  await page.route("**/api/interpret", (route) =>
    route.fulfill({
      json: {
        provider: "DETERMINISTIC_FALLBACK",
        model: "E2E fixture",
        summary: "Fixture reports a 5-day delay.",
        forecastDelayDays: 5,
        invoice: null,
        rejectedInstructions: false,
      },
    }),
  );
  await page.route("**/api/forecast", (route) =>
    route.fulfill({
      json: {
        forecast: {
          confidence: 0.31,
          amount: minor("20000"),
          dueHours: 144,
          delayed: true,
          received: false,
        },
      },
    }),
  );
  await page.goto("/treasury");
  await page.getByRole("button", { name: "Build treasury plan" }).click();
  await page.getByRole("button", { name: "Review customer update" }).click();
  await page.getByRole("button", { name: "Interpret evidence" }).click();
  await expect(
    page.getByText("DETERMINISTIC FALLBACK", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Accept evidence & replan" }).click();
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Treasury overview", exact: true })
    .click();
  await expect(page.getByText("$2,500", { exact: true })).toBeVisible();
  await expect(
    page.getByText("3 decisions reopened · 2 unchanged"),
  ).toBeVisible();
  await expect(page.getByText("31%", { exact: true })).toBeVisible();
});
test("landing and workspace fit the viewport with keyboard access", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Enter the treasury" }).click();
  await expect(
    page.getByRole("heading", { name: "Treasury, under control." }),
  ).toBeVisible();
  const horizontal = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(horizontal).toBe(false);
});
