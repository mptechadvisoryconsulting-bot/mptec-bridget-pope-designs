/**
 * Conservative heuristics for identifying E2E / audit test CRM rows.
 * Never match ordinary client names (lady duke, sabrina hill, Debra Myers, etc.).
 */

const SAFE_TEST_NAME_TOKENS = [/\bE2E\b/i, /\bFullFlow\b/i, /\bAudit\b/i] as const;

export type TestSignalFields = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  username?: string | null;
  eventName?: string | null;
};

function combinedName(fields: TestSignalFields) {
  if (fields.name?.trim()) return fields.name.trim();
  return [fields.firstName, fields.lastName].filter(Boolean).join(" ").trim();
}

export function isLikelyTestEmail(email?: string | null) {
  const value = (email ?? "").trim().toLowerCase();
  if (!value) return false;
  // Production E2E pattern: e2e.*@bridget-pope-designs.us (and variants)
  if (value.startsWith("e2e.")) return true;
  if (/^e2e[a-z0-9._+-]*@/i.test(value)) return true;
  return false;
}

export function isLikelyTestName(name?: string | null) {
  const value = (name ?? "").trim();
  if (!value) return false;
  return SAFE_TEST_NAME_TOKENS.some((pattern) => pattern.test(value));
}

export function isLikelyTestUsername(username?: string | null) {
  const value = (username ?? "").trim();
  if (!value) return false;
  return /^E2E/i.test(value);
}

export function isLikelyTestRecord(fields: TestSignalFields) {
  if (isLikelyTestEmail(fields.email)) return true;
  if (isLikelyTestUsername(fields.username)) return true;
  if (isLikelyTestName(combinedName(fields))) return true;
  if (isLikelyTestName(fields.eventName)) return true;
  return false;
}

export function testFilterLabel(isTest: boolean) {
  return isTest ? "Test / E2E" : null;
}
