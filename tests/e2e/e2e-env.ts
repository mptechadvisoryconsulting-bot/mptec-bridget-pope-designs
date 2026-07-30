import { test } from "@playwright/test";

/**
 * Gates missing E2E credentials/environment behind two modes:
 *
 * - Default (local/dev): missing credentials SKIP the suite so contributors without secrets
 *   can still run `playwright test` locally.
 * - `E2E_RELEASE_GATE=true` (release/CI gate): missing credentials FAIL the suite instead of
 *   silently skipping, so a release cannot ship with E2E coverage quietly disabled because a
 *   secret was never configured.
 *
 * Destructive suites (CRM writes / residue) also require `E2E_ALLOW_DESTRUCTIVE=true`
 * via `requireDestructiveE2e` in helpers.ts. Prefer `production-audit-smoke` for read-only prod checks.
 */
export function requireE2eEnv(missing: boolean, message: string) {
  if (missing && process.env.E2E_RELEASE_GATE === "true") {
    throw new Error(`E2E_RELEASE_GATE is enabled: ${message}`);
  }

  test.skip(missing, message);
}
