import { test, expect } from "@playwright/test";

// Inject CSS to force all animated elements visible
async function disableAnimations(page: import("@playwright/test").Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

test.describe("Landing page", () => {
  test("loads with correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/RealityMap/);
  });

  test("renders the hero heading", async ({ page }) => {
    await page.goto("/");
    await disableAnimations(page);
    // Wait for the h1 to appear in DOM, then check text
    await page.locator("h1").first().waitFor({ state: "attached", timeout: 30000 });
    await expect(page.locator("h1").first()).toContainText("AI-generated codebase");
  });

  test("renders the npx command", async ({ page }) => {
    await page.goto("/");
    await disableAnimations(page);
    // CommandBlock renders "npx reality-map" in a <span>
    // Check it's in the DOM (not visibility, since it may be animated)
    await page.getByText("npx reality-map").first().waitFor({ state: "attached", timeout: 30000 });
    await expect(page.getByText("npx reality-map").first()).toBeTruthy();
  });

  test("renders the hero CTA buttons", async ({ page }) => {
    await page.goto("/");
    await disableAnimations(page);
    await page.getByText("npm install").first().waitFor({ state: "attached", timeout: 30000 });
    await expect(page.getByText("npm install").first()).toBeTruthy();
    await expect(page.getByRole("button", { name: /View architecture/i })).toBeAttached({
      timeout: 30000,
    });
  });

  test("renders feature sections", async ({ page }) => {
    await page.goto("/");
    await disableAnimations(page);
    await expect(page.getByText("The reality of AI codebases")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Architecture visualization")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Local-first workflow")).toBeVisible({ timeout: 30000 });
  });

  test("renders footer with links", async ({ page }) => {
    await page.goto("/");
    await disableAnimations(page);
    const footer = page.locator("footer");
    await expect(footer).toBeAttached({ timeout: 30000 });
    await expect(footer.getByText("GitHub")).toBeAttached();
    await expect(footer.getByText("Privacy")).toBeAttached();
  });

  test("has no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.locator("h1").first().waitFor({ state: "attached", timeout: 30000 });
    const realErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("chrome-extension") &&
        !e.includes("state update on a component that hasn't mounted"),
    );
    expect(realErrors).toHaveLength(0);
  });

  test("scrolls smoothly to local-first section on CTA click", async ({ page }) => {
    await page.goto("/");
    await disableAnimations(page);
    await page
      .getByRole("button", { name: /Open live demo/i })
      .waitFor({ state: "visible", timeout: 30000 });
    await page.getByRole("button", { name: /Open live demo/i }).click();
    await expect(page.locator("#local-first")).toBeInViewport({ ratio: 0.3 });
  });
});
