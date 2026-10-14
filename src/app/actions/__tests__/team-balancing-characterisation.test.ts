/**
 * @jest-environment node
 *
 * Characterisation of `team-balancing.ts` on real Postgres: pins what the
 * balancing and the balance metrics produce today, so the pure scoring helpers
 * can move to `src/lib/team-balancing/scoring.ts` without changing behaviour
 * (team draft 1/4, #215). The simulated annealing uses `Math.random`, which is
 * replaced by a fixed sequence here.
 */
import { eq, inArray } from "drizzle-orm"

import {
  calculateTeamBalanceMetrics,
  generateBalancedTeams,
} from "@/app/actions/team-balancing"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  eventParticipants,
  events,
  playerMetadata,
  teamMembers,
  teams,
  users,
} from "@/server/db/schema"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

// The optimisation draws `Math.random()` synchronously right after the
// participants' metadata is loaded. Installing the fixed sequence at exactly
// that point (instead of before the first await) keeps anything else that
// draws a random number in between (drivers, timers) out of the sequence.
const mockHooks: { afterMetadata?: () => void } = {}
jest.mock("@/app/actions/player-metadata", () => {
  const actual = jest.requireActual("@/app/actions/player-metadata")
  return {
    ...actual,
    getEventParticipantMetadata: async (
      ...args: Parameters<typeof actual.getEventParticipantMetadata>
    ) => {
      const result = await actual.getEventParticipantMetadata(...args)
      mockHooks.afterMetadata?.()
      return result
    },
  }
})

type Meta = {
  ehp: number | null
  ehb: number | null
  dailyHoursAvailable: number | null
  skillLevel:
    | "beginner"
    | "intermediate"
    | "advanced"
    | "expert"
    | "pvmgod"
    | null
}

// Insertion order matters: the optimisation starts from a round robin.
const PLAYERS: [string, Meta | null][] = [
  ["p1", { ehp: 1200, ehb: 300, dailyHoursAvailable: 4, skillLevel: "expert" }],
  ["p2", { ehp: 200, ehb: 10, dailyHoursAvailable: 2, skillLevel: "beginner" }],
  [
    "p3",
    { ehp: 800, ehb: 120, dailyHoursAvailable: 6, skillLevel: "advanced" },
  ],
  ["p4", { ehp: null, ehb: 40, dailyHoursAvailable: null, skillLevel: null }],
  [
    "p5",
    { ehp: 450, ehb: null, dailyHoursAvailable: 3, skillLevel: "intermediate" },
  ],
  ["p6", null],
  ["p7", { ehp: 2000, ehb: 700, dailyHoursAvailable: 8, skillLevel: "pvmgod" }],
  ["p8", { ehp: 100, ehb: 0, dailyHoursAvailable: 1, skillLevel: "beginner" }],
]

let eventId: string
let adminId: string
let userIds: Record<string, string> = {}
const nameOf = (id: string) =>
  Object.entries(userIds).find(([, value]) => value === id)![0]

/** A fixed pseudo random sequence (mulberry32). */
function stubRandom() {
  let a = 123456789
  return jest.spyOn(Math, "random").mockImplementation(() => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  })
}

beforeAll(async () => {
  const suffix = Math.random().toString(36).slice(2)
  const names = ["admin", ...PLAYERS.map(([name]) => name)]
  // Fixed, increasing ids: the participants come back in index order (by
  // user id) on a big table and in heap order on a small one, and the
  // optimisation starts from a round robin over that order. Both agree here.
  const created = await db
    .insert(users)
    .values(
      names.map((name, i) => ({
        id: `00000000-ba1a-4000-8000-${String(i + 1).padStart(12, "0")}`,
        name,
        email: `${name}-${suffix}@balancing.test`,
      }))
    )
    .returning({ id: users.id, email: users.email })
  userIds = Object.fromEntries(
    names.map((name) => [
      name,
      created.find((u) => u.email === `${name}-${suffix}@balancing.test`)!.id,
    ])
  )
  adminId = userIds.admin!

  const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const [event] = await db
    .insert(events)
    .values({
      title: `balancing-${suffix}`,
      startDate,
      endDate: new Date(startDate.getTime() + 24 * 60 * 60 * 1000),
      creatorId: adminId,
    })
    .returning({ id: events.id })
  eventId = event!.id

  await db
    .insert(eventParticipants)
    .values({ eventId, userId: adminId, role: "admin" })
  for (const [name] of PLAYERS) {
    await db
      .insert(eventParticipants)
      .values({ eventId, userId: userIds[name]!, role: "participant" })
  }
  for (const [name, meta] of PLAYERS) {
    if (!meta) continue
    await db
      .insert(playerMetadata)
      .values({ eventId, userId: userIds[name]!, timezone: "UTC", ...meta })
  }
})

afterAll(async () => {
  await db.delete(events).where(eq(events.id, eventId))
  await db.delete(users).where(inArray(users.id, Object.values(userIds)))
})

beforeEach(() => {
  ;(getServerAuthSession as jest.Mock).mockResolvedValue({
    user: { id: adminId },
  })
})

describe("team-balancing characterisation", () => {
  it("balances the unassigned participants into two teams and scores them", async () => {
    let random: jest.SpyInstance | undefined
    mockHooks.afterMetadata = () => {
      random = stubRandom()
    }
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {})
    try {
      const result = await generateBalancedTeams(eventId, {
        generationMethod: "teamCount",
        teamCount: 2,
        teamNamePrefix: "Team",
        simulatedAnnealing: { iterations: 500 },
      })
      expect(result.success).toBe(true)
    } finally {
      mockHooks.afterMetadata = undefined
      random?.mockRestore()
      logSpy.mockRestore()
    }

    const eventTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, eventId),
      with: { teamMembers: true },
      orderBy: (t, { asc }) => asc(t.name),
    })
    const composition = eventTeams.map((team) => ({
      name: team.name,
      members: team.teamMembers.map((m) => nameOf(m.userId)).sort(),
      leaders: team.teamMembers.filter((m) => m.isLeader).length,
      withEvent: team.teamMembers.every((m) => m.eventId === eventId),
    }))
    expect(composition).toEqual([
      {
        name: "Team 1",
        members: ["admin", "p1", "p4", "p5", "p6"],
        leaders: 0,
        withEvent: true,
      },
      {
        name: "Team 2",
        members: ["p2", "p3", "p7", "p8"],
        leaders: 0,
        withEvent: true,
      },
    ])

    const metrics = await calculateTeamBalanceMetrics(eventId)
    expect(metrics).not.toBeNull()
    expect(
      metrics!.teams
        .map((t) => ({
          name: t.teamName,
          memberCount: t.memberCount,
          averageScore: Number(t.averageScore.toFixed(6)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    ).toEqual([
      { name: "Team 1", memberCount: 5, averageScore: 0.555333 },
      { name: "Team 2", memberCount: 4, averageScore: 0.555833 },
    ])
    expect(Number(metrics!.overallAverage.toFixed(6))).toBe(0.555583)
    expect(Number(metrics!.variance.toFixed(8))).toBe(6e-8)
  })

  it("refuses to generate when nobody is left unassigned", async () => {
    const rows = await db
      .select({ n: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.eventId, eventId))
    // The admin takes part as well.
    expect(rows.length).toBe(PLAYERS.length + 1)
    const result = await generateBalancedTeams(eventId, {
      generationMethod: "teamCount",
      teamCount: 2,
      teamNamePrefix: "Team",
    })
    expect(result).toEqual({
      success: false,
      error: "No unassigned participants to assign to teams",
    })
  })
})
