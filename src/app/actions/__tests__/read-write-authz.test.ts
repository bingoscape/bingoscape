/**
 * @jest-environment node
 */
import { NextRequest } from "next/server"
import { eq, inArray } from "drizzle-orm"
import { getServerSession } from "next-auth"

import * as notificationActions from "@/app/actions/notifications"
import {
  createDiscordWebhook,
  testWebhook,
  updateDiscordWebhook,
} from "@/app/actions/discord-webhooks"
import * as bingoActions from "@/app/actions/bingo"
import {
  getBingoWithPatternBonuses,
  getTierXpRequirements,
  reorderTiles,
  updateSubmissionStatus,
} from "@/app/actions/bingo"
import { updateSubmissionGoalAndValue } from "@/app/actions/goals"
import {
  calculateMetadataCoverage,
  getEventParticipantMetadata,
  getPlayerMetadata,
  updateOwnPlayerMetadata,
} from "@/app/actions/player-metadata"
import { calculateTeamBalanceMetrics } from "@/app/actions/team-balancing"
import { getEventTeamStatistics } from "@/app/actions/team-statistics"
import {
  getEventParticipants as getUnassignedParticipants,
  getTeamsByEventId,
} from "@/app/actions/team"
import { GET, POST } from "@/app/api/submissions/[id]/comments/route"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  discordWebhooks,
  eventParticipants,
  events,
  notifications,
  playerMetadata,
  submissionComments,
  submissions,
  tiles,
  users,
} from "@/server/db/schema"
import { isDiscordWebhookUrl } from "@/lib/discord-webhook-url"
import {
  createBlindFixture,
  type BlindFixture,
} from "@/server/__tests__/helpers/blind-fixture"

jest.mock("@/server/auth", () => ({
  getServerAuthSession: jest.fn(),
  authOptions: {},
}))
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

const session = getServerAuthSession as jest.Mock
const routeSession = getServerSession as jest.Mock

function signInAs(userId: string | null) {
  const value = userId ? { user: { id: userId } } : null
  session.mockResolvedValue(value)
  routeSession.mockResolvedValue(value)
}

let a: BlindFixture
let b: BlindFixture
let stranger: string
let fetchSpy: jest.SpyInstance

beforeEach(async () => {
  jest.clearAllMocks()
  a = await createBlindFixture({ bingoType: "standard" })
  b = await createBlindFixture({ bingoType: "standard" })
  const [user] = await db
    .insert(users)
    .values({ name: "stranger", email: `stranger-${a.tag}@example.test` })
    .returning({ id: users.id })
  stranger = user!.id
  fetchSpy = jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response(null, { status: 204 }))
})

afterEach(async () => {
  fetchSpy.mockRestore()
  await db.delete(users).where(eq(users.id, stranger))
  await a.cleanup()
  await b.cleanup()
})

/** Callers without management rights: signed out, not in the event, a member. */
const CALLERS = ["anonymous", "stranger", "member"] as const
function userOf(who: (typeof CALLERS)[number]): string | null {
  if (who === "anonymous") return null
  return who === "stranger" ? stranger : a.memberAId
}

describe("notifications", () => {
  it("is no longer a client callable action to create notifications", () => {
    expect("createNotification" in notificationActions).toBe(false)
  })

  it("only lets the owner mark a notification as read", async () => {
    const [row] = await db
      .insert(notifications)
      .values({
        userId: a.managerId,
        eventId: a.eventId,
        tileId: a.tileIds[0]!,
        teamId: a.teamAId,
        message: "hello",
      })
      .returning({ id: notifications.id })

    signInAs(a.memberAId)
    await notificationActions.markNotificationAsRead(row!.id)
    expect(
      (
        await db.query.notifications.findFirst({
          where: eq(notifications.id, row!.id),
        })
      )?.isRead
    ).toBe(false)

    signInAs(a.managerId)
    await notificationActions.markNotificationAsRead(row!.id)
    expect(
      (
        await db.query.notifications.findFirst({
          where: eq(notifications.id, row!.id),
        })
      )?.isRead
    ).toBe(true)
  })
})

describe("submission comments route", () => {
  const call = (
    handler: typeof GET | typeof POST,
    submissionId: string,
    body?: object
  ) =>
    handler(
      new NextRequest(
        `http://localhost/api/submissions/${submissionId}/comments`,
        body
          ? { method: "POST", body: JSON.stringify(body) }
          : { method: "GET" }
      ),
      { params: Promise.resolve({ id: submissionId }) }
    )

  const COMMENT = "a comment that is long enough"

  async function seedComment() {
    signInAs(a.managerId)
    expect((await call(POST, a.submissionId, { comment: COMMENT })).status).toBe(
      201
    )
  }

  it.each(["anonymous", "stranger"] as const)(
    "denies %s reading and writing",
    async (who) => {
      signInAs(userOf(who))

      const read = await call(GET, a.submissionId)
      const write = await call(POST, a.submissionId, { comment: COMMENT })

      expect([401, 404]).toContain(read.status)
      expect([401, 404]).toContain(write.status)
      expect(await db.select().from(submissionComments)).toHaveLength(0)
    }
  )

  it("denies a manager of another event", async () => {
    signInAs(b.managerId)

    const read = await call(GET, a.submissionId)
    const write = await call(POST, a.submissionId, { comment: COMMENT })

    expect(read.status).toBe(404)
    expect(write.status).toBe(404)
    expect(await db.select().from(submissionComments)).toHaveLength(0)
  })

  it("lets a manager read and write", async () => {
    await seedComment()

    const read = await call(GET, a.submissionId)
    expect(read.status).toBe(200)
    const comments = await read.json()
    expect(comments).toHaveLength(1)
    expect(comments[0].author.id).toBe(a.managerId)
  })

  it("lets a member of the owning team read why a Tile was not accepted", async () => {
    await seedComment()
    signInAs(a.memberAId)

    const read = await call(GET, a.submissionId)

    expect(read.status).toBe(200)
    const comments = await read.json()
    expect(comments).toHaveLength(1)
    expect(comments[0].comment).toBe(COMMENT)
  })

  it("shows players the reviewer's in-game name only", async () => {
    await db
      .update(users)
      .set({ name: "Real Name Reviewer", runescapeName: "Reviewer RS" })
      .where(eq(users.id, a.managerId))
    await seedComment()
    signInAs(a.memberAId)

    const comments = await (await call(GET, a.submissionId)).json()

    expect(comments[0].author).toEqual({
      id: "",
      name: null,
      runescapeName: "Reviewer RS",
    })
    expect(JSON.stringify(comments)).not.toContain("Real Name Reviewer")
    expect(JSON.stringify(comments)).not.toContain(a.managerId)
  })

  it("keeps members of other teams in the same event out", async () => {
    await seedComment()
    signInAs(a.leaderBId)

    const read = await call(GET, a.submissionId)

    expect(read.status).toBe(404)
  })

  it("does not let players write comments", async () => {
    signInAs(a.memberAId)

    const write = await call(POST, a.submissionId, { comment: COMMENT })

    expect(write.status).toBe(404)
    expect(await db.select().from(submissionComments)).toHaveLength(0)
  })

  it("does not reveal comments of a hidden Tile to its team", async () => {
    await seedComment()
    await db
      .update(tiles)
      .set({ isHidden: true })
      .where(eq(tiles.id, a.tileIds[0]!))
    signInAs(a.memberAId)

    const read = await call(GET, a.submissionId)

    expect(read.status).toBe(404)
  })

  it("answers the same for unknown submissions", async () => {
    signInAs(a.memberAId)

    const read = await call(GET, "00000000-0000-4000-8000-000000000000")

    expect(read.status).toBe(404)
  })
})

describe("discord webhooks", () => {
  const GOOD = "https://discord.com/api/webhooks/123/token"

  it.each([
    ["https://discord.com/api/webhooks/1/x", true],
    ["https://discordapp.com/api/webhooks/1/x", true],
    ["http://discord.com/api/webhooks/1/x", false],
    ["http://169.254.169.254/x?discord.com/api/webhooks/", false],
    ["https://discord.com.evil.test/api/webhooks/1/x", false],
    ["https://evil.test/discord.com/api/webhooks/1/x", false],
    ["https://user:pw@discord.com/api/webhooks/1/x", false],
    ["https://discord.com:8443/api/webhooks/1/x", false],
    ["https://discord.com/other", false],
    ["not a url", false],
  ])("isDiscordWebhookUrl(%s) is %s", (url, expected) => {
    expect(isDiscordWebhookUrl(url)).toBe(expected)
  })

  it("rejects a smuggled internal URL before any request is made", async () => {
    signInAs(a.managerId)

    const result = await createDiscordWebhook(
      a.eventId,
      "x",
      "http://169.254.169.254/latest?discord.com/api/webhooks/"
    )

    expect(result.success).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it.each(CALLERS)(
    "does not call out for %s",
    async (who) => {
      signInAs(userOf(who))

      const result = await createDiscordWebhook(a.eventId, "x", GOOD)

      expect(result.success).toBe(false)
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(
        await db
          .select()
          .from(discordWebhooks)
          .where(inArray(discordWebhooks.eventId, [a.eventId, b.eventId]))
      ).toHaveLength(0)
    }
  )

  it("creates a webhook for a manager", async () => {
    signInAs(a.managerId)

    const result = await createDiscordWebhook(a.eventId, "x", GOOD)

    expect(result.success).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("never lets a client rewrite eventId or createdBy on update", async () => {
    signInAs(a.managerId)
    const created = await createDiscordWebhook(a.eventId, "x", GOOD)
    const webhookId = (created as { webhook: { id: string } }).webhook.id

    await updateDiscordWebhook(webhookId, {
      name: "renamed",
      eventId: b.eventId,
      createdBy: stranger,
    } as never)

    const row = await db.query.discordWebhooks.findFirst({
      where: eq(discordWebhooks.id, webhookId),
    })
    expect(row?.name).toBe("renamed")
    expect(row?.eventId).toBe(a.eventId)
    expect(row?.createdBy).toBe(a.managerId)
  })

  it.each(CALLERS)(
    "does not let %s trigger a webhook test",
    async (who) => {
      signInAs(a.managerId)
      const created = await createDiscordWebhook(a.eventId, "x", GOOD)
      fetchSpy.mockClear()

      signInAs(userOf(who))
      const result = await testWebhook((created as { webhook: { id: string } }).webhook.id)

      expect(result.success).toBe(false)
      expect(fetchSpy).not.toHaveBeenCalled()
    }
  )

  it("does not post to a stored non-Discord URL", async () => {
    signInAs(a.managerId)
    const created = await createDiscordWebhook(a.eventId, "x", GOOD)
    await db
      .update(discordWebhooks)
      .set({ webhookUrl: "http://127.0.0.1:9/hook" })
      .where(eq(discordWebhooks.id, (created as { webhook: { id: string } }).webhook.id))
    fetchSpy.mockClear()

    const result = await testWebhook((created as { webhook: { id: string } }).webhook.id)

    expect(result.success).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe("board reads and writes", () => {
  it.each(CALLERS)(
    "keeps the codephrase from %s",
    async (who) => {
      signInAs(userOf(who))

      const result = await getBingoWithPatternBonuses(a.bingoId)

      expect(result.success).toBe(false)
      expect(JSON.stringify(result)).not.toContain("codephrase")
    }
  )

  it("serves the codephrase to a manager", async () => {
    signInAs(a.managerId)

    const result = await getBingoWithPatternBonuses(a.bingoId)

    expect(result.success).toBe(true)
  })

  it("keeps the progression readers off the client", () => {
    expect("getProgressionBingoTiles" in bingoActions).toBe(false)
    expect("getTeamTierProgress" in bingoActions).toBe(false)
  })

  it("keeps tier configuration from non-managers", async () => {
    signInAs(a.memberAId)
    await expect(getTierXpRequirements(a.bingoId)).resolves.toEqual([])

    signInAs(a.managerId)
    await expect(getTierXpRequirements(a.bingoId)).resolves.toEqual([])
  })

  it("refuses to reorder tiles of another event", async () => {
    signInAs(a.managerId)
    const before = await db.query.tiles.findFirst({
      where: eq(tiles.id, b.tileIds[0]!),
    })

    const result = await reorderTiles([
      { id: a.tileIds[0]!, index: 5 },
      { id: b.tileIds[0]!, index: 7 },
    ])

    expect(result.success).toBe(false)
    const after = await db.query.tiles.findFirst({
      where: eq(tiles.id, b.tileIds[0]!),
    })
    expect(after?.index).toBe(before?.index)
    const own = await db.query.tiles.findFirst({
      where: eq(tiles.id, a.tileIds[0]!),
    })
    expect(own?.index).toBe(0)
  })

  it("reorders the tiles of the managed board", async () => {
    signInAs(a.managerId)

    const result = await reorderTiles([
      { id: a.tileIds[0]!, index: 1 },
      { id: a.tileIds[1]!, index: 0 },
    ])

    expect(result.success).toBe(true)
  })

  it("refuses to assign a submission to a goal of another event", async () => {
    signInAs(a.managerId)

    const viaStatus = await updateSubmissionStatus(
      a.submissionId,
      "approved",
      b.itemGoalId,
      1
    )
    const viaGoal = await updateSubmissionGoalAndValue(
      a.submissionId,
      b.itemGoalId,
      1
    )

    expect(viaStatus.success).toBe(false)
    expect(viaGoal.success).toBe(false)
    const row = await db.query.submissions.findFirst({
      where: eq(submissions.id, a.submissionId),
    })
    expect(row?.goalId).toBe(a.itemGoalId)
  })

  it("lets a manager assign a submission to a goal of their own event", async () => {
    signInAs(a.managerId)

    const result = await updateSubmissionGoalAndValue(
      a.submissionId,
      a.metricGoalId,
      2
    )

    expect(result.success).toBe(true)
  })
})

describe("manager-only metadata and team reads", () => {
  beforeEach(async () => {
    await db.insert(playerMetadata).values(
      [a.memberAId, a.leaderAId].map((userId) => ({
        userId,
        eventId: a.eventId,
        skillLevel: "pvmgod" as const,
        notes: "private note",
      }))
    )
  })

  it.each(CALLERS)(
    "denies %s",
    async (who) => {
      signInAs(userOf(who))

      // The member's colleague (not themselves) is off limits to every non-manager.
      expect(await getPlayerMetadata(a.leaderAId, a.eventId)).toBeNull()
      expect(await getEventParticipantMetadata(a.eventId)).toEqual([])
      expect(await calculateMetadataCoverage(a.eventId)).toBe(0)
      expect(await calculateTeamBalanceMetrics(a.eventId)).toBeNull()
      expect(await getEventTeamStatistics(a.eventId)).toBeNull()
      expect(await getUnassignedParticipants(a.eventId)).toEqual([])
    }
  )

  it("serves a manager", async () => {
    signInAs(a.managerId)

    const own = await getPlayerMetadata(a.memberAId, a.eventId)
    expect(own?.notes).toBe("private note")
    expect(await getEventParticipantMetadata(a.eventId)).toHaveLength(2)
    expect(await calculateMetadataCoverage(a.eventId)).toBeGreaterThan(0)
    await expect(getEventTeamStatistics(a.eventId)).resolves.toBeDefined()
  })

  it("lets a player read their own metadata, without the management notes", async () => {
    signInAs(a.memberAId)

    const own = await getPlayerMetadata(a.memberAId, a.eventId)

    expect(own).not.toBeNull()
    expect(own?.skillLevel).toBe("pvmgod")
    expect(own?.notes).toBeNull()
    expect(JSON.stringify(own)).not.toContain("private note")
  })

  it("keeps a player from another event or a stranger off the record", async () => {
    signInAs(stranger)
    expect(await getPlayerMetadata(stranger, a.eventId)).toBeNull()
    expect(await getPlayerMetadata(a.memberAId, a.eventId)).toBeNull()

    signInAs(b.memberAId)
    expect(await getPlayerMetadata(a.memberAId, a.eventId)).toBeNull()
  })

  it("lets a player save their own metadata", async () => {
    signInAs(a.leaderAId)

    await updateOwnPlayerMetadata(a.eventId, { timezone: "Europe/Berlin" })

    const row = await getPlayerMetadata(a.leaderAId, a.eventId)
    expect(row?.timezone).toBe("Europe/Berlin")
  })

  it("shows visitors of a public event the teams without player metadata", async () => {
    // The fixture event is public.
    signInAs(null)
    const visitor = await getTeamsByEventId(a.eventId)
    expect(visitor.length).toBeGreaterThan(0)
    expect(JSON.stringify(visitor)).not.toContain("pvmgod")

    signInAs(stranger)
    expect(JSON.stringify(await getTeamsByEventId(a.eventId))).not.toContain(
      "pvmgod"
    )
  })

  it("lists teams, with the skill badges, to members only", async () => {
    await db.update(events).set({ public: false }).where(eq(events.id, a.eventId))

    signInAs(stranger)
    expect(await getTeamsByEventId(a.eventId)).toEqual([])

    signInAs(null)
    expect(await getTeamsByEventId(a.eventId)).toEqual([])

    // Teammates see each other's skill badge in the roster, but never the notes.
    signInAs(a.memberAId)
    const asMember = JSON.stringify(await getTeamsByEventId(a.eventId))
    expect(asMember).toContain("pvmgod")
    expect(asMember).not.toContain("private note")
  })

  it("keeps participants of another event out", async () => {
    signInAs(b.managerId)

    expect(await getPlayerMetadata(a.memberAId, a.eventId)).toBeNull()
    expect(
      (
        await db.query.eventParticipants.findMany({
          where: eq(eventParticipants.eventId, a.eventId),
        })
      ).length
    ).toBeGreaterThan(0)
  })
})
