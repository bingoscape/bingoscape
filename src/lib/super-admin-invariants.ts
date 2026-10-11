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

export interface MembershipChange {
  scope: "clan" | "event"
  /** Clans only: the member is the clan's owner. */
  isOwner: boolean
  currentRole: string
  /** Members/participants with the admin role, including the target. */
  adminCount: number
  /** The role after the change, or null when the member is removed. */
  nextRole: string | null
}

/**
 * Never leave a clan without its owner, or a clan/event without any admin,
 * through a removal or demotion.
 */
export function membershipChangeBlocker(
  change: MembershipChange
): string | null {
  const noun = change.scope === "clan" ? "clan" : "event"
  const keepsAdmin = change.nextRole === "admin"

  if (change.scope === "clan" && change.isOwner && !keepsAdmin) {
    return "This member is the clan owner. Transfer ownership first (Edit clan, then choose a new owner), then try again."
  }
  if (
    change.currentRole === "admin" &&
    !keepsAdmin &&
    change.adminCount <= 1
  ) {
    return `This is the only admin of the ${noun}. Promote another ${
      change.scope === "clan" ? "member" : "participant"
    } to admin first.`
  }
  return null
}
