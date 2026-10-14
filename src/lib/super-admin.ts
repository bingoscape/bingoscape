import { eq } from "drizzle-orm"

import { isUuid } from "@/lib/admin-list-params"
import { logger } from "@/lib/logger"
import { isSuperAdminEmail, normalizeEmail } from "@/lib/super-admin-email"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"

export interface AdminContext {
  adminId: string
  /** Normalized (lower-case) email as stored in the database. */
  email: string
}

export type AdminCheck =
  | { ok: true; admin: AdminContext }
  | { ok: false; userId: string | null }

/**
 * Resolves the current super admin.
 *
 * The JWT is not trusted for the email: it is minted at sign-in and never
 * refreshed. The user is loaded by id and the email stored in the database is
 * compared (normalized) against `SUPER_ADMIN_EMAILS`, and it must equal
 * `users.provider_verified_email`, the address the OAuth provider (Discord,
 * GitHub, Google) verified at the user's last sign-in. A deleted user or a
 * changed email therefore loses access on the next request, and a super admin
 * signs in through the provider once after RBAC 7/8 is deployed.
 */
export async function checkSuperAdmin(): Promise<AdminCheck> {
  const session = await getServerAuthSession()
  const sessionUserId = session?.user?.id
  if (!sessionUserId || !isUuid(sessionUserId)) {
    return { ok: false, userId: null }
  }

  try {
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        providerVerifiedEmail: users.providerVerifiedEmail,
      })
      .from(users)
      .where(eq(users.id, sessionUserId))
      .limit(1)

    const email = normalizeEmail(row?.email)
    // The allowlist only counts an email an OAuth provider verified at the
    // last sign-in: a credentials account (or an unverified provider email)
    // that merely carries the address must not become a super admin.
    if (
      !row ||
      !email ||
      !isSuperAdminEmail(email) ||
      normalizeEmail(row.providerVerifiedEmail) !== email
    ) {
      return { ok: false, userId: sessionUserId }
    }
    return { ok: true, admin: { adminId: row.id, email } }
  } catch (error) {
    // Fail closed: if the lookup breaks nobody is an admin.
    logger.error(
      { userId: sessionUserId, action: "checkSuperAdmin" },
      "Super-admin lookup failed",
      error instanceof Error ? error : undefined
    )
    return { ok: false, userId: sessionUserId }
  }
}

export async function isSuperAdmin(): Promise<boolean> {
  return (await checkSuperAdmin()).ok
}

/** Throws when the caller is not a super admin. Used by pages and read queries. */
export async function requireSuperAdmin(): Promise<AdminContext> {
  const check = await checkSuperAdmin()

  if (!check.ok) {
    // Log the user id only, never the email.
    logger.warn(
      { userId: check.userId, action: "requireSuperAdmin" },
      "Unauthorized access attempt to super-admin restricted action"
    )
    throw new Error("Super admin access required")
  }
  return check.admin
}
