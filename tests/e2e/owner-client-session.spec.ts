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
  referenceId?: string;
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

async function createClientWorkspace(
  suffix: string,
  label: string,
  admin: ReturnType<typeof createClient>,
): Promise<CreatedRecord> {
  const username = `e2e${label.toLowerCase()}${suffix}`;
  const password = `ClientTest${suffix}${label}!`;
  const eventName = `E2E ${label} Event ${suffix}`;
  const email = `e2e.${username}@bridget-pope-designs.us`;

  const { data: userResult, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, first_name: "E2E", last_name: label, role: "client" },
  });
  expect(userError, userError?.message).toBeNull();
  expect(userResult.user?.id).toBeTruthy();

  const authUserId = userResult.user!.id;
  const { data: profile, error: profileError } = await admin
    .from("bpd_profiles")
    .insert({
      auth_user_id: authUserId,
      username,
      role: "client",
      first_name: "E2E",
      last_name: label,
      email,
      phone: "6295550100",
      active: true,
    })
    .select("id")
    .single();
  expect(profileError, profileError?.message).toBeNull();

  const { data: client, error: clientError } = await admin.from("bpd_clients").insert({ profile_id: profile!.id }).select("id").single();
  expect(clientError, clientError?.message).toBeNull();

  const { data: project, error: projectError } = await admin
    .from("bpd_projects")
    .insert({
      client_id: client!.id,
      event_name: eventName,
      event_type: "Wedding",
      event_date: "2026-12-15",
      venue_name: "Murfreesboro, TN",
      status: "planning",
    })
    .select("id")
    .single();
  expect(projectError, projectError?.message).toBeNull();

  const { error: conversationError } = await admin.from("bpd_conversations").insert({ project_id: project!.id, client_id: client!.id });
  expect(conversationError, conversationError?.message).toBeNull();

  const { data: reference, error: referenceError } = await admin
    .from("bpd_honeybook_financial_references")
    .insert({
      project_id: project!.id,
      client_id: client!.id,
      honeybook_project_id: `HB-${suffix}-${label}`,
      honeybook_invoice_number: `INV-${suffix}-${label}`,
      invoice_total: 2500,
      amount_paid: 500,
      balance_remaining: 2000,
      invoice_status: "sent",
      honeybook_url: "https://www.honeybook.com/",
      source: "manual",
      review_status: "confirmed",
    })
    .select("id")
    .single();
  expect(referenceError, referenceError?.message).toBeNull();

  return {
    authUserId,
    profileId: profile!.id,
    clientId: client!.id,
    projectId: project!.id,
    referenceId: reference!.id,
    username,
    password,
    eventName,
  };
}

test("owner and client sessions preserve the HoneyBook project workflow", async ({ page }) => {
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
      "/admin/today",
      "/admin/leads",
      "/admin/consultations",
      "/admin/clients",
      "/admin/projects",
      "/admin/calendar",
      "/admin/tasks",
      "/admin/messages",
      "/admin/design-updates",
      "/admin/files",
      "/admin/notifications",
      "/admin/honeybook",
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
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByText(/HoneyBook Financial References/i)).toBeVisible();
    await expect(page.getByText(/Inquiry Recipient Email/i)).toBeVisible();

    if (ownerUsername && ownerPassword) {
      await clearSession(page);
      await login(page, ownerUsername, ownerPassword, "/admin");
      await page.goto("/client/", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/admin/);
      await clearSession(page);
      await login(page, adminUsername!, adminPassword!, "/admin");
    }

    const first = await createClientWorkspace(suffix, "One", admin);
    const second = await createClientWorkspace(suffix, "Two", admin);
    created.push(first, second);

    await clearSession(page);
    await login(page, first.username, first.password, "/client/dashboard");
    await expect(page.getByText(first.eventName)).toBeVisible();
    await page.goto("/client", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/client\/dashboard/);
    await expect(page.getByText(first.eventName)).toBeVisible();

    const clientRoutes = [
      "/client/dashboard",
      "/client/event",
      "/client/timeline",
      "/client/checklist",
      "/client/designs",
      "/client/files",
      "/client/messages",
      "/client/inspiration",
      "/client/honeybook",
      "/client/profile",
    ];

    for (const route of clientRoutes) {
      await navigateProtected(page, route, /client navigation/i);
    }

    await expect(page.getByText(`INV-${suffix}-One`)).toBeVisible();
    await expect(page.getByText(`INV-${suffix}-Two`)).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectProtectedShell(page, /client navigation/i);
    await backForwardProtected(page, /client navigation/i);

    const secondTab = await page.context().newPage();
    await secondTab.goto("/client/honeybook", { waitUntil: "domcontentloaded" });
    await expect(secondTab.getByText(`INV-${suffix}-One`)).toBeVisible();
    await expect(secondTab.getByText(`INV-${suffix}-Two`)).toHaveCount(0);
    await secondTab.close();
  } finally {
    for (const record of [...created].reverse()) {
      if (record.projectId) {
        await admin.from("bpd_honeybook_financial_references").delete().eq("project_id", record.projectId);
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
