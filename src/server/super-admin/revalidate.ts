/**
 * Server-only revalidation helper for the super-admin mutations (not a
 * "use server" module). One call covers the admin overview and audit log, the
 * list and detail pages of every touched entity, and the public pages that
 * show the same data.
 */
import { revalidatePath } from "next/cache"

export interface RevalidateAdminTargets {
  userIds?: readonly string[]
  clanIds?: readonly string[]
  eventIds?: readonly string[]
  /** The wiki image cache page (`/super-admin/image-cache`). */
  imageCache?: boolean
}

export function adminPathsToRevalidate(
  targets: RevalidateAdminTargets
): string[] {
  const paths = new Set<string>(["/super-admin", "/super-admin/audit"])
  const touched = (ids: readonly string[] | undefined) => ids !== undefined

  if (touched(targets.userIds)) {
    paths.add("/super-admin/users")
    for (const id of targets.userIds ?? []) {
      paths.add(`/super-admin/users/${id}`)
    }
  }
  if (touched(targets.clanIds)) {
    paths.add("/super-admin/clans")
    paths.add("/clans")
    for (const id of targets.clanIds ?? []) {
      paths.add(`/super-admin/clans/${id}`)
      paths.add(`/clans/${id}`)
    }
  }
  if (touched(targets.eventIds)) {
    paths.add("/super-admin/events")
    paths.add("/events")
    for (const id of targets.eventIds ?? []) {
      paths.add(`/super-admin/events/${id}`)
      paths.add(`/events/${id}`)
    }
  }
  if (targets.imageCache) paths.add("/super-admin/image-cache")
  // Users appear in public event and clan listings (members, participants).
  if (touched(targets.userIds)) {
    paths.add("/events")
    paths.add("/clans")
  }
  return [...paths]
}

export function revalidateAdmin(targets: RevalidateAdminTargets): void {
  for (const path of adminPathsToRevalidate(targets)) {
    revalidatePath(path)
  }
}
