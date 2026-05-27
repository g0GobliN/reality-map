import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("loads with correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/RealityMap/);
  });

  test("renders the hero heading", async ({ page }) => {
    await page.goto("/");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("AI-generated codebase");
  });

  test("renders the npx command", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("npx reality-map").first()).toBeVisible();
  });

  test("renders the hero CTA buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /npm install/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /View architecture/i })).toBeVisible();
  });

  test("renders feature sections", async ({ page }) => {
    await page.goto("/");
    // Problem section
    await expect(page.getByText("The reality of AI codebases")).toBeVisible();
    // Architecture section
    await expect(page.getByText("Architecture visualization")).toBeVisible();
    // Local-first section
    await expect(page.getByText("Local-first workflow")).toBeVisible();
  });

  test("renders footer with links", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByText("GitHub")).toBeVisible();
    await expect(footer.getByText("Privacy")).toBeVisible();
  });

  test("has no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Filter out known third-party noise
    const realErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("chrome-extension"),
    );
    expect(realErrors).toHaveLength(0);
  });

  test("scrolls smoothly to local-first section on CTA click", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Open live demo/i }).click();
    await expect(page.locator("#local-first")).toBeInViewport({ ratio: 0.3 });
  });
});
