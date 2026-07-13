import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { requireE2eEnv } from "./e2e-env";

const adminUsername = process.env.E2E_ADMIN_USERNAME;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const ownerUsername = process.env.E2E_OWNER_USERNAME;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

requireE2eEnv(
  !adminUsername || !adminPassword || !supabaseUrl || !serviceRoleKey,
  "Admin credentials (E2E_ADMIN_USERNAME/E2E_ADMIN_PASSWORD) and Supabase service role env (NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY) are required for full session tests.",
);
test.setTimeout(900_000);

type CreatedRecord = {
  authUserId?: string;
  profileId?: string;
  clientId?: string;
  projectId?: string;
  invoiceId?: string;
  username: string;
  password: string;
  eventName: string;
};

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
  await page.waitForLoadState("networkidle");
}

async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

async function expectProtectedShell(page: Page, shellLabel: RegExp) {
  await expect(page.getByRole("heading", { name: /welcome back/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /page not found/i })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: shellLabel })).toBeVisible();
}

async function navigateProtected(page: Page, path: string, shellLabel: RegExp) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${path} should not return a 404`).not.toBe(404);
  await expect(page).not.toHaveURL(/\/auth\/login/);
  await expectProtectedShell(page, shellLabel);
}

async function backForwardProtected(page: Page, shellLabel: RegExp) {
  await page.goBack({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null);
  await expect(page).not.toHaveURL(/\/auth\/login/);
  await expectProtectedShell(page, shellLabel);
  await page.goForward({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null);
  await expect(page).not.toHaveURL(/\/auth\/login/);
  await expectProtectedShell(page, shellLabel);
}

async function createClientWorkspace(page: Page, suffix: string, label: string): Promise<CreatedRecord> {
  const username = `E2E${label}${suffix}`;
  const password = `ClientTest${suffix}${label}!`;
  const eventName = `E2E ${label} Event ${suffix}`;
  const accountResponse = await page.request.post("/api/admin/client-accounts", {
    data: {
      username,
      password,
      firstName: "E2E",
      lastName: label,
      email: `${username.toLowerCase()}@example.com`,
      phone: "6295550100",
      eventName,
      eventType: "Wedding",
      eventDate: "2026-12-15",
      venue: "Murfreesboro, TN",
      status: "planning",
    },
  });
  expect(accountResponse.ok()).toBeTruthy();
  const payload = await accountResponse.json();
  return {
    authUserId: payload.authUserId,
    profileId: payload.profileId,
    clientId: payload.clientId,
    projectId: payload.projectId,
    username,
    password,
    eventName,
  };
}

async function createInvoice(page: Page, record: CreatedRecord) {
  const invoiceResponse = await page.request.post("/api/invoices", {
    data: {
      clientId: record.clientId,
      projectId: record.projectId,
      proposalId: "",
      invoiceType: "deposit",
      description: "E2E deposit invoice",
      dueDate: "2026-11-01",
      taxAmount: 0,
      discountAmount: 0,
      templateOverrides: {
        paymentTerms: "E2E invoice terms.",
      },
      items: [
        {
          title: "Design retainer",
          description: "E2E test item",
          quantity: 1,
          unitPrice: 125,
        },
      ],
    },
  });
  expect(invoiceResponse.ok()).toBeTruthy();
  const payload = await invoiceResponse.json();
  record.invoiceId = payload.invoice.id;
  return payload.invoice;
}

test("owner routes, client invoice sync, and client isolation", async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const created: CreatedRecord[] = [];
  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    await login(page, adminUsername!, adminPassword!, "/admin");
    await expect(page.getByRole("heading", { name: /bridget pope designs/i })).toBeVisible();
    await page.goto("/client", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin/);

    const adminRoutes = [
      "/admin",
      "/admin/leads",
      "/admin/clients",
      "/admin/projects",
      "/admin/calendar",
      "/admin/tasks",
      "/admin/messages",
      "/admin/design-updates",
      "/admin/files",
      "/admin/proposals",
      "/admin/contracts",
      "/admin/invoices",
      "/admin/payments",
      "/admin/inventory",
      "/admin/gallery",
      "/admin/reports",
      "/admin/settings",
      "/admin/settings/payments",
    ];

    for (const route of adminRoutes) {
      await navigateProtected(page, route, /admin navigation/i);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectProtectedShell(page, /admin navigation/i);
    await backForwardProtected(page, /admin navigation/i);

    await page.goto("/admin/settings", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
    await expect(page.getByText(/Payment Setup \/ Payout Status/i)).toBeVisible();
    await expect(page.getByText(/Consultation Inquiry Email/i)).toBeVisible();

    await page.goto("/admin/invoice-templates", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /invoice templates/i })).toBeVisible();
    await page.goto("/admin/invoice-templates/new", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /new invoice template/i })).toBeVisible();
    await expect(page.getByText(/Template Settings/i)).toBeVisible();

    if (ownerUsername && ownerPassword) {
      await clearSession(page);
      await login(page, ownerUsername, ownerPassword, "/admin");
      await page.goto("/client/", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/admin/);
      await clearSession(page);
      await login(page, adminUsername!, adminPassword!, "/admin");
    }

    const first = await createClientWorkspace(page, suffix, "One");
    const second = await createClientWorkspace(page, suffix, "Two");
    created.push(first, second);
    const firstInvoice = await createInvoice(page, first);
    await createInvoice(page, second);

    await clearSession(page);
    await login(page, first.username, first.password, "/client/dashboard");
    await expect(page.getByText(first.eventName)).toBeVisible();
    await page.goto("/client", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/client\/dashboard/);
    await expect(page.getByText(first.eventName)).toBeVisible();
    await page.goto("/client/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/client\/dashboard/);
    await expect(page.getByText(first.eventName)).toBeVisible();

    const clientRoutes = [
      "/client/dashboard",
      "/client/event",
      "/client/proposals",
      "/client/contracts",
      "/client/payments",
      "/client/invoices",
      "/client/timeline",
      "/client/checklist",
      "/client/designs",
      "/client/files",
      "/client/messages",
      "/client/inspiration",
      "/client/documents",
      "/client/profile",
    ];

    for (const route of clientRoutes) {
      await navigateProtected(page, route, /client navigation/i);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectProtectedShell(page, /client navigation/i);
    await backForwardProtected(page, /client navigation/i);

    await page.goto(`/client/invoices/${first.invoiceId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: firstInvoice.invoice_number })).toBeVisible();
    await expect(page.getByText("E2E invoice terms.")).toBeVisible();
    await expect(page.getByRole("button", { name: /pay invoice/i })).toBeVisible();

    const secondTab = await page.context().newPage();
    await secondTab.goto(`/client/invoices/${second.invoiceId}`, { waitUntil: "domcontentloaded" });
    await expect(secondTab.getByRole("heading", { name: /page not found/i })).toBeVisible();
    await secondTab.close();
  } finally {
    for (const record of [...created].reverse()) {
      if (record.projectId) {
        await admin.from("bpd_payment_adjustments").delete().eq("project_id", record.projectId);
        await admin.from("bpd_payment_attempts").delete().eq("project_id", record.projectId);
        await admin.from("bpd_payments").delete().eq("project_id", record.projectId);
        if (record.invoiceId) await admin.from("bpd_invoice_versions").delete().eq("invoice_id", record.invoiceId);
        await admin.from("bpd_invoices").delete().eq("project_id", record.projectId);
        const { data: conversations } = await admin.from("bpd_conversations").select("id").eq("project_id", record.projectId);
        const conversationIds = conversations?.map((row) => row.id) ?? [];
        if (conversationIds.length) await admin.from("bpd_messages").delete().in("conversation_id", conversationIds);
        await admin.from("bpd_conversations").delete().eq("project_id", record.projectId);
        await admin.from("bpd_notifications").delete().eq("project_id", record.projectId);
        await admin.from("bpd_projects").delete().eq("id", record.projectId);
      }

      if (record.clientId) await admin.from("bpd_clients").delete().eq("id", record.clientId);
      if (record.profileId) await admin.from("bpd_profiles").delete().eq("id", record.profileId);
      if (record.authUserId) await admin.auth.admin.deleteUser(record.authUserId);
    }
  }
});
