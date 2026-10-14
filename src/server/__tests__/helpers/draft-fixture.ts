import { eq, inArray } from "drizzle-orm"

import type { DraftSettingsInput } from "@/lib/draft/setup"
import type { EventActor } from "@/lib/authz/policy"
import { loadEventActor } from "@/server/authz/actor"
import { createDraft, startDraft } from "@/server/draft/core"
import { db } from "@/server/db"
import {
  eventParticipants,
  events,
  playerMetadata,
  users,
} from "@/server/db/schema"

/**
 * A committed Event for the team draft tests on real Postgres.
 *
 * `owner` (creator, admin), `manager` (management), `outsider` (no
 * membership), `captains` (participants) and `players` (participants), all
 * without a Team. Every test builds its own world and removes it afterwards.
 */
export interface DraftWorld {
  eventId: string
  owner: string
  manager: string
  outsider: string
  captains: string[]
  players: string[]
  /** All user ids, for cleanup. */
  allUserIds: string[]
  actorOf: (userId: string) => Promise<EventActor>
  cleanup: () => Promise<void>
}

export async function createDraftWorld(
  options: { captains?: number; players?: number } = {}
): Promise<DraftWorld> {
  const captainCount = options.captains ?? 4
  const playerCount = options.players ?? 12
  const suffix = Math.random().toString(36).slice(2)
  const names = [
    "owner",
    "manager",
    "outsider",
    ...Array.from({ length: captainCount }, (_, i) => `captain${i + 1}`),
    ...Array.from({ length: playerCount }, (_, i) => `player${i + 1}`),
  ]
  const created = await db
    .insert(users)
    .values(
      names.map((name) => ({ name, email: `${name}-${suffix}@draft.test` }))
    )
    .returning({ id: users.id, email: users.email })
  const idOf = (name: string) =>
    created.find((u) => u.email === `${name}-${suffix}@draft.test`)!.id

  const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const [event] = await db
    .insert(events)
    .values({
      title: `draft-${suffix}`,
      startDate,
      endDate: new Date(startDate.getTime() + 24 * 60 * 60 * 1000),
      creatorId: idOf("owner"),
    })
    .returning({ id: events.id })
  const eventId = event!.id

  const captains = names.filter((n) => n.startsWith("captain")).map(idOf)
  const players = names.filter((n) => n.startsWith("player")).map(idOf)
  await db.insert(eventParticipants).values([
    { eventId, userId: idOf("owner"), role: "admin" as const },
    { eventId, userId: idOf("manager"), role: "management" as const },
    ...[...captains, ...players].map((userId) => ({
      eventId,
      userId,
      role: "participant" as const,
    })),
  ])

  return {
    eventId,
    owner: idOf("owner"),
    manager: idOf("manager"),
    outsider: idOf("outsider"),
    captains,
    players,
    allUserIds: created.map((u) => u.id),
    actorOf: async (userId) => {
      const lookup = await loadEventActor(userId, eventId)
      if (lookup.status !== "ok") throw new Error("Event not found")
      return lookup.actor
    },
    cleanup: async () => {
      await db.delete(events).where(eq(events.id, eventId))
      await db.delete(users).where(
        inArray(
          users.id,
          created.map((u) => u.id)
        )
      )
    },
  }
}

export function draftSettings(
  world: DraftWorld,
  overrides: Partial<DraftSettingsInput> & { captainCount?: number } = {}
): DraftSettingsInput {
  const { captainCount, ...rest } = overrides
  return {
    orderType: "snake",
    rounds: 2,
    pickTimerSeconds: null,
    onTimeout: "auto_pick",
    autoPickRule: "best_rated",
    captains: world.captains
      .slice(0, captainCount ?? world.captains.length)
      .map((userId, i) => ({ userId, teamName: `Team ${i + 1}` })),
    ...rest,
  }
}

/** Gives some of the world's players Wise Old Man style metadata. */
export async function rate(
  world: DraftWorld,
  ratings: Record<string, { ehp: number; ehb: number; hours: number }>
) {
  const rows = Object.entries(ratings).map(([userId, r]) => ({
    eventId: world.eventId,
    userId,
    ehp: r.ehp,
    ehb: r.ehb,
    dailyHoursAvailable: r.hours,
  }))
  if (rows.length > 0) await db.insert(playerMetadata).values(rows)
}

/** Creates and starts a draft as the manager, in one transaction each. */
export async function startedDraft(
  world: DraftWorld,
  overrides: Parameters<typeof draftSettings>[1] = {}
): Promise<{ draftId: string }> {
  const manager = await world.actorOf(world.manager)
  const created = await db.transaction((tx) =>
    createDraft(tx, {
      eventId: world.eventId,
      actor: manager,
      settings: draftSettings(world, overrides),
    })
  )
  if (!created.success) throw new Error(created.error)
  const started = await db.transaction((tx) =>
    startDraft(tx, { draftId: created.draftId, actor: manager })
  )
  if (!started.success) throw new Error(started.error)
  return { draftId: created.draftId }
}
