import { isSuperAdminEmail, normalizeEmail } from "@/lib/super-admin-email"

/**
 * Pure invariant predicates for the super-admin mutations. Each returns a
 * human-readable reason when the change must be refused, or null when it is
 * allowed. The actions evaluate them inside the transaction against rows read
 * there, so the answer cannot go stale between check and write.
 */

export function userDeleteBlocker(input: {
  actorId: string
  targetId: string
  targetEmail: string | null | undefined
  adminEmails?: readonly string[]
}): string | null {
  if (input.actorId === input.targetId) {
    return "You cannot delete your own account from the admin area."
  }
  if (isSuperAdminEmail(input.targetEmail, input.adminEmails)) {
    return "This user is on the super-admin list. Remove them from SUPER_ADMIN_EMAILS first."
  }
  return null
}

/**
 * Email edits are refused if the old or the new address (normalized) is on the
 * super-admin list, so an admin edit can neither grant nor revoke super-admin
 * access. Unchanged emails (after normalization) are always fine.
 */
export function emailChangeBlocker(input: {
  oldEmail: string | null | undefined
  newEmail: string | null | undefined
  adminEmails?: readonly string[]
}): string | null {
  if (normalizeEmail(input.oldEmail) === normalizeEmail(input.newEmail)) {
    return null
  }
  if (
    isSuperAdminEmail(input.oldEmail, input.adminEmails) ||
    isSuperAdminEmail(input.newEmail, input.adminEmails)
  ) {
    return "Emails on the super-admin list cannot be changed here, and a user cannot be given one. Change SUPER_ADMIN_EMAILS instead."
  }
  return null
}
