import { PERMISSIONS, type Permission } from "./permissions"
import { can, type EventActor } from "./policy"
import { isManagerRole, type EventRole } from "./roles"

/**
 * Serialisable summary of what the actor may do in an Event, computed on the
 * server and passed to client components as a prop. Permissions that depend on
 * a relation (a specific Team, a target participant) are evaluated without a
 * resource, i.e. only the unconditional role grant counts.
 */
export interface EventCapabilities {
  role: EventRole | null
  isOwner: boolean
  isManager: boolean
  isAdmin: boolean
  can: Record<Permission, boolean>
}

export function computeCapabilities(
  actor: EventActor | null
): EventCapabilities {
  const granted = {} as Record<Permission, boolean>
  for (const permission of PERMISSIONS) {
    granted[permission] = can(actor, permission)
  }
  return {
    role: actor?.role ?? null,
    isOwner: actor?.isOwner ?? false,
    isManager: isManagerRole(actor?.role),
    isAdmin: actor?.role === "admin",
    can: granted,
  }
}
