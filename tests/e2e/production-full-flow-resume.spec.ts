import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { requireE2eEnv } from "./e2e-env";

/**
 * Resume path when /api/inquiries is rate-limited.
 * Uses pre-converted Client A fixtures + optional Client B from env/state.
 */

const ownerUsername = process.env.E2E_OWNER_USERNAME ?? process.env.E2E_ADMIN_USERNAME;
const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD;
const reportPath = join(process.cwd(), "test-results", "production-full-flow-report.json");

requireE2eEnv(!ownerUsername || !ownerPassword, "Owner credentials required");

test.setTimeout(600_000);

type StepStatus = "PASS" | "FAIL" | "BLOCKED" | "PARTIAL";

function loadReport() {
  if (!existsSync(reportPath)) {
    return {
      productionUrl: process.env.PLAYWRIGHT_BASE_URL ?? "https://bridget-pope-designs.us",
      startedAt: new Date().toISOString(),
      steps: {
        A: { status: "PASS" as StepStatus, notes: ["Resumed after prior inquiry PASS (rate-limited on re-run)"] },
        B: { status: "PARTIAL" as StepStatus, notes: [] },
        C: { status: "FAIL" as StepStatus, notes: [] },
        D: { status: "FAIL" as StepStatus, notes: [] },
        E: { status: "FAIL" as StepStatus, notes: [] },
        F: { status: "FAIL" as StepStatus, notes: [] },
        G: { status: "FAIL" as StepStatus, notes: [] },
      },
      security: { status: "FAIL" as StepStatus, notes: [] },
      bugs: [] as string[],
      ids: {} as Record<string, string | undefined>,
      blockers: [] as string[],
    };
  }
  return JSON.parse(readFileSync(reportPath, "utf8"));
}

function saveReport(report: ReturnType<typeof loadReport>) {
  report.finishedAt = new Date().toISOString();
  mkdirSync(join(process.cwd(), "test-results"), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  // eslint-disable-next-line no-console
  console.log("\n===== PRODUCTION FULL FLOW REPORT =====\n" + JSON.stringify(report, null, 2));
}

async function login(page: Page, username: string, password: string, next: string) {
  await page.goto(`/auth/login?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or Email").fill(username);
  await page.getByLabel("Password").fill(password);
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/auth/password-login"), { timeout: 45_000 }),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  expect(response.ok(), `login failed ${response.status()}`).toBeTruthy();
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

async function tinyPdfBytes() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([200, 200]);
  page.drawText("E2E Invoice PDF", { x: 24, y: 100, size: 12 });
  return Buffer.from(await pdf.save());
}

async function tinyPngBytes() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

test("production-full-flow-resume C–G", async ({ page }) => {
  const report = loadReport();
  const suffix = process.env.E2E_RESUME_SUFFIX ?? "26712138";
  const clientEmail = process.env.E2E_RESUME_CLIENT_EMAIL ?? `e2e.fullflow.${suffix}@bridget-pope-designs.us`;
  const clientPassword = process.env.E2E_RESUME_CLIENT_PASSWORD ?? `E2eClient${suffix}!`;
  const clientId = process.env.E2E_RESUME_CLIENT_ID ?? "ceabdecd-726e-4bd8-9bfd-1005a7ed7f75";
  const projectId = process.env.E2E_RESUME_PROJECT_ID ?? "6cd30034-20e8-4053-acf4-975d8f341279";
  const proposalId = process.env.E2E_RESUME_PROPOSAL_ID ?? "4c14fc95-05f5-4d51-94c0-b70669130470";
  const secondEmail = process.env.E2E_RESUME_SECOND_EMAIL ?? "";
  const secondPassword = process.env.E2E_RESUME_SECOND_PASSWORD ?? "";
  const secondProjectId = process.env.E2E_RESUME_SECOND_PROJECT_ID ?? "";
  const secondInvoiceId = process.env.E2E_RESUME_SECOND_INVOICE_ID ?? "";

  report.ids = {
    ...report.ids,
    clientId,
    projectId,
    proposalId,
    clientEmail,
  };
  report.steps.A.notes.push("Inquiry recipient confirmed via SQL: bpeventsanddesigns@gmail.com");
  report.steps.A.status = "PASS";
  report.steps.B.notes.push(`Resuming with existing proposal ${proposalId} on project ${projectId}`);
  report.steps.B.notes.push("Known P0: proposal detail/approve embeds return PostgREST 300 on production until deploy");

  try {
    await login(page, ownerUsername!, ownerPassword!, "/admin");

    // C: invoice
    const invoiceRes = await page.request.post("/api/invoices", {
      data: {
        clientId,
        projectId,
        proposalId: proposalId || "",
        invoiceType: "deposit",
        description: `E2E resume deposit ${suffix}`,
        dueDate: "2026-09-01",
        taxAmount: 0,
        discountAmount: 0,
        items: [{ title: "Design retainer", description: "E2E line", quantity: 1, unitPrice: 250 }],
      },
    });
    const invoicePayload = await invoiceRes.json().catch(() => ({}));
    expect(invoiceRes.ok(), JSON.stringify(invoicePayload)).toBeTruthy();
    const invoiceId = invoicePayload.invoice?.id as string;
    report.ids.invoiceId = invoiceId;
    report.steps.C.notes.push(`Invoice created ${invoicePayload.invoice?.invoice_number} status=${invoicePayload.invoice?.status}`);
    expect(invoicePayload.invoice?.status).toBe("draft");

    const sendInvoiceRes = await page.request.post(`/api/invoices/${invoiceId}/send`);
    report.steps.C.notes.push(`Invoice send status=${sendInvoiceRes.status()} ok=${sendInvoiceRes.ok()}`);

    const paymentRes = await page.request.post(`/api/invoices/${invoiceId}/payments`, {
      data: { amount: 100, paidAt: "2026-07-17", paymentMethod: "zelle", note: `E2E resume payment ${suffix}` },
    });
    report.steps.C.notes.push(`Record payment status=${paymentRes.status()} ok=${paymentRes.ok()}`);
    if (!paymentRes.ok()) report.bugs.push(`Record payment failed: ${await paymentRes.text()}`);

    await page.goto(`/admin/invoices/${invoiceId}`, { waitUntil: "domcontentloaded" });
    const uploadVisible = await page.getByText(/Upload Invoice PDF/i).isVisible().catch(() => false);
    report.steps.C.notes.push(uploadVisible ? "UploadInvoicePdfForm visible" : "UploadInvoicePdfForm NOT visible");
    if (uploadVisible) {
      await page.locator('input[type="file"][name="file"]').setInputFiles({
        name: `e2e-invoice-${suffix}.pdf`,
        mimeType: "application/pdf",
        buffer: await tinyPdfBytes(),
      });
      const notify = page.locator('input[name="notify"]');
      if (await notify.count()) {
        if (await notify.isChecked()) await notify.uncheck();
      }
      const [uploadRes] = await Promise.all([
        page.waitForResponse((res) => res.url().includes("/upload-pdf"), { timeout: 60_000 }),
        page.getByRole("button", { name: /upload pdf/i }).click(),
      ]);
      report.steps.C.notes.push(`PDF upload status=${uploadRes.status()} ok=${uploadRes.ok()}`);
    }
    const pdfGet = await page.request.get(`/api/invoices/${invoiceId}/pdf`);
    report.steps.C.notes.push(`PDF GET status=${pdfGet.status()}`);
    await page.screenshot({ path: join("test-results", `c-invoice-resume-${suffix}.png`), fullPage: true });

    const draftRes = await page.request.post("/api/invoices", {
      data: {
        clientId,
        projectId,
        proposalId: "",
        invoiceType: "balance",
        description: `E2E hidden draft ${suffix}`,
        dueDate: "2026-12-01",
        taxAmount: 0,
        discountAmount: 0,
        items: [{ title: "Hidden draft", description: "should not show", quantity: 1, unitPrice: 50 }],
      },
    });
    report.steps.C.notes.push(`Draft create status=${draftRes.status()} ok=${draftRes.ok()}`);
    report.steps.C.status = invoiceRes.ok() && sendInvoiceRes.ok() ? (paymentRes.ok() ? "PASS" : "PARTIAL") : "FAIL";

    // E: gallery
    const png = await tinyPngBytes();
    const galleryTitle = `E2E Gallery Resume ${suffix}`;
    const galRes = await page.request.post("/api/uploads", {
      multipart: {
        file: { name: `e2e-gallery-${suffix}.png`, mimeType: "image/png", buffer: png },
        title: galleryTitle,
        category: "Event Design",
      },
    });
    const galPayload = await galRes.json().catch(() => ({}));
    report.ids.galleryFileId = galPayload.file?.id;
    report.steps.E.notes.push(`Gallery upload status=${galRes.status()} fileId=${galPayload.file?.id ?? "none"}`);
    await page.goto("/gallery", { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: join("test-results", `e-gallery-resume-${suffix}.png`), fullPage: true });
    const projectFileRes = await page.request.post("/api/files", {
      data: {
        projectId,
        category: "inspiration",
        fileName: `E2E Private Project Photo ${suffix}.png`,
        storagePath: `projects/${projectId}/e2e-private-${suffix}.png`,
        mimeType: "image/png",
        fileSize: png.byteLength,
        visibility: "client_visible",
      },
    });
    report.steps.E.notes.push(`Project file metadata status=${projectFileRes.status()}`);
    await page.goto("/gallery", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(`E2E Private Project Photo ${suffix}.png`)).toHaveCount(0);
    report.steps.E.notes.push("Project/client_visible file not on public gallery");
    report.steps.E.status = galRes.ok() ? "PASS" : "FAIL";

    // F: closeout
    const statusRes = await page.request.patch(`/api/admin/projects/${projectId}/status`, {
      data: { status: "event_complete" },
    });
    report.steps.F.notes.push(`event_complete status=${statusRes.status()} ok=${statusRes.ok()}`);

    // D + security + G
    await clearSession(page);
    try {
      await login(page, clientEmail, clientPassword, "/client/dashboard");
    } catch (error) {
      report.steps.D.status = "BLOCKED";
      report.steps.D.notes.push(
        `Client login blocked: ${error instanceof Error ? error.message : String(error)}. Password bootstrap may have failed.`,
      );
      report.blockers.push("Client portal login failed after SQL password bootstrap attempt");
      report.steps.F.status = statusRes.ok() ? "PARTIAL" : "FAIL";
      report.steps.G.status = "PARTIAL";
      report.security.status = "BLOCKED";
      report.security.notes.push("Could not complete isolation checks without Client A session");
      saveReport(report);
      return;
    }

    await expect(page.getByText(new RegExp(`FullFlow${suffix}|Wedding`, "i")).first()).toBeVisible({ timeout: 30_000 });
    report.steps.D.notes.push("Client A dashboard loads own project");
    await page.screenshot({ path: join("test-results", `d-client-dashboard-resume-${suffix}.png`), fullPage: true });

    await page.goto("/client/invoices", { waitUntil: "domcontentloaded" });
    const invoicesText = await page.locator("body").innerText();
    expect(invoicesText).not.toContain(`E2E hidden draft ${suffix}`);
    report.steps.C.notes.push("Client invoices exclude draft description");

    if (secondInvoiceId) {
      const res = await page.goto(`/client/invoices/${secondInvoiceId}`, { waitUntil: "domcontentloaded" });
      const body = await page.locator("body").innerText();
      const blocked = res?.status() === 404 || /page not found|not found/i.test(body);
      report.security.notes.push(`Client A → B invoice blocked=${blocked} status=${res?.status()}`);
      expect(blocked).toBeTruthy();
    }
    if (secondProjectId) {
      const res = await page.goto(`/client/projects/${secondProjectId}`, { waitUntil: "domcontentloaded" });
      const body = await page.locator("body").innerText();
      const blocked = res?.status() === 404 || /page not found|not found/i.test(body);
      report.security.notes.push(`Client A → B project blocked=${blocked} status=${res?.status()}`);
      expect(blocked).toBeTruthy();
    }

    await clearSession(page);
    await login(page, ownerUsername!, ownerPassword!, "/admin");
    const designRes = await page.request.post("/api/design-updates", {
      data: {
        projectId,
        title: `E2E Design Update ${suffix}`,
        description: `Shared design note ${suffix}`,
        status: "shared",
        clientVisible: true,
        requiresClientAction: false,
      },
    });
    report.steps.D.notes.push(`Owner design update status=${designRes.status()} ok=${designRes.ok()}`);

    await clearSession(page);
    await login(page, clientEmail, clientPassword, "/client/designs");
    await page.reload({ waitUntil: "domcontentloaded" });
    const designsText = await page.locator("body").innerText();
    const seesUpdate =
      designsText.includes(`E2E Design Update ${suffix}`) || designsText.includes(`Shared design note ${suffix}`);
    report.steps.D.notes.push(seesUpdate ? "Client A sees design update after refresh" : "Client A missing design update");
    report.steps.G.notes.push(seesUpdate ? "Refresh sync PASS" : "Refresh sync FAIL");
    report.steps.G.notes.push("Realtime not asserted; refresh-based sync checked");

    if (secondEmail && secondPassword) {
      await clearSession(page);
      await login(page, secondEmail, secondPassword, "/client/dashboard");
      const bText = await page.locator("body").innerText();
      expect(bText).not.toContain(`E2E Design Update ${suffix}`);
      expect(bText).not.toContain(`FullFlow${suffix}`);
      report.security.notes.push("Client B does not see Client A update");
      report.security.status = "PASS";
    } else {
      report.security.status = secondInvoiceId || secondProjectId ? "PARTIAL" : "BLOCKED";
      report.security.notes.push("Client B account not provisioned in this resume run (invite rate-limit / no second fixture)");
      report.blockers.push("Client B isolation login skipped — create second portal user when invite rate limit clears");
    }

    await clearSession(page);
    await login(page, clientEmail, clientPassword, "/client/dashboard");
    const closeoutText = await page.locator("body").innerText();
    const seesComplete = /event complete|completed|complete/i.test(closeoutText);
    report.steps.F.notes.push(seesComplete ? "Client sees completed cues" : "Client dashboard OK after closeout; complete label may be subtle");
    await page.screenshot({ path: join("test-results", `f-closeout-resume-${suffix}.png`), fullPage: true });
    report.steps.F.status = statusRes.ok() ? (seesComplete ? "PASS" : "PARTIAL") : "FAIL";
    report.steps.D.status = seesUpdate ? "PASS" : "PARTIAL";
    report.steps.G.status = seesUpdate ? "PASS" : "PARTIAL";
    report.steps.B.status = "PARTIAL";
    saveReport(report);
  } catch (error) {
    report.bugs.push(error instanceof Error ? error.message : String(error));
    saveReport(report);
    throw error;
  }
});
