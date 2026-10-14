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
  "event:grant-admin",
  "event:transfer-ownership",
  "event:override-registration",
  // Participants
  "participant:list",
  "participant:add",
  "participant:remove",
  "participant:assign-team",
  "participant:set-role",
  "registration:review",
  // Statistics and player metadata
  "stats:read",
  "player-metadata:read",
  "player-metadata:write",
  "player-metadata:write-own",
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
  "submission:create-on-behalf",
] as const

export type Permission = (typeof PERMISSIONS)[number]

const MEMBER_PERMISSIONS = [
  "event:view",
  "player-metadata:write-own",
] as const satisfies readonly Permission[]

const MANAGER_PERMISSIONS = [
  ...MEMBER_PERMISSIONS,
  "participant:list",
  "participant:add",
  "participant:remove",
  "participant:assign-team",
  "registration:review",
  "stats:read",
  "player-metadata:read",
  "player-metadata:write",
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
  "submission:create-on-behalf",
] as const satisfies readonly Permission[]

const ADMIN_PERMISSIONS = [
  ...MANAGER_PERMISSIONS,
  "event:update",
  "event:delete",
  "event:invite",
  "event:assign-clan",
  "event:manage-rules",
  "event:grant-admin",
  "event:transfer-ownership",
  "event:override-registration",
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
 * Permissions only the Event owner may use even though every admin holds the
 * role permission: delete the Event, grant the admin role (to a new or an
 * existing participant) and transfer ownership. The owner is `events.creator_id`
 * (or, for an Event whose creator account is gone, its oldest admin: see
 * `buildEventActor`). Other admins keep every other admin permission.
 */
export const OWNER_ONLY_PERMISSIONS: ReadonlySet<Permission> =
  new Set<Permission>([
    "event:delete",
    "event:grant-admin",
    "event:transfer-ownership",
  ])

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
