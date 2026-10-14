import { PERMISSIONS, type Permission } from "./permissions"
import { buildEventActor, can, type EventActor } from "./policy"
import { EVENT_ROLES, isManagerRole, type EventRole } from "./roles"

/**
 * Serialisable summary of what the actor may do in an Event, computed on the
 * server and passed to client components as a prop. Permissions that depend on
 * a relation (a specific Team, a target participant) are evaluated without a
 * resource, i.e. only the unconditional role grant counts; the two role lists
 * (`assignableRoles`, `removableRoles`) cover the relation that matters for the
 * participants table.
 *
 * These are UI affordances only: what is shown, hidden or disabled. Every
 * action is still checked by the server guard, which stays the authority.
 * Components never compare a role string; they read a boolean from here.
 */
export interface EventCapabilities {
  /** Effective role, for display (a badge, a label); never for a decision. */
  role: EventRole | null
  isOwner: boolean
  isManager: boolean
  isAdmin: boolean
  can: Record<Permission, boolean>

  /** Sees the manager pages (participants, Board submissions ...). */
  canViewManagerPages: boolean
  /** Lists participants and changes their Team (the participants table). */
  canManageParticipants: boolean
  canAssignTeams: boolean
  canRemoveParticipants: boolean
  /** Changes the role of a participant (admin only). */
  canChangeRoles: boolean
  canReviewRegistrations: boolean
  /** Edits Boards, Tiles, Goals and the Tile layout; sees hidden Tiles. */
  canEditBoard: boolean
  canReviewSubmissions: boolean
  canManageTeams: boolean
  /** Edits buy-ins and donations. */
  canManageFinance: boolean
  /** Edits the Event settings; the admin-only menu entries. */
  canEditEvent: boolean
  canInvite: boolean
  canAssignClan: boolean
  canManageRules: boolean
  canDeleteEvent: boolean
  /** Opens the team draft room (every member). */
  canViewDraft: boolean
  /** Sets up, starts, pauses, undoes and applies the team draft. */
  canManageDraft: boolean
  /**
   * Leads a Team, so may pick when it is that Team's turn. Whose turn it is
   * is a draft state; the server decides, this only shows the controls.
   */
  canPick: boolean

  /** Roles this actor may grant, for a role select. */
  assignableRoles: EventRole[]
  /** Roles of participants this actor may remove or act on. */
  removableRoles: EventRole[]
}

export function computeCapabilities(
  actor: EventActor | null
): EventCapabilities {
  const granted = {} as Record<Permission, boolean>
  for (const permission of PERMISSIONS) {
    granted[permission] = can(actor, permission)
  }
  const isManager = isManagerRole(actor?.role)
  return {
    role: actor?.role ?? null,
    isOwner: actor?.isOwner ?? false,
    isManager,
    isAdmin: actor?.role === "admin",
    can: granted,

    canViewManagerPages: isManager,
    canManageParticipants: granted["participant:list"],
    canAssignTeams: granted["participant:assign-team"],
    canRemoveParticipants: granted["participant:remove"],
    canChangeRoles: granted["participant:set-role"],
    canReviewRegistrations: granted["registration:review"],
    canEditBoard: granted["board:manage"],
    canReviewSubmissions: granted["submission:review"],
    canManageTeams: granted["team:manage"],
    canManageFinance: granted["finance:write"],
    canEditEvent: granted["event:update"],
    canInvite: granted["event:invite"],
    canAssignClan: granted["event:assign-clan"],
    canManageRules: granted["event:manage-rules"],
    canDeleteEvent: granted["event:delete"],
    canViewDraft: granted["draft:view"],
    canManageDraft: granted["draft:manage"],
    canPick:
      actor?.teams.some((team) =>
        can(actor, "draft:pick", { teamId: team.teamId })
      ) ?? false,

    assignableRoles: EVENT_ROLES.filter((newRole) =>
      can(actor, "participant:set-role", { newRole })
    ),
    removableRoles: EVENT_ROLES.filter((targetRole) =>
      can(actor, "participant:remove", { targetRole })
    ),
  }
}

/**
 * Capabilities of a user with a known membership, for lists of Events (the
 * dashboard) where no actor was loaded. Team memberships are not needed:
 * capabilities only use the unconditional role grant.
 */
export function capabilitiesForMembership(facts: {
  userId: string
  eventId: string
  creatorId: string | null
  participantRole: EventRole | null
}): EventCapabilities {
  return computeCapabilities(buildEventActor(facts))
}
