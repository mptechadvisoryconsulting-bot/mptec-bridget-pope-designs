import { expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteClientWithConfirm, deleteLeadWithConfirm } from "../../lib/admin/delete-records";
import { withBpdNamespace } from "../../lib/supabase/namespace";
import { requireE2eEnv } from "./e2e-env";

/** Matches LoginForm CTAs: "Continue to Studio" / "Continue to Client Access" (and legacy "Sign in"). */
export const LOGIN_SUBMIT_RE = /continue to studio|continue to client|sign in/i;

export async function login(page: Page, username: string, password: string, next: string) {
  await page.goto(`/auth/login?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or Email").fill(username);
  await page.getByLabel("Password").fill(password);
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/auth/password-login"), { timeout: 45_000 }),
    page.getByRole("button", { name: LOGIN_SUBMIT_RE }).click(),
  ]);
  expect(response.ok(), `login failed: ${response.status()}`).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(next.replace(/\//g, "\\/")), { timeout: 45_000 });
}

export async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

/**
 * Destructive production suites (inquiry writes, CRM mutations, residue creators)
 * must set E2E_ALLOW_DESTRUCTIVE=true. Read-only smoke does not.
 */
export function requireDestructiveE2e(
  message = "Destructive E2E requires E2E_ALLOW_DESTRUCTIVE=true. Use production-audit-smoke for read-only checks.",
) {
  requireE2eEnv(process.env.E2E_ALLOW_DESTRUCTIVE !== "true", message);
}

export function e2eAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return withBpdNamespace(
    createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  ) as SupabaseClient;
}

export type E2eCleanupIds = {
  clientId?: string | null;
  secondClientId?: string | null;
  leadId?: string | null;
  galleryFileId?: string | null;
  authUserId?: string | null;
  secondAuthUserId?: string | null;
};

/**
 * Best-effort cleanup for full-flow residue via owner delete helpers.
 * Requires SUPABASE_SERVICE_ROLE_KEY. Never bulk-deletes non-test CRM data.
 */
export async function cleanupE2eResidue(ids: E2eCleanupIds): Promise<string[]> {
  const notes: string[] = [];
  const admin = e2eAdminClient();
  if (!admin) {
    notes.push("No service role — cleanup skipped; delete test clients via Admin → Delete (owner).");
    return notes;
  }

  for (const clientId of [ids.secondClientId, ids.clientId].filter(Boolean) as string[]) {
    const result = await deleteClientWithConfirm(admin, clientId, { confirm: "DELETE", cascade: true });
    notes.push(
      result.success
        ? `Deleted client ${clientId}: ${result.message}`
        : `Client cleanup ${clientId}: ${result.message}`,
    );
  }

  if (ids.leadId) {
    const result = await deleteLeadWithConfirm(admin, ids.leadId, "DELETE");
    notes.push(
      result.success
        ? `Deleted lead ${ids.leadId}: ${result.message}`
        : `Lead cleanup ${ids.leadId}: ${result.message}`,
    );
  }

  if (ids.galleryFileId) {
    const { error } = await admin.from("files").delete().eq("id", ids.galleryFileId);
    notes.push(error ? `Gallery file cleanup: ${error.message}` : `Deleted gallery file ${ids.galleryFileId}`);
  }

  for (const authUserId of [ids.authUserId, ids.secondAuthUserId].filter(Boolean) as string[]) {
    try {
      await admin.auth.admin.deleteUser(authUserId);
      notes.push(`Deleted auth user ${authUserId}`);
    } catch (error) {
      notes.push(`Auth user cleanup ${authUserId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return notes;
}
