/**
 * Pure helpers for the super-admin email allowlist. No DB or session access
 * here so they can be unit tested and shared by the guard and the invariants.
 */

/** Lower-cases and trims an email. Returns null for empty or missing values. */
export function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase()
  return normalized ? normalized : null
}

/** Parses a comma-separated env value into a de-duplicated list of normalized emails. */
export function parseSuperAdminEmails(raw: string | undefined): string[] {
  if (!raw) return []
  const emails = raw
    .split(",")
    .map((entry) => normalizeEmail(entry))
    .filter((entry): entry is string => entry !== null)
  return [...new Set(emails)]
}

/**
 * Reads `SUPER_ADMIN_EMAILS` on every call (not at module load), so a changed
 * env value is picked up and tests can set it per case.
 */
export function getSuperAdminEmails(): string[] {
  return parseSuperAdminEmails(process.env.SUPER_ADMIN_EMAILS)
}

/** True when the (normalized) email is on the super-admin list. */
export function isSuperAdminEmail(
  email: string | null | undefined,
  list: readonly string[] = getSuperAdminEmails()
): boolean {
  const normalized = normalizeEmail(email)
  return normalized !== null && list.includes(normalized)
}

/** Masks an email for audit logs: `jane@example.com` -> `j***@example.com`. */
export function maskEmail(email: string | null | undefined): string | null {
  const normalized = normalizeEmail(email)
  if (!normalized) return null
  const at = normalized.lastIndexOf("@")
  if (at < 1) return "***"
  return `${normalized.slice(0, 1)}***${normalized.slice(at)}`
}
