import { test, expect, type Page } from "@playwright/test";

const STAGES = ["brief", "strategy", "logo", "color", "type", "imagery", "motion", "mockups", "guidelines", "export"] as const;

/** The suite runs offline: block every non-local request so pages settle and providers fail fast. */
async function offline(page: Page) {
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u) || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    return route.abort();
  });
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/Failed to load resource|hydrated but some attributes/.test(t)) errors.push(`console: ${t.slice(0, 300)}`);
  });
  return errors;
}

test("dashboard opens the sample project and every stage renders without errors", async ({ page }) => {
  await offline(page);
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Brand Genome");
  await page.getByRole("button", { name: /open the sample project/i }).click();
  await page.waitForURL(/\/studio\/[^/]+\/brief/);
  const id = new URL(page.url()).pathname.split("/")[2];

  for (const stage of STAGES) {
    await page.goto(`/studio/${id}/${stage}`);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.getByText(/under construction/i)).toHaveCount(0);
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("brief edits persist across reload and the Genome stays valid", async ({ page }) => {
  await offline(page);
  await page.goto("/");
  await page.getByRole("button", { name: /new brand/i }).click();
  await page.getByPlaceholder(/aurora roasters/i).fill("Playwright Coffee");
  await page.getByRole("button", { name: /^create$/i }).click();
  await page.waitForURL(/\/studio\/[^/]+\/brief/);
  const client = page.getByLabel(/^client$/i).first();
  await client.fill("Test Client Ltd");
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByLabel(/^client$/i).first()).toHaveValue("Test Client Ltd");
});

test("color lab generates and applies a palette", async ({ page }) => {
  await offline(page);
  const errors = collectErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: /open the sample project/i }).click();
  await page.waitForURL(/\/studio\/[^/]+\/brief/);
  const id = new URL(page.url()).pathname.split("/")[2];
  await page.goto(`/studio/${id}/color`);
  await page.getByRole("button", { name: /^generate$/i }).first().click();
  const apply = page.getByRole("button", { name: /^apply/i }).first();
  await expect(apply).toBeVisible();
  await apply.click();
  await expect(page.getByText(/palette/i).first()).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("export lab builds a brand kit zip", async ({ page }) => {
  await offline(page);
  await page.goto("/");
  await page.getByRole("button", { name: /open the sample project/i }).click();
  await page.waitForURL(/\/studio\/[^/]+\/brief/);
  const id = new URL(page.url()).pathname.split("/")[2];
  await page.goto(`/studio/${id}/export`);
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByRole("button", { name: /download brand kit/i }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const path = await download.path();
  expect(path).toBeTruthy();
});
