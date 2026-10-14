import {
  OWNER_ONLY_PERMISSIONS,
  ROLE_PERMISSIONS,
  TEAM_RELATION_PERMISSIONS,
  type Permission,
} from "./permissions"
import { EVENT_ROLE_RANK, type EventRole } from "./roles"

/** A Team the actor belongs to within the Event. */
export interface ActorTeam {
  teamId: string
  isLeader: boolean
}

/**
 * The signed-in user, as seen by one Event. `role` is the user's participant
 * row and nothing else: the creator has an `admin` row (written when the Event
 * is created, guaranteed by migrations 0038 and 0041 and checked by the
 * `creator_without_participant_row` / `creator_role_conflicts` verification
 * queries), so nothing special-cases the creator.
 */
export interface EventActor {
  userId: string
  eventId: string
  /** Effective role; null when the user takes no part in the Event. */
  role: EventRole | null
  /**
   * True for the Event owner: the creator (`events.creator_id`), or the oldest
   * admin of an Event whose creator account is gone.
   */
  isOwner: boolean
  teams: readonly ActorTeam[]
}

/** What the permission is about, for the rules that depend on a relation. */
export interface PolicyResource {
  /** The Team a Tile, Submission or Team action refers to. */
  teamId?: string
  /** Role of the participant that is acted upon (remove, change role). */
  targetRole?: EventRole
  /** Role that is being granted. */
  newRole?: EventRole
}

interface ActorFacts {
  userId: string
  eventId: string
  creatorId: string | null
  /**
   * Owner stand-in for an Event whose creator account is gone
   * (`creatorId === null`): the oldest admin. Ignored while a creator exists.
   */
  ownerFallbackId?: string | null
  /** The user's `event_participants.role`, if they have a row. */
  participantRole: EventRole | null
  teams?: readonly ActorTeam[]
}

/**
 * The role is the participant row; ownership is a separate pointer. The owner
 * is the creator, or, without a creator, the oldest admin (`ownerFallbackId`),
 * so owner-only actions never become unreachable. An owner always has an
 * `admin` row; if one does not (a data fault the verification queries report),
 * they hold no role and cannot act, instead of silently counting as admin.
 */
export function buildEventActor(facts: ActorFacts): EventActor {
  const ownerId = facts.creatorId ?? facts.ownerFallbackId ?? null
  const isOwner = ownerId !== null && ownerId === facts.userId
  return {
    userId: facts.userId,
    eventId: facts.eventId,
    role: facts.participantRole,
    isOwner,
    teams: facts.teams ?? [],
  }
}

/** Relational rules on top of the role grant. */
function roleRulesHold(
  role: EventRole,
  permission: Permission,
  resource: PolicyResource
): boolean {
  const rank = EVENT_ROLE_RANK[role]
  if (
    permission === "participant:add" &&
    resource.newRole !== undefined &&
    EVENT_ROLE_RANK[resource.newRole] > rank
  ) {
    // Nobody adds a participant with a role above their own.
    return false
  }
  if (
    (permission === "participant:remove" ||
      permission === "participant:set-role") &&
    resource.targetRole !== undefined &&
    EVENT_ROLE_RANK[resource.targetRole] > rank
  ) {
    // Nobody acts on a participant above their own role (management cannot
    // remove an admin).
    return false
  }
  if (
    permission === "participant:set-role" &&
    resource.newRole !== undefined &&
    EVENT_ROLE_RANK[resource.newRole] > rank
  ) {
    // Nobody grants a role above their own.
    return false
  }
  return true
}

function grantedByTeam(
  actor: EventActor,
  permission: Permission,
  resource: PolicyResource
): boolean {
  const relation = (
    TEAM_RELATION_PERMISSIONS as Partial<
      Record<Permission, "member" | "leader">
    >
  )[permission]
  if (!relation || resource.teamId === undefined) return false
  const team = actor.teams.find((t) => t.teamId === resource.teamId)
  if (!team) return false
  return relation === "member" || team.isLeader
}

/**
 * Pure policy: may `actor` do `permission` (optionally on `resource`)?
 * A null actor (not signed in) can do nothing. Without a resource only the
 * unconditional role grant is evaluated, which is what UI capabilities use.
 */
export function can(
  actor: EventActor | null,
  permission: Permission,
  resource: PolicyResource = {}
): boolean {
  return evaluatePolicy(actor, permission, resource, OWNER_ONLY_PERMISSIONS)
}

/**
 * `can` with an explicit owner-only set and role map; exported so rules that
 * no current role exercises can still be tested.
 */
export function evaluatePolicy(
  actor: EventActor | null,
  permission: Permission,
  resource: PolicyResource,
  ownerOnly: ReadonlySet<Permission>,
  rolePermissions: Record<EventRole, readonly Permission[]> = ROLE_PERMISSIONS
): boolean {
  if (!actor) return false
  if (ownerOnly.has(permission) && !actor.isOwner) return false
  if (
    (permission === "participant:set-role" ||
      permission === "participant:add") &&
    resource.newRole === "admin" &&
    ownerOnly.has("event:grant-admin") &&
    !actor.isOwner
  ) {
    // Granting the admin role is owner-only, whichever way it is granted.
    return false
  }

  if (
    actor.role !== null &&
    rolePermissions[actor.role].includes(permission) &&
    roleRulesHold(actor.role, permission, resource)
  ) {
    return true
  }
  return grantedByTeam(actor, permission, resource)
}
