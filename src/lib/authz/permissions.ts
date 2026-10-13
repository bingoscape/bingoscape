import type { EventRole } from "./roles"

/**
 * Every action an Event member can be allowed to perform, named
 * `<subject>:<action>`. The role -> permission map below is the single place
 * that says what a role may do; it reproduces what the inline role checks
 * enforced before the policy layer existed (management can edit buy-ins and
 * donations, but not roles).
 */
export const PERMISSIONS = [
  // Event
  "event:view",
  "event:update",
  "event:delete",
  "event:invite",
  "event:assign-clan",
  "event:manage-rules",
  // Participants
  "participant:list",
  "participant:add",
  "participant:remove",
  "participant:assign-team",
  "participant:set-role",
  "registration:review",
  // Money
  "finance:read",
  "finance:write",
  // Integrations
  "webhook:manage",
  // Teams
  "team:manage",
  "team:access",
  "team:lead",
  // Boards
  "board:manage",
  "board:view-secret",
  // Submissions
  "submission:create",
  "submission:review",
  "submission:comment",
  "submission:read-comments",
] as const

export type Permission = (typeof PERMISSIONS)[number]

const MEMBER_PERMISSIONS = [
  "event:view",
] as const satisfies readonly Permission[]

const MANAGER_PERMISSIONS = [
  ...MEMBER_PERMISSIONS,
  "participant:list",
  "participant:add",
  "participant:remove",
  "participant:assign-team",
  "registration:review",
  "finance:read",
  "finance:write",
  "webhook:manage",
  "team:manage",
  "team:access",
  "team:lead",
  "board:manage",
  "board:view-secret",
  "submission:create",
  "submission:review",
  "submission:comment",
  "submission:read-comments",
] as const satisfies readonly Permission[]

const ADMIN_PERMISSIONS = [
  ...MANAGER_PERMISSIONS,
  "event:update",
  "event:delete",
  "event:invite",
  "event:assign-clan",
  "event:manage-rules",
  "participant:set-role",
] as const satisfies readonly Permission[]

/**
 * What each Event role is granted unconditionally. Permissions that depend on
 * a relation (the Team a Tile belongs to, the role of the target participant)
 * are refined by `can()` in `policy.ts`; Team members additionally get the
 * Team scoped permissions for their own Team there.
 */
export const ROLE_PERMISSIONS: Record<EventRole, readonly Permission[]> = {
  admin: ADMIN_PERMISSIONS,
  management: MANAGER_PERMISSIONS,
  participant: MEMBER_PERMISSIONS,
}

/**
 * Permissions only the Event owner (the creator) may use even though other
 * admins hold the role permission. Empty on purpose: today an admin may do
 * everything the creator may. Delete Event, grant admin and transfer ownership
 * are the candidates (see the RBAC epic), to be decided separately.
 */
export const OWNER_ONLY_PERMISSIONS: ReadonlySet<Permission> = new Set()

/**
 * Team scoped permissions a plain Team member (or leader) holds for their own
 * Team, without any Event role.
 */
export const TEAM_RELATION_PERMISSIONS = {
  "team:access": "member",
  "team:lead": "leader",
  "submission:create": "member",
  "submission:read-comments": "member",
} as const satisfies Partial<Record<Permission, "member" | "leader">>
