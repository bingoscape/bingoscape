import { eq, inArray } from "drizzle-orm"

import { db } from "@/server/db"
import {
  bingoShipRules,
  bingos,
  eventParticipants,
  events,
  teamMembers,
  teams,
  tiles,
  users,
  type ShipRule,
} from "@/server/db/schema"

/**
 * A committed (not rolled back) battleship event for DB-backed tests: two
 * teams, a 3x3 board and a fleet of one 3-ship and one 2-ship. Concurrency
 * tests need real commits, so each fixture cleans itself up via `cleanup`.
 *
 * Board indexes (col, row):
 *   0 1 2
 *   3 4 5
 *   6 7 8
 */
export const DAY_MS = 24 * 60 * 60 * 1000

export interface BattleshipFixture {
  eventId: string
  bingoId: string
  startDate: Date
  teamAId: string
  teamBId: string
  /** tileIds[i] is the tile at board index i. */
  tileIds: string[]
  managerId: string
  leaderAId: string
  memberAId: string
  leaderBId: string
  memberBId: string
  outsiderId: string
  cleanup: () => Promise<void>
}

export async function createBattleshipFixture(
  options: {
    now?: Date
    bingoType?: "standard" | "progression" | "battleship"
    rules?: ShipRule[]
  } = {}
): Promise<BattleshipFixture> {
  const now = options.now ?? new Date()
  const suffix = Math.random().toString(36).slice(2)
  const startDate = new Date(now.getTime() + DAY_MS)
  const endDate = new Date(now.getTime() + 2 * DAY_MS)

  const created = await db
    .insert(users)
    .values(
      ["manager", "leaderA", "memberA", "leaderB", "memberB", "outsider"].map(
        (name) => ({ name, email: `${name}-${suffix}@example.test` })
      )
    )
    .returning({ id: users.id, email: users.email })
  const idOf = (name: string) =>
    created.find((u) => u.email === `${name}-${suffix}@example.test`)!.id

  const [event] = await db
    .insert(events)
    .values({
      title: `battleship-${suffix}`,
      startDate,
      endDate,
      creatorId: idOf("manager"),
    })
    .returning({ id: events.id })

  const [teamA, teamB] = await db
    .insert(teams)
    .values([
      { eventId: event!.id, name: "Team A" },
      { eventId: event!.id, name: "Team B" },
    ])
    .returning({ id: teams.id })

  await db.insert(eventParticipants).values([
    // The creator has the admin row every creator has.
    { eventId: event!.id, userId: idOf("manager"), role: "admin" as const },
    ...["leaderA", "memberA", "leaderB", "memberB", "outsider"].map((name) => ({
      eventId: event!.id,
      userId: idOf(name),
    })),
  ])
  await db.insert(teamMembers).values([
    {
      teamId: teamA!.id,
      eventId: event!.id,
      userId: idOf("leaderA"),
      isLeader: true,
    },
    { teamId: teamA!.id, eventId: event!.id, userId: idOf("memberA") },
    {
      teamId: teamB!.id,
      eventId: event!.id,
      userId: idOf("leaderB"),
      isLeader: true,
    },
    { teamId: teamB!.id, eventId: event!.id, userId: idOf("memberB") },
  ])

  const [bingo] = await db
    .insert(bingos)
    .values({
      eventId: event!.id,
      title: "Battleship",
      rows: 3,
      columns: 3,
      codephrase: "codephrase",
      bingoType: options.bingoType ?? "battleship",
    })
    .returning({ id: bingos.id })

  const insertedTiles = await db
    .insert(tiles)
    .values(
      Array.from({ length: 9 }, (_, index) => ({
        bingoId: bingo!.id,
        title: `Tile ${index}`,
        description: `Tile ${index}`,
        weight: 1,
        index,
        isHidden: false,
      }))
    )
    .returning({ id: tiles.id, index: tiles.index })

  if ((options.bingoType ?? "battleship") === "battleship") {
    await db.insert(bingoShipRules).values({
      bingoId: bingo!.id,
      rulesJson: options.rules ?? [
        { length: 3, count: 1 },
        { length: 2, count: 1 },
      ],
    })
  }

  const userIds = created.map((u) => u.id)
  return {
    eventId: event!.id,
    bingoId: bingo!.id,
    startDate,
    teamAId: teamA!.id,
    teamBId: teamB!.id,
    tileIds: insertedTiles.sort((a, b) => a.index - b.index).map((t) => t.id),
    managerId: idOf("manager"),
    leaderAId: idOf("leaderA"),
    memberAId: idOf("memberA"),
    leaderBId: idOf("leaderB"),
    memberBId: idOf("memberB"),
    outsiderId: idOf("outsider"),
    cleanup: async () => {
      await db.delete(events).where(eq(events.id, event!.id))
      await db.delete(users).where(inArray(users.id, userIds))
    },
  }
}

/** A valid fleet on the fixture board: a vertical 3-ship and a horizontal 2-ship. */
export function validFleet(tileIds: string[], offset: 0 | 1 = 0) {
  return offset === 0
    ? [
        { length: 3, tileIds: [tileIds[0]!, tileIds[3]!, tileIds[6]!] },
        { length: 2, tileIds: [tileIds[4]!, tileIds[5]!] },
      ]
    : [
        { length: 3, tileIds: [tileIds[2]!, tileIds[5]!, tileIds[8]!] },
        { length: 2, tileIds: [tileIds[3]!, tileIds[4]!] },
      ]
}

/**
 * Freezes only `Date`, leaving timers and I/O scheduling real so the database
 * driver keeps working. Pair with `jest.useRealTimers()` in afterEach.
 */
export function setClock(now: Date) {
  jest.useFakeTimers({
    now,
    doNotFake: [
      "hrtime",
      "nextTick",
      "performance",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
    ],
  })
}
