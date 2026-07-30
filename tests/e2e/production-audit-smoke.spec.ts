import { expect, test, type Page, type APIResponse } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { clearSession, login } from "./helpers";

/**
 * Read-only production smoke for Bridget Pope Designs.
 * Landing + owner login + admin path navigation + APIs + optional client portal.
 * Does NOT submit inquiries or mutate CRM data — use full-flow with E2E_ALLOW_DESTRUCTIVE for writes.
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

test("production-audit-smoke-readonly", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`console: ${msg.text()}`);
  });

  // --- Landing (read-only) ---
  for (const path of ["/", "/gallery", "/inquire", "/services"]) {
    const { status, body } = await expectPageOk(page, path);
    const galleryOk = path !== "/gallery" || /gallery|portfolio|wedding|event/i.test(body);
    const inquireOk = path !== "/inquire" || /full name|submit inquiry|questionnaire/i.test(body);
    row(
      `landing:${path}`,
      status === 200 && galleryOk && inquireOk ? "PASS" : "FAIL",
      `HTTP ${status}`,
      path === "/gallery" ? (galleryOk ? "gallery content present" : "gallery content missing") : "ok",
      path === "/inquire" ? (inquireOk ? "fullName form present" : "inquire form mismatch") : "",
    );
  }

  // Homepage should surface gallery when any homepage images exist (soft check).
  const home = await expectPageOk(page, "/");
  const homeHasGalleryCue = /gallery|wedding|reception|event design|featured/i.test(home.body);
  row("landing:homepage-gallery-cue", homeHasGalleryCue ? "PASS" : "PARTIAL", "visual cue for gallery strip");

  // --- Owner login + queues (read-only navigation) ---
  await login(page, ownerUsername, ownerPassword, "/admin");
  await expectPageOk(page, "/admin", /welcome back/i);
  row("owner:dashboard", "PASS", "owner reaches /admin");

  const ownerPaths = [
    "/admin/leads",
    "/admin/consultations",
    "/admin/proposals",
    "/admin/invoices",
    "/admin/invoices?status=unpaid",
    "/admin/clients",
    "/admin/gallery",
    "/admin/files",
    "/admin/reports",
    "/admin/today",
  ];
  for (const path of ownerPaths) {
    try {
      const { status, body } = await expectPageOk(page, path, /welcome back/i);
      const failed = /something went wrong|application error|internal server error/i.test(body);
      const contactBroken = path.includes("consultations") && /No contact info/i.test(body) && /query warning/i.test(body);
      row(
        `owner:${path}`,
        status < 400 && !failed && !contactBroken ? "PASS" : "FAIL",
        `HTTP ${status}`,
        contactBroken ? "consultations embed still broken" : "ok",
      );
    } catch (err) {
      row(`owner:${path}`, "FAIL", err instanceof Error ? err.message : String(err));
    }
  }

  // --- Owner APIs (authenticated GET only) ---
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

  // Open existing proposal (read-only)
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

  // Invoice Actions surface (open menu only — no cancel/delete)
  await page.goto("/admin/invoices", { waitUntil: "domcontentloaded" });
  const actionsBtn = page.getByRole("button", { name: /^actions$/i }).first();
  if (await actionsBtn.count()) {
    await actionsBtn.click();
    const menuText = await page.locator("body").innerText();
    const hasExpected = /cancel|delete|import|upload|pdf|send|record payment/i.test(menuText);
    row("e2e:invoice-actions-menu", hasExpected ? "PASS" : "PARTIAL", "Actions menu opened (read-only)");
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
  const fails = matrix.filter((m) => m.status === "FAIL");
  const report = {
    productionUrl: baseURL,
    finishedAt: new Date().toISOString(),
    ownerUsername,
    mode: "read-only",
    apiChecks,
    matrix,
    consoleErrors: breaking,
    verdict:
      fails.length === 0 &&
      matrix.some((m) => m.name.startsWith("landing:")) &&
      matrix.some((m) => m.name === "owner:dashboard" && m.status === "PASS") &&
      (!clientEmail || matrix.some((m) => m.name === "client:dashboard" && m.status === "PASS"))
        ? matrix.some((m) => m.status === "PARTIAL")
          ? "GO_WITH_RESIDUAL"
          : "GO"
        : "NO-GO",
  };
  writeFileSync(join(artifactDir, "production-audit-smoke-report.json"), JSON.stringify(report, null, 2));
  // eslint-disable-next-line no-console
  console.log("\n===== PRODUCTION AUDIT SMOKE (READ-ONLY) =====\n" + JSON.stringify(report, null, 2));

  expect(fails, `Failed checks: ${JSON.stringify(fails, null, 2)}`).toEqual([]);
});
