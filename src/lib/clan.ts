/**
 * Pure clan rules shared by the server actions, the read queries and the UI,
 * so permission and invite-state decisions are made (and tested) in one place.
 */

import { CLAN_ROLES, type ClanRole } from "@/lib/authz/roles"

export { CLAN_ROLES, type ClanRole }

export const CLAN_ROLE_LABELS: Record<ClanRole, string> = {
  admin: "Admin",
  management: "Management",
  member: "Member",
  guest: "Guest",
}

export function isClanRole(value: unknown): value is ClanRole {
  return CLAN_ROLES.includes(value as ClanRole)
}

/** Admins and managers can create, edit and revoke invite links. */
export function canManageInvites(role: ClanRole | null | undefined): boolean {
  return role === "admin" || role === "management"
}

/** Only admins can change another member's role. */
export function canChangeRoles(role: ClanRole | null | undefined): boolean {
  return role === "admin"
}

export const MAX_INVITE_LABEL_LENGTH = 100
export const MAX_ACTIVE_INVITES = 50

interface RoleChangeInput {
  actorId: string
  actorRole: ClanRole | null | undefined
  targetId: string
  targetRole: ClanRole | null | undefined
  newRole: ClanRole
  /** Clan owner's user id (null when the owner account is gone). */
  ownerId: string | null
  /** How many members currently hold the admin role. */
  adminCount: number
}

export type RuleFailureCode =
  | "FORBIDDEN"
  | "NOT_A_MEMBER"
  | "INVALID"
  | "OWNER_PROTECTED"
  | "LAST_ADMIN"

export type RuleResult =
  | { ok: true }
  | { ok: false; error: string; code: RuleFailureCode }

/**
 * Decides whether `actor` may set `target`'s role to `newRole`.
 * Rules: only admins change roles; the owner always stays an admin; a clan
 * never ends up without an admin.
 */
export function validateRoleChange(input: RoleChangeInput): RuleResult {
  if (!canChangeRoles(input.actorRole)) {
    return {
      ok: false,
      error: "Only clan admins can change member roles",
      code: "FORBIDDEN",
    }
  }
  if (!input.targetRole) {
    return {
      ok: false,
      error: "That player is not a member of this clan",
      code: "NOT_A_MEMBER",
    }
  }
  if (!isClanRole(input.newRole)) {
    return { ok: false, error: "Unknown role", code: "INVALID" }
  }
  if (input.targetRole === input.newRole) {
    return { ok: true }
  }
  if (input.ownerId && input.targetId === input.ownerId) {
    return {
      ok: false,
      error: "The clan owner's role cannot be changed",
      code: "OWNER_PROTECTED",
    }
  }
  if (
    input.targetRole === "admin" &&
    input.newRole !== "admin" &&
    input.adminCount <= 1
  ) {
    return {
      ok: false,
      error: "A clan needs at least one admin",
      code: "LAST_ADMIN",
    }
  }
  return { ok: true }
}

export type InviteStatus = "active" | "expired" | "revoked" | "exhausted"

interface InviteLike {
  isActive: boolean
  expiresAt: Date | string | null
  maxUses: number | null
  currentUses: number
}

/**
 * Status of an invite link. A used-up link wins over "revoked" because older
 * code deactivated an invite when its last use was spent.
 */
export function getInviteStatus(
  invite: InviteLike,
  now: Date = new Date()
): InviteStatus {
  if (invite.maxUses !== null && invite.currentUses >= invite.maxUses) {
    return "exhausted"
  }
  if (!invite.isActive) return "revoked"
  if (invite.expiresAt && new Date(invite.expiresAt) <= now) return "expired"
  return "active"
}

export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
  exhausted: "Used up",
}

export type InvitePreviewState =
  | "ready"
  | "already-member"
  | "revoked"
  | "expired"
  | "limit-reached"

/** What a visitor with this invite would see. Membership beats link state. */
export function resolveInviteState(
  invite: InviteLike,
  isMember: boolean,
  now: Date = new Date()
): InvitePreviewState {
  if (isMember) return "already-member"
  switch (getInviteStatus(invite, now)) {
    case "exhausted":
      return "limit-reached"
    case "revoked":
      return "revoked"
    case "expired":
      return "expired"
    default:
      return "ready"
  }
}

/**
 * Accepts a bare invite code or a pasted invite link
 * (`https://host/clans/join?code=<code>`) and returns the code, or null.
 */
export function parseClanInviteCode(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const fromQuery = /[?&]code=([^&#\s]+)/.exec(trimmed)?.[1]
  let code = fromQuery ?? trimmed
  try {
    code = decodeURIComponent(code)
  } catch {
    return null
  }
  // A code is a single token; reject links and sentences.
  if (/[\s/?#&=]/.test(code) || code.length > 64) return null
  return code
}

export function buildClanInviteUrl(origin: string, code: string): string {
  return `${origin}/clans/join?code=${encodeURIComponent(code)}`
}
