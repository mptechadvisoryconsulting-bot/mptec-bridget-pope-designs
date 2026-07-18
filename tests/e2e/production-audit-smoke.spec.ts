import { expect, test, type Page, type APIResponse } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Final production readiness smoke for Bridget Pope Designs.
 * Landing + owner queues + APIs + inquiry → admin + client portal surfaces.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://bridget-pope-designs.us";
const ownerUsername = process.env.E2E_OWNER_USERNAME ?? process.env.E2E_ADMIN_USERNAME ?? "Bridget20";
const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD ?? "";
const clientEmail = process.env.E2E_CLIENT_EMAIL ?? "";
const clientPassword = process.env.E2E_CLIENT_PASSWORD ?? "";

test.skip(!ownerPassword, "Owner password required (E2E_OWNER_PASSWORD).");
test.setTimeout(420_000);

type Row = { name: string; status: "PASS" | "FAIL" | "PARTIAL"; notes: string[] };
const matrix: Row[] = [];
const apiChecks: { path: string; status: number; ok: boolean }[] = [];
const artifactDir = join(process.cwd(), ".e2e-artifacts");

function row(name: string, status: Row["status"], ...notes: string[]) {
  matrix.push({ name, status, notes });
}

async function login(page: Page, username: string, password: string, next: string) {
  await page.goto(`/auth/login?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or Email").fill(username);
  await page.getByLabel("Password").fill(password);
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/auth/password-login"), { timeout: 45_000 }),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  expect(response.ok(), `login failed: ${response.status()}`).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(next.replace(/\//g, "\\/")), { timeout: 45_000 });
}

async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

async function expectPageOk(page: Page, path: string, mustNotMatch?: RegExp) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;
  expect(status, `${path} status`).toBeLessThan(400);
  const body = await page.locator("body").innerText();
  expect(body, `${path} should not be 404`).not.toMatch(/page not found/i);
  if (mustNotMatch) expect(body).not.toMatch(mustNotMatch);
  return { status, body };
}

async function checkApi(page: Page, path: string) {
  const res: APIResponse = await page.request.get(path);
  const status = res.status();
  const ok = status >= 200 && status < 400;
  apiChecks.push({ path, status, ok });
  return res;
}

test("production-audit-smoke", async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const inquiryEmail = `e2e.audit.${suffix}@bridget-pope-designs.us`;
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`console: ${msg.text()}`);
  });

  // --- Landing ---
  for (const path of ["/", "/gallery", "/inquire", "/services"]) {
    const { status, body } = await expectPageOk(page, path);
    const galleryOk = path !== "/gallery" || /gallery|portfolio|wedding|event/i.test(body);
    row(
      `landing:${path}`,
      status === 200 && galleryOk ? "PASS" : "FAIL",
      `HTTP ${status}`,
      path === "/gallery" ? (galleryOk ? "gallery content present" : "gallery content missing") : "ok",
    );
  }

  // --- Inquiry happy path ---
  await page.goto("/inquire", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="firstName"]').fill("E2E");
  await page.locator('input[name="lastName"]').fill(`Audit${suffix}`);
  await page.locator('input[name="email"]').fill(inquiryEmail);
  await page.locator('input[name="phone"]').fill("(629) 555-0144");
  await page.locator('select[name="eventType"]').selectOption("Wedding");
  await page.locator('input[name="eventDate"]').fill("2026-12-05");
  await page.locator('input[name="guestCount"]').fill("90");
  await page.locator('input[name="venue"]').fill("E2E Audit Venue");
  await page.locator('input[name="city"]').fill("Murfreesboro");
  await page.locator('input[name="estimatedBudget"]').fill("$3,000 - $5,000");
  await page.locator('select[name="preferredConsultationMethod"]').selectOption("phone");
  await page.locator('textarea[name="message"]').fill(`E2E audit inquiry ${suffix}`);
  const weddingCheckbox = page.locator('input[type="checkbox"][value="Weddings"]');
  if (await weddingCheckbox.count()) {
    if (!(await weddingCheckbox.isChecked())) await weddingCheckbox.check();
  }
  const consent = page.locator('input[type="checkbox"][name="consent"]');
  if (await consent.count()) {
    if (!(await consent.isChecked())) await consent.check();
  }
  const [inquiryResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/inquiries") && res.request().method() === "POST", {
      timeout: 60_000,
    }),
    page.getByRole("button", { name: /submit inquiry/i }).click(),
  ]);
  const inquiryPayload = (await inquiryResponse.json().catch(() => ({}))) as Record<string, unknown>;
  const inquiryOk = inquiryResponse.ok();
  const leadId = String(inquiryPayload.leadId ?? "");
  const leadNumber = String(inquiryPayload.leadNumber ?? "");
  row(
    "e2e:inquiry-submit",
    inquiryOk ? "PASS" : "FAIL",
    `status=${inquiryResponse.status()}`,
    `leadNumber=${leadNumber}`,
    `leadId=${leadId}`,
  );
  if (inquiryOk) {
    await expect(page.getByText(/consultation request was received|thank you|received/i).first()).toBeVisible({
      timeout: 20_000,
    });
  }

  // --- Owner login + queues ---
  await login(page, ownerUsername, ownerPassword, "/admin");
  await expectPageOk(page, "/admin", /welcome back/i);
  row("owner:dashboard", "PASS", "owner reaches /admin");

  const ownerPaths = [
    "/admin/leads",
    "/admin/consultations",
    "/admin/proposals",
    "/admin/invoices",
    "/admin/clients",
    "/admin/gallery",
    "/admin/files",
  ];
  for (const path of ownerPaths) {
    try {
      const { status, body } = await expectPageOk(page, path, /welcome back/i);
      const failed = /something went wrong|application error|internal server error/i.test(body);
      row(`owner:${path}`, status < 400 && !failed ? "PASS" : "FAIL", `HTTP ${status}`);
    } catch (err) {
      row(`owner:${path}`, "FAIL", err instanceof Error ? err.message : String(err));
    }
  }

  if (inquiryOk && (inquiryEmail || leadNumber)) {
    await page.goto("/admin/leads", { waitUntil: "networkidle" }).catch(async () => {
      await page.goto("/admin/leads", { waitUntil: "domcontentloaded" });
    });
    const emailVisible = inquiryEmail
      ? await page.getByText(inquiryEmail).first().isVisible({ timeout: 15_000 }).catch(() => false)
      : false;
    const numberVisible = leadNumber
      ? await page.getByText(leadNumber).first().isVisible({ timeout: 5_000 }).catch(() => false)
      : false;
    let detailOk = false;
    if (!emailVisible && !numberVisible && leadId) {
      const detail = await page.goto(`/admin/leads/${leadId}`, { waitUntil: "domcontentloaded" });
      const detailBody = await page.locator("body").innerText();
      detailOk =
        (detail?.status() ?? 500) < 400 &&
        !/page not found/i.test(detailBody) &&
        (detailBody.includes(inquiryEmail) || detailBody.includes(leadNumber));
    }
    const visible = emailVisible || numberVisible || detailOk;
    row(
      "e2e:inquiry-on-admin",
      visible ? "PASS" : "FAIL",
      emailVisible || numberVisible ? "lead listed" : detailOk ? "lead detail reachable" : "lead not visible on /admin/leads",
    );
  }

  // --- Owner APIs (authenticated) ---
  for (const path of ["/api/proposals", "/api/notifications", "/api/leads"]) {
    const res = await checkApi(page, path);
    row(`api:${path}`, res.ok() ? "PASS" : "FAIL", `HTTP ${res.status()}`);
  }
  const invoicesGet = await checkApi(page, "/api/invoices");
  row(
    "api:/api/invoices",
    invoicesGet.status() === 405 ? "PASS" : invoicesGet.status() < 500 ? "PARTIAL" : "FAIL",
    `HTTP ${invoicesGet.status()} (POST-only create route)`,
  );

  // Proposal Actions / open existing if any
  await page.goto("/admin/proposals", { waitUntil: "domcontentloaded" });
  const proposalLink = page.locator('a[href*="/admin/proposals/"]').filter({ hasNotText: /new/i }).first();
  if (await proposalLink.count()) {
    const href = (await proposalLink.getAttribute("href")) || "";
    if (/\/admin\/proposals\/[0-9a-f-]{36}/i.test(href)) {
      await page.goto(href, { waitUntil: "domcontentloaded" });
      const body = await page.locator("body").innerText();
      const ok = !/page not found/i.test(body) && page.url().includes("/admin/proposals/");
      row("e2e:proposal-open", ok ? "PASS" : "FAIL", `href=${href}`, `url=${page.url()}`);
    } else {
      row("e2e:proposal-open", "PARTIAL", `skipped non-detail href=${href}`);
    }
  } else {
    row("e2e:proposal-open", "PARTIAL", "no proposal rows to open");
  }

  // Invoice Actions surface
  await page.goto("/admin/invoices", { waitUntil: "domcontentloaded" });
  const actionsBtn = page.getByRole("button", { name: /^actions$/i }).first();
  if (await actionsBtn.count()) {
    await actionsBtn.click();
    const menuText = await page.locator("body").innerText();
    const hasExpected =
      /cancel|delete|import|upload|pdf|send|record payment/i.test(menuText);
    row("e2e:invoice-actions-menu", hasExpected ? "PASS" : "PARTIAL", "Actions menu opened");
  } else {
    row("e2e:invoice-actions-menu", "PARTIAL", "no Actions button visible (empty queue?)");
  }

  // --- Client portal ---
  await clearSession(page);
  if (clientEmail && clientPassword) {
    try {
      await login(page, clientEmail, clientPassword, "/client/dashboard");
      await expect(page).toHaveURL(/\/client\/dashboard/);
      await expect(page.getByRole("heading", { name: /welcome back/i })).toHaveCount(0);
      const dashBody = await page.locator("body").innerText();
      const clientShell =
        (await page.getByRole("navigation", { name: /client/i }).count()) > 0 ||
        /dashboard|invoices|proposals|messages|design/i.test(dashBody);
      row(
        "client:dashboard",
        clientShell && !/page not found/i.test(dashBody) ? "PASS" : "FAIL",
        `url=${page.url()}`,
      );

      for (const path of ["/client/invoices", "/client/proposals", "/client/files", "/client/messages"]) {
        try {
          const response = await page.goto(path, { waitUntil: "domcontentloaded" });
          const status = response?.status() ?? 0;
          await expect(page).not.toHaveURL(/\/auth\/login/);
          const body = await page.locator("body").innerText();
          const ok = status < 400 && !/page not found/i.test(body);
          row(`client:${path}`, ok ? "PASS" : "FAIL", `HTTP ${status}`);
        } catch (err) {
          row(`client:${path}`, "FAIL", err instanceof Error ? err.message : String(err));
        }
      }
    } catch (err) {
      row("client:dashboard", "FAIL", err instanceof Error ? err.message : String(err));
    }
  } else {
    row("client:dashboard", "PARTIAL", "no E2E_CLIENT_EMAIL/PASSWORD provided");
  }

  const breaking = consoleErrors.filter(
    (e) => !/favicon|hydration|Download the React DevTools/i.test(e),
  );
  row(
    "console:breaking",
    breaking.length === 0 ? "PASS" : "PARTIAL",
    breaking.length ? breaking.slice(0, 8).join(" | ") : "no pageerror / console error captured",
  );

  mkdirSync(artifactDir, { recursive: true });
  const report = {
    productionUrl: baseURL,
    finishedAt: new Date().toISOString(),
    ownerUsername,
    inquiryEmail,
    leadNumber,
    leadId,
    apiChecks,
    matrix,
    consoleErrors: breaking,
    verdict: matrix.every((m) => m.status === "PASS" || m.status === "PARTIAL") &&
      matrix.filter((m) => m.status === "FAIL").length === 0 &&
      matrix.some((m) => m.name.startsWith("landing:")) &&
      matrix.some((m) => m.name === "owner:dashboard" && m.status === "PASS") &&
      matrix.some((m) => m.name === "e2e:inquiry-submit" && m.status === "PASS") &&
      matrix.some((m) => m.name === "e2e:inquiry-on-admin" && m.status === "PASS") &&
      (!clientEmail || matrix.some((m) => m.name === "client:dashboard" && m.status === "PASS"))
      ? matrix.some((m) => m.status === "PARTIAL")
        ? "GO_WITH_RESIDUAL"
        : "GO"
      : "NO-GO",
  };
  writeFileSync(join(artifactDir, "production-audit-smoke-report.json"), JSON.stringify(report, null, 2));
  // eslint-disable-next-line no-console
  console.log("\n===== PRODUCTION AUDIT SMOKE =====\n" + JSON.stringify(report, null, 2));

  const fails = matrix.filter((m) => m.status === "FAIL");
  expect(fails, `Failed checks: ${JSON.stringify(fails, null, 2)}`).toEqual([]);
});
