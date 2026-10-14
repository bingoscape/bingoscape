import { and, eq, inArray, or } from "drizzle-orm"

import { db } from "@/server/db"
import { addMember } from "@/server/authz/membership"
import {
  clanMembers,
  clans,
  eventAuditLog,
  eventParticipants,
  events,
  roleChangeLog,
  users,
} from "@/server/db/schema"

/**
 * A committed Event and Clan for the membership helper tests. Every
 * membership is created through `addMember()`, so the role ledger of the
 * fixture is complete from the start (the replay test relies on that).
 *
 * Event: `owner` (creator, admin), `admin`, `admin2`, `manager`
 * (management), `player`, `player2`; `outsider` has no membership.
 * Clan: `owner` (owner, admin), `admin`, `manager`, `member`.
 */
export const FIXTURE_NAMES = [
  "owner",
  "admin",
  "admin2",
  "manager",
  "player",
  "player2",
  "outsider",
] as const
export type FixtureName = (typeof FIXTURE_NAMES)[number]

export interface MembershipWorld {
  id: Record<FixtureName, string>
  eventId: string
  clanId: string
  /** Scope ids whose ledger and audit rows belong to this world. */
  scopeIds: string[]
  cleanup: () => Promise<void>
}

export async function createMembershipWorld(): Promise<MembershipWorld> {
  const suffix = Math.random().toString(36).slice(2)
  const created = await db
    .insert(users)
    .values(
      FIXTURE_NAMES.map((name) => ({
        name,
        email: `${name}-${suffix}@membership.test`,
      }))
    )
    .returning({ id: users.id, email: users.email })
  const id = Object.fromEntries(
    FIXTURE_NAMES.map((name) => [
      name,
      created.find((u) => u.email === `${name}-${suffix}@membership.test`)!.id,
    ])
  ) as Record<FixtureName, string>

  const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const [event] = await db
    .insert(events)
    .values({
      title: `membership-${suffix}`,
      startDate,
      endDate: new Date(startDate.getTime() + 24 * 60 * 60 * 1000),
      creatorId: id.owner,
    })
    .returning({ id: events.id })
  const [clan] = await db
    .insert(clans)
    .values({ name: `membership-${suffix}`, ownerId: id.owner })
    .returning({ id: clans.id })
  const eventId = event!.id
  const clanId = clan!.id

  const system = { kind: "system", userId: id.owner } as const
  const seed: ["event" | "clan", string, FixtureName, string][] = [
    ["event", eventId, "owner", "admin"],
    ["event", eventId, "admin", "admin"],
    ["event", eventId, "admin2", "admin"],
    ["event", eventId, "manager", "management"],
    ["event", eventId, "player", "participant"],
    ["event", eventId, "player2", "participant"],
    ["clan", clanId, "owner", "admin"],
    ["clan", clanId, "admin", "admin"],
    ["clan", clanId, "manager", "management"],
    ["clan", clanId, "player", "member"],
  ]
  for (const [scope, parentId, name, role] of seed) {
    const result = await addMember({
      scope,
      parentId,
      userId: id[name],
      role,
      actor: system,
    })
    if (!result.success) throw new Error(`fixture: ${result.error}`)
  }

  // Seeding the admins above left success rows; tests assert on their own.
  await db.delete(eventAuditLog).where(eq(eventAuditLog.eventId, eventId))

  const scopeIds = [eventId, clanId]
  return {
    id,
    eventId,
    clanId,
    scopeIds,
    cleanup: async () => {
      await db.delete(events).where(eq(events.id, eventId))
      await db.delete(clans).where(eq(clans.id, clanId))
      await db.delete(users).where(
        inArray(
          users.id,
          created.map((u) => u.id)
        )
      )
      await db
        .delete(roleChangeLog)
        .where(inArray(roleChangeLog.scopeId, scopeIds))
      await db.delete(eventAuditLog).where(
        or(
          eq(eventAuditLog.eventId, eventId),
          inArray(
            eventAuditLog.targetId,
            created.map((u) => `${clanId}:${u.id}`)
          )
        )
      )
    },
  }
}

export async function eventRole(
  world: MembershipWorld,
  name: FixtureName
): Promise<string | null> {
  const [row] = await db
    .select({ role: eventParticipants.role })
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, world.eventId),
        eq(eventParticipants.userId, world.id[name])
      )
    )
  return row?.role ?? null
}

export async function clanRole(
  world: MembershipWorld,
  name: FixtureName
): Promise<string | null> {
  const [row] = await db
    .select({ role: clanMembers.role })
    .from(clanMembers)
    .where(
      and(
        eq(clanMembers.clanId, world.clanId),
        eq(clanMembers.userId, world.id[name])
      )
    )
  return row?.role ?? null
}

/** Ledger rows of one scope in order. */
export async function ledgerOf(scopeId: string) {
  return db
    .select()
    .from(roleChangeLog)
    .where(eq(roleChangeLog.scopeId, scopeId))
    .orderBy(roleChangeLog.seq)
}

/**
 * Replays the ledger of a scope (latest `new_role` per subject, NULL = gone)
 * and returns it as `userId -> role` for the members that still hold a role.
 */
export async function replayLedger(
  scopeId: string
): Promise<Record<string, string>> {
  const state = new Map<string, string | null>()
  for (const row of await ledgerOf(scopeId)) {
    if (row.subjectUserId) state.set(row.subjectUserId, row.newRole)
  }
  return Object.fromEntries(
    [...state].filter((e): e is [string, string] => e[1] !== null)
  )
}
