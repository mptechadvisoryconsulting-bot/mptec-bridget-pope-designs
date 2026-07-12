import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const adminUsername = process.env.E2E_ADMIN_USERNAME;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(!adminUsername || !adminPassword || !supabaseUrl || !serviceRoleKey, "Admin credentials and Supabase service role env are required for full session tests.");

async function login(page: Page, username: string, password: string, next: string) {
  const response = await page.request.post("/api/auth/password-login", {
    data: { credential: username, password },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto(next);
  await expect(page).toHaveURL(new RegExp(next.replace(/\//g, "\\/")));
}

test("owner creates client and invoice, then client views the synced invoice", async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const clientUsername = `E2E${suffix}`;
  const clientPassword = `ClientTest${suffix}!`;
  let created: { authUserId?: string; profileId?: string; clientId?: string; projectId?: string; invoiceId?: string } = {};

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    await login(page, adminUsername!, adminPassword!, "/admin");
    await expect(page.getByRole("heading", { name: /dashboard overview/i })).toBeVisible();

    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
    await expect(page.getByText(/Stripe Connect Payments/i)).toBeVisible();
    await expect(page.getByText(/Consultation Inquiry Email/i)).toBeVisible();

    const accountResponse = await page.request.post("/api/admin/client-accounts", {
      data: {
        username: clientUsername,
        password: clientPassword,
        firstName: "E2E",
        lastName: "Client",
        email: `${clientUsername.toLowerCase()}@example.com`,
        phone: "6295550100",
        eventName: `E2E Event ${suffix}`,
        eventType: "Wedding",
        eventDate: "2026-12-15",
        venue: "Murfreesboro, TN",
        status: "planning",
      },
    });
    expect(accountResponse.ok()).toBeTruthy();
    const accountPayload = await accountResponse.json();
    created = {
      authUserId: accountPayload.authUserId,
      profileId: accountPayload.profileId,
      clientId: accountPayload.clientId,
      projectId: accountPayload.projectId,
    };

    const invoiceResponse = await page.request.post("/api/invoices", {
      data: {
        clientId: created.clientId,
        projectId: created.projectId,
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
    const invoicePayload = await invoiceResponse.json();
    created.invoiceId = invoicePayload.invoice.id;

    await page.goto("/auth/logout");
    await login(page, clientUsername, clientPassword, "/client/dashboard");
    await expect(page.getByText(`E2E Event ${suffix}`)).toBeVisible();
    await page.goto(`/client/invoices/${created.invoiceId}`);
    await expect(page.getByRole("heading", { name: invoicePayload.invoice.invoice_number })).toBeVisible();
    await expect(page.getByText("E2E invoice terms.")).toBeVisible();
    await expect(page.getByRole("button", { name: /pay invoice/i })).toBeVisible();
  } finally {
    if (created.projectId) {
      await admin.from("bpd_payments").delete().eq("project_id", created.projectId);
      if (created.invoiceId) await admin.from("bpd_invoice_versions").delete().eq("invoice_id", created.invoiceId);
      await admin.from("bpd_invoices").delete().eq("project_id", created.projectId);
      const { data: conversations } = await admin.from("bpd_conversations").select("id").eq("project_id", created.projectId);
      const conversationIds = conversations?.map((row) => row.id) ?? [];
      if (conversationIds.length) await admin.from("bpd_messages").delete().in("conversation_id", conversationIds);
      await admin.from("bpd_conversations").delete().eq("project_id", created.projectId);
      await admin.from("bpd_notifications").delete().eq("project_id", created.projectId);
      await admin.from("bpd_projects").delete().eq("id", created.projectId);
    }

    if (created.clientId) await admin.from("bpd_clients").delete().eq("id", created.clientId);
    if (created.profileId) await admin.from("bpd_profiles").delete().eq("id", created.profileId);
    if (created.authUserId) await admin.auth.admin.deleteUser(created.authUserId);
  }
});
