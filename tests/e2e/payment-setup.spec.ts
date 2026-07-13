import { expect, test, type Page } from "@playwright/test";
import { requireE2eEnv } from "./e2e-env";

const ownerUsername = process.env.E2E_OWNER_USERNAME;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;

requireE2eEnv(!ownerUsername || !ownerPassword, "Owner credentials (E2E_OWNER_USERNAME/E2E_OWNER_PASSWORD) are required for payment setup browser tests.");
test.setTimeout(180_000);

async function login(page: Page, username: string, password: string, next: string) {
  await page.goto(`/auth/login?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or Email").fill(username);
  await page.getByLabel("Password").fill(password);
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/auth/password-login"), { timeout: 30_000 }),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  expect(response.ok()).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(next.replace(/\//g, "\\/")), { timeout: 30_000 });
}

test("owner payment setup failure shows an error and resets the button", async ({ page }) => {
  await login(page, ownerUsername!, ownerPassword!, "/admin/settings/payments");

  await page.route("**/api/admin/stripe/connect/onboarding", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "text/html",
      body: "<html>provider error</html>",
    });
  });
  await page.route("**/api/admin/stripe/connect/manage", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "text/html",
      body: "<html>provider error</html>",
    });
  });

  const primaryButton = page.getByRole("button", {
    name: /set up payments|continue stripe setup|resolve in stripe|resolve payout issue|manage payment account/i,
  }).first();
  const originalLabel = (await primaryButton.innerText()).replace(/\s+/g, " ").trim();

  await primaryButton.click();
  // The mocked HTML error can resolve faster than Playwright can observe "Opening...".
  // Assert the durable failure-safe outcomes instead of the transient loading label.
  await expect(page.getByText("Payment setup returned an invalid response.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: new RegExp(originalLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })).toBeEnabled();
});

test("ready accounts use the management endpoint instead of onboarding", async ({ page }) => {
  await login(page, ownerUsername!, ownerPassword!, "/admin/settings/payments");

  const manageButton = page.getByRole("button", { name: /manage payment account/i });
  if ((await manageButton.count()) === 0) {
    test.skip(true, "Connected account is not READY in this environment.");
  }

  let onboardingCalled = false;
  let manageCalled = false;
  await page.route("**/api/admin/stripe/connect/onboarding", async (route) => {
    onboardingCalled = true;
    await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ success: false, message: "Wrong endpoint" }) });
  });
  await page.route("**/api/admin/stripe/connect/manage", async (route) => {
    manageCalled = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, url: "https://connect.stripe.com/express/test" }) });
  });

  await manageButton.click();
  await expect.poll(() => manageCalled).toBe(true);
  expect(onboardingCalled).toBe(false);
});
