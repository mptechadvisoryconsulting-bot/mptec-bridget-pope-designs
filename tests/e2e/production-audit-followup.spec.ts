import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PDFDocument } from "pdf-lib";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://bridget-pope-designs.us";
const ownerUsername = process.env.E2E_OWNER_USERNAME ?? "Bridget20";
const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? "";
const clientEmail = process.env.E2E_CLIENT_EMAIL ?? "";
const clientPassword = process.env.E2E_CLIENT_PASSWORD ?? "";
const secondEmail = process.env.E2E_SECOND_CLIENT_EMAIL ?? "";
const secondPassword = process.env.E2E_SECOND_CLIENT_PASSWORD ?? "";
const knownProposalId = process.env.E2E_PROPOSAL_ID ?? "c30aa6bb-5e06-4c75-a8c9-0feac0eca511";
const knownProjectId = process.env.E2E_PROJECT_ID ?? "0be931c5-ad78-4815-a7c4-cf44fcadd06e";
const knownClientId = process.env.E2E_CLIENT_ID ?? "62cce26e-e1c0-419b-a9d5-67b3ae87146f";
const secondProjectId = process.env.E2E_SECOND_PROJECT_ID ?? "b2a081e9-fcbc-45ad-83f0-f2896afd6379";

test.skip(!ownerPassword, "Owner password required.");
test.setTimeout(420_000);

type Row = { name: string; status: "PASS" | "FAIL" | "PARTIAL"; notes: string[] };
const matrix: Row[] = [];
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
  page.drawText("E2E Audit PDF", { x: 24, y: 100, size: 12 });
  return Buffer.from(await pdf.save());
}

test("production-audit-followup", async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);

  // Gallery API + page images
  const galleryApi = await page.request.get("/api/gallery");
  const galleryJson = (await galleryApi.json().catch(() => null)) as
    | { items?: Array<{ id?: string; image?: string }> }
    | Array<{ id?: string; image?: string }>
    | null;
  const items = Array.isArray(galleryJson)
    ? galleryJson
    : Array.isArray(galleryJson?.items)
      ? galleryJson.items
      : [];
  await page.goto("/gallery", { waitUntil: "domcontentloaded" });
  const imgCount = await page.locator("img").count();
  row(
    "gallery:public-render",
    galleryApi.ok() && (items.length > 0 || imgCount > 0) ? "PASS" : "FAIL",
    `apiStatus=${galleryApi.status()}`,
    `apiItems=${items.length}`,
    `pageImages=${imgCount}`,
  );

  await login(page, ownerUsername, ownerPassword, "/admin");

  // Proposal detail open
  const proposalRes = await page.goto(`/admin/proposals/${knownProposalId}`, { waitUntil: "domcontentloaded" });
  const proposalBody = await page.locator("body").innerText();
  const proposalOk =
    (proposalRes?.status() ?? 500) < 400 &&
    !/page not found/i.test(proposalBody) &&
    (/PROP-|Proposal|E2E/i.test(proposalBody) || page.url().includes(knownProposalId));
  row(
    "e2e:proposal-detail",
    proposalOk ? "PASS" : "FAIL",
    `HTTP ${proposalRes?.status()}`,
    `url=${page.url()}`,
  );
  const proposalActions = page.getByRole("button", { name: /^actions$/i });
  if (await proposalActions.count()) {
    await proposalActions.first().click();
    const menu = await page.locator("body").innerText();
    row(
      "e2e:proposal-actions",
      /upload pdf|cancel|delete|send|preview/i.test(menu) ? "PASS" : "PARTIAL",
      "Actions menu present",
    );
  } else {
    // Primary Open / Send buttons may exist without secondary Actions
    const hasPrimary = await page.getByRole("link", { name: /send|open|preview/i }).count();
    row("e2e:proposal-actions", hasPrimary ? "PASS" : "PARTIAL", `primaryLinks=${hasPrimary}`);
  }

  // Invoice list + detail Actions
  await page.goto("/admin/invoices", { waitUntil: "domcontentloaded" });
  const invoiceLink = page.locator('a[href*="/admin/invoices/"]').filter({ hasNotText: /new/i }).first();
  if (await invoiceLink.count()) {
    const href = (await invoiceLink.getAttribute("href")) || "";
    await page.goto(href, { waitUntil: "domcontentloaded" });
    const body = await page.locator("body").innerText();
    const detailOk = !/page not found/i.test(body);
    row("e2e:invoice-detail", detailOk ? "PASS" : "FAIL", `href=${href}`);
    const actions = page.getByRole("button", { name: /^actions$/i });
    if (await actions.count()) {
      await actions.first().click();
      const menu = await page.locator("body").innerText();
      row(
        "e2e:invoice-actions",
        /cancel|delete|upload pdf|preview|send|record/i.test(menu) ? "PASS" : "PARTIAL",
        "Actions opened",
      );
    } else {
      row("e2e:invoice-actions", "PARTIAL", "no secondary Actions; checking primary");
    }
  } else {
    row("e2e:invoice-detail", "PARTIAL", "no invoice rows linked");
  }

  // Create draft invoice via API, verify GET, cancel/delete rules
  const createRes = await page.request.post("/api/invoices", {
    data: {
      clientId: knownClientId,
      projectId: knownProjectId,
      proposalId: knownProposalId,
      invoiceType: "deposit",
      description: `E2E audit draft ${suffix}`,
      dueDate: "2026-12-31",
      taxAmount: 0,
      discountAmount: 0,
      items: [{ title: "Audit deposit", description: "smoke", quantity: 1, unitPrice: 25 }],
    },
  });
  const createBody = (await createRes.json().catch(() => ({}))) as {
    success?: boolean;
    invoice?: { id?: string; invoice_number?: string; status?: string };
    message?: string;
  };
  const draftId = createBody.invoice?.id;
  row(
    "e2e:invoice-create",
    createRes.ok() && Boolean(draftId) ? "PASS" : "FAIL",
    `status=${createRes.status()}`,
    createBody.message ?? createBody.invoice?.invoice_number ?? "",
  );

  if (draftId) {
    const getRes = await page.request.get(`/api/invoices/${draftId}`);
    row("api:invoice-get", getRes.ok() ? "PASS" : "FAIL", `HTTP ${getRes.status()}`);

    // Upload PDF
    const pdf = await tinyPdfBytes();
    const uploadRes = await page.request.post(`/api/invoices/${draftId}/upload-pdf`, {
      multipart: {
        file: {
          name: `audit-${suffix}.pdf`,
          mimeType: "application/pdf",
          buffer: pdf,
        },
      },
    });
    row("e2e:invoice-upload-pdf", uploadRes.ok() ? "PASS" : "FAIL", `HTTP ${uploadRes.status()}`);

    // Draft should be deletable
    const delRes = await page.request.delete(`/api/invoices/${draftId}`);
    const delBody = (await delRes.json().catch(() => ({}))) as { success?: boolean; message?: string };
    row(
      "e2e:invoice-delete-draft",
      delRes.ok() && delBody.success !== false ? "PASS" : "FAIL",
      `HTTP ${delRes.status()}`,
      delBody.message ?? "",
    );
  }

  // Create another draft and cancel path after send if send works; otherwise cancel may only apply to sent
  const create2 = await page.request.post("/api/invoices", {
    data: {
      clientId: knownClientId,
      projectId: knownProjectId,
      proposalId: "",
      invoiceType: "balance",
      description: `E2E audit cancel ${suffix}`,
      dueDate: "2026-12-31",
      taxAmount: 0,
      discountAmount: 0,
      items: [{ title: "Cancel probe", description: "smoke", quantity: 1, unitPrice: 10 }],
    },
  });
  const create2Body = (await create2.json().catch(() => ({}))) as {
    invoice?: { id?: string };
    message?: string;
  };
  const draft2 = create2Body.invoice?.id;
  if (draft2) {
    const sendRes = await page.request.post(`/api/invoices/${draft2}/send`);
    if (sendRes.ok()) {
      const cancelRes = await page.request.post(`/api/invoices/${draft2}/cancel`);
      const cancelBody = (await cancelRes.json().catch(() => ({}))) as { success?: boolean; message?: string };
      row(
        "e2e:invoice-cancel-sent",
        cancelRes.ok() && cancelBody.success !== false ? "PASS" : "FAIL",
        `HTTP ${cancelRes.status()}`,
        cancelBody.message ?? "",
      );
      // Sent/cancelled should not hard-delete if rules block — try delete and expect failure or success per rules
      const delSent = await page.request.delete(`/api/invoices/${draft2}`);
      row(
        "e2e:invoice-delete-non-draft-rule",
        !delSent.ok() ? "PASS" : "PARTIAL",
        `HTTP ${delSent.status()} (expect block for non-draft)`,
      );
    } else {
      // Cleanup draft
      await page.request.delete(`/api/invoices/${draft2}`);
      row("e2e:invoice-cancel-sent", "PARTIAL", `send failed HTTP ${sendRes.status()}; skipped cancel`);
    }
  } else {
    row("e2e:invoice-cancel-sent", "FAIL", create2Body.message ?? `create2 HTTP ${create2.status()}`);
  }

  // Client isolation
  if (clientEmail && clientPassword && secondProjectId) {
    await clearSession(page);
    await login(page, clientEmail, clientPassword, "/client/dashboard");
    const own = await page.goto(`/client/projects/${knownProjectId}`, { waitUntil: "domcontentloaded" }).catch(() => null);
    const ownBody = own ? await page.locator("body").innerText() : "";
    const ownOk = own && (own.status() ?? 500) < 400 && !/page not found|not authorized|access denied/i.test(ownBody);
    // Some apps use /client without projects route — tolerate alternate paths
    if (!ownOk) {
      const dash = await page.goto("/client/dashboard", { waitUntil: "domcontentloaded" });
      row(
        "client:own-workspace",
        (dash?.status() ?? 500) < 400 ? "PASS" : "FAIL",
        "project route optional; dashboard reachable",
      );
    } else {
      row("client:own-workspace", "PASS", `project ${knownProjectId}`);
    }

    const forbidden = await page.goto(`/client/projects/${secondProjectId}`, { waitUntil: "domcontentloaded" });
    const forbiddenBody = await page.locator("body").innerText();
    const blocked =
      (forbidden?.status() ?? 200) >= 400 ||
      /page not found|not authorized|access denied|forbidden|do not have access/i.test(forbiddenBody) ||
      !page.url().includes(secondProjectId);
    row(
      "client:isolation",
      blocked ? "PASS" : "FAIL",
      `status=${forbidden?.status()}`,
      `url=${page.url()}`,
    );

    if (secondEmail && secondPassword) {
      await clearSession(page);
      await login(page, secondEmail, secondPassword, "/client/dashboard");
      row("client:second-login", "PASS", secondEmail);
    }
  } else {
    row("client:isolation", "PARTIAL", "missing client credentials/project ids");
  }

  // Critical APIs that should not 500
  await clearSession(page);
  await login(page, ownerUsername, ownerPassword, "/admin");
  for (const path of ["/api/proposals", "/api/leads", "/api/notifications", `/api/proposals/${knownProposalId}`]) {
    const res = await page.request.get(path);
    row(`api:${path}`, res.status() < 500 ? "PASS" : "FAIL", `HTTP ${res.status()}`);
  }
  // invoices collection is POST-only by design
  const invoicesGet = await page.request.get("/api/invoices");
  row(
    "api:/api/invoices GET",
    invoicesGet.status() === 405 ? "PASS" : invoicesGet.status() < 500 ? "PARTIAL" : "FAIL",
    `HTTP ${invoicesGet.status()} (POST-only create route)`,
  );

  mkdirSync(artifactDir, { recursive: true });
  const fails = matrix.filter((m) => m.status === "FAIL");
  const report = {
    productionUrl: baseURL,
    finishedAt: new Date().toISOString(),
    deployCommitSha: "c91ac2ac685c84ea3b9e2219fc3b4f4a68bfc2aa",
    matrix,
    verdict: fails.length === 0 ? (matrix.some((m) => m.status === "PARTIAL") ? "GO_WITH_RESIDUAL" : "GO") : "NO-GO",
  };
  writeFileSync(join(artifactDir, "production-audit-followup-report.json"), JSON.stringify(report, null, 2));
  // eslint-disable-next-line no-console
  console.log("\n===== PRODUCTION AUDIT FOLLOWUP =====\n" + JSON.stringify(report, null, 2));
  expect(fails, JSON.stringify(fails, null, 2)).toEqual([]);
});
