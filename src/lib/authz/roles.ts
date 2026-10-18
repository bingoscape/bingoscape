import type { clanRoleEnum, eventRoleEnum } from "@/server/db/schema"

/**
 * Role types, derived from the database enums so there is exactly one
 * definition. Type-only imports: this module (and everything else under
 * `src/lib/authz/`) is pure and safe to import from client components.
 */
export type EventRole = (typeof eventRoleEnum.enumValues)[number]
export type ClanRole = (typeof clanRoleEnum.enumValues)[number]

/** Highest first. */
export const EVENT_ROLES = [
  "admin",
  "management",
  "participant",
] as const satisfies readonly EventRole[]

/** Highest first. */
export const CLAN_ROLES = [
  "admin",
  "management",
  "member",
  "guest",
] as const satisfies readonly ClanRole[]

/**
 * Rank of an Event role; a higher number means more authority. The `Record`
 * type makes the compiler flag a role that is added to the enum but not ranked.
 */
export const EVENT_ROLE_RANK = {
  participant: 0,
  management: 1,
  admin: 2,
} as const satisfies Record<EventRole, number>

export function isEventRole(value: unknown): value is EventRole {
  return EVENT_ROLES.includes(value as EventRole)
}

/** The roles that manage an Event, for database filters. */
export const MANAGER_ROLES = [
  "admin",
  "management",
] as const satisfies readonly EventRole[]

/**
 * "Manager" means the `admin` or `management` role of an Event or a Clan (both
 * ladders share the two top rungs).
 */
export function isManagerRole(
  role: EventRole | ClanRole | null | undefined
): boolean {
  return role === "admin" || role === "management"
}

/** The top rung of an Event or Clan ladder. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin"
}

/**
 * Whether demoting or removing this member would leave the Event or Clan
 * without an admin: they are an admin and the only one (`adminCount` counts
 * every admin, this member included).
 */
export function isLastAdmin(
  role: EventRole | ClanRole | null | undefined,
  adminCount: number
): boolean {
  return isAdminRole(role) && adminCount <= 1
}

const EVENT_ROLE_LABELS = {
  admin: "Admin",
  management: "Management",
  participant: "Participant",
} as const satisfies Record<EventRole, string>

/** Display name of an Event role (for badges and selects). */
export function eventRoleLabel(role: EventRole): string {
  return EVENT_ROLE_LABELS[role]
}
