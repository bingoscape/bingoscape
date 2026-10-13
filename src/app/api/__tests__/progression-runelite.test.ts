/**
 * @jest-environment node
 */
import { eq } from "drizzle-orm"

import { GET as getBingo } from "@/app/api/runelite/bingos/[bingoId]/route"
import { POST as checkItems } from "@/app/api/runelite/items/check/route"
import { POST as submitTile } from "@/app/api/runelite/tiles/[tileId]/submissions/route"
import { POST as autoSubmitTile } from "@/app/api/runelite/tiles/[tileId]/auto-submissions/route"
import { validateApiKey } from "@/lib/api-auth"
import { db } from "@/server/db"
import {
  goalGroups,
  teamGoalProgress,
  teamTierProgress,
} from "@/server/db/schema"
import { expectNoSecrets } from "@/server/__tests__/helpers/blind-fixture"
import {
  createProgressionFixture,
  type ProgressionFixture,
} from "@/server/__tests__/helpers/progression-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("@/lib/api-auth", () => ({ validateApiKey: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))
jest.mock("@/lib/discord-webhook", () => ({
  sendDiscordWebhook: jest.fn(),
  createSubmissionEmbed: jest.fn(),
}))
// Never touch the real uploads directory.
jest.mock("fs/promises", () => ({
  __esModule: true,
  default: {
    access: jest.fn(async () => undefined),
    mkdir: jest.fn(async () => undefined),
    writeFile: jest.fn(async () => undefined),
  },
}))
// Item matching normally asks the OSRS wiki.
jest.mock("@/app/actions/osrs-items", () => ({
  doesItemMatchBaseName: jest.fn(async () => ({
    success: true,
    matches: true,
  })),
}))

const apiKeyUser = validateApiKey as jest.Mock

interface BoardTile {
  id: string
  index: number
  tier: number
  tierLocked: boolean
  title: string
  description: string | null
  headerImage: string | null
  weight: number
  goals: unknown[]
  goalTree: unknown[]
  submission: { status: string; submissionCount: number }
}

interface Board {
  tiles: BoardTile[]
  progression: {
    unlockedTiers: number[]
    tiers: Array<{
      tier: number
      isUnlocked: boolean
      unlockedAt: string | null
      earnedXp: number
      xpRequired: number
    }>
  }
  tierUnlocked?: number | null
}

function imageRequest(url: string, metadata?: unknown): Request {
  const form = new FormData()
  form.set("image", new File(["png"], "drop.png", { type: "image/png" }))
  if (metadata) form.set("metadata", JSON.stringify(metadata))
  return new Request(url, { method: "POST", body: form })
}

const tileParams = (tileId: string) => ({ params: Promise.resolve({ tileId }) })

describe("progression board over the RuneLite API", () => {
  let fx: ProgressionFixture

  beforeEach(async () => {
    jest.clearAllMocks()
    fx = await createProgressionFixture()
  })

  afterEach(async () => {
    await fx.cleanup()
  })

  async function readBoard(userId: string) {
    apiKeyUser.mockResolvedValue(userId)
    const response = await getBingo(
      new Request(`http://localhost/api/runelite/bingos/${fx.bingoId}`) as never,
      { params: Promise.resolve({ bingoId: fx.bingoId }) }
    )
    expect(response.status).toBe(200)
    return (await response.json()) as Board
  }

  async function autoSubmit(index: number, userId = fx.memberAId) {
    apiKeyUser.mockResolvedValue(userId)
    const tileId = fx.tileIds[index]!
    const response = await autoSubmitTile(
      imageRequest(
        `http://localhost/api/runelite/tiles/${tileId}/auto-submissions`,
        { itemId: fx.itemIdOf(index), quantity: 1 }
      ),
      tileParams(tileId)
    )
    return { status: response.status, body: (await response.json()) as Board }
  }

  async function tierRows(teamId: string) {
    const rows = await db.query.teamTierProgress.findMany({
      where: eq(teamTierProgress.teamId, teamId),
    })
    return rows.filter((r) => r.isUnlocked).map((r) => r.tier).sort()
  }

  describe("GET /api/runelite/bingos/[bingoId]", () => {
    it("shows a fresh team Tier 0 even though it has no tier rows yet", async () => {
      expect(await db.query.teamTierProgress.findMany()).not.toContainEqual(
        expect.objectContaining({ teamId: fx.teamAId })
      )

      const board = await readBoard(fx.memberAId)

      const open = board.tiles.filter((t) => !t.tierLocked)
      expect(open.map((t) => t.index)).toEqual([0, 1, 2])
      expect(open.every((t) => t.tier === 0)).toBe(true)
      expect(open.map((t) => t.title)).toEqual([0, 1, 2].map(fx.titleOf))
      expect(board.progression.unlockedTiers).toEqual([0])
    })

    it("lists every tier, locked ones included, with earned and required XP", async () => {
      await fx.completeTile(0, fx.teamAId)

      const { progression } = await readBoard(fx.memberAId)

      expect(progression.tiers).toEqual([
        expect.objectContaining({
          tier: 0,
          isUnlocked: true,
          earnedXp: 1,
          xpRequired: 2,
        }),
        expect.objectContaining({
          tier: 1,
          isUnlocked: false,
          unlockedAt: null,
          earnedXp: 0,
          xpRequired: 1,
        }),
        expect.objectContaining({
          tier: 2,
          isUnlocked: false,
          unlockedAt: null,
          earnedXp: 0,
          xpRequired: 5,
        }),
      ])
    })

    it("sends the tiles of locked tiers as stubs without any content", async () => {
      const board = await readBoard(fx.memberAId)

      expect(board.tiles).toHaveLength(9)
      const stubs = board.tiles.filter((t) => t.tierLocked)
      expect(stubs.map((t) => t.index)).toEqual([3, 4, 5, 6, 7, 8])
      for (const stub of stubs) {
        expect(stub).toMatchObject({
          title: "",
          description: null,
          headerImage: null,
          weight: 0,
          goals: [],
          goalTree: [],
          submission: { status: "not_submitted", submissionCount: 0 },
        })
        expect(stub.tier).toBe(fx.tierOf(stub.index))
      }

      // Secrets of the open tiles are fine; those of the locked ones must not
      // be anywhere in the response.
      const lockedSecrets = [3, 4, 5, 6, 7, 8].flatMap((i) => [
        fx.titleOf(i),
        fx.descriptionOf(i),
        `Secret goal ${i} ${fx.tag}`,
        `Secret item ${i} ${fx.tag}`,
        `${fx.tag}-header-${i}`,
        `${fx.tag}-item-${i}`,
      ])
      expectNoSecrets(stubs, [fx.tag])
      expectNoSecrets(board, lockedSecrets)
    })

    it("opens the content of a tier once it is unlocked", async () => {
      await autoSubmit(0)
      await autoSubmit(1)

      const board = await readBoard(fx.memberAId)

      expect(board.progression.unlockedTiers).toEqual([0, 1])
      const tier1 = board.tiles.filter((t) => t.tier === 1)
      expect(tier1.every((t) => !t.tierLocked)).toBe(true)
      expect(tier1.map((t) => t.title)).toEqual([3, 4, 5].map(fx.titleOf))
      expect(board.tiles.filter((t) => t.tier === 2).every((t) => t.tierLocked)).toBe(
        true
      )
    })
  })

  describe("submitting to a locked tier", () => {
    it("rejects an image submission with TIER_LOCKED", async () => {
      apiKeyUser.mockResolvedValue(fx.memberAId)
      const tileId = fx.tileIds[3]!

      const response = await submitTile(
        imageRequest(`http://localhost/api/runelite/tiles/${tileId}/submissions`),
        tileParams(tileId)
      )

      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({
        code: "TIER_LOCKED",
        tier: 1,
        xpNeeded: 2,
      })
    })

    it("accepts an image submission to an unlocked tier and reports no unlock", async () => {
      apiKeyUser.mockResolvedValue(fx.memberAId)
      const tileId = fx.tileIds[0]!

      const response = await submitTile(
        imageRequest(`http://localhost/api/runelite/tiles/${tileId}/submissions`),
        tileParams(tileId)
      )

      expect(response.status).toBe(200)
      expect(((await response.json()) as Board).tierUnlocked).toBeNull()
    })

    it("rejects an auto-submission with TIER_LOCKED and records nothing", async () => {
      const { status, body } = await autoSubmit(3)

      expect(status).toBe(403)
      expect(body).toMatchObject({ code: "TIER_LOCKED" })
      expect(await db.query.teamGoalProgress.findMany()).not.toContainEqual(
        expect.objectContaining({ teamId: fx.teamAId })
      )
    })

    it("answers an item scan that only matches locked goals with TIER_LOCKED", async () => {
      await fx.removeGoals([0, 1, 2])
      apiKeyUser.mockResolvedValue(fx.memberAId)

      const response = await checkItems(
        new Request("http://localhost/api/runelite/items/check", {
          method: "POST",
          body: JSON.stringify({
            items: [{ itemId: 1, itemName: "Anything", quantity: 5 }],
          }),
        })
      )

      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: "TIER_LOCKED" })
      const progress = await db.query.teamGoalProgress.findMany({
        where: eq(teamGoalProgress.teamId, fx.teamAId),
      })
      expect(progress).toEqual([])
    })

    it("skips locked goals in an item scan that also matches open ones", async () => {
      apiKeyUser.mockResolvedValue(fx.memberAId)

      const response = await checkItems(
        new Request("http://localhost/api/runelite/items/check", {
          method: "POST",
          body: JSON.stringify({
            items: [{ itemId: 1, itemName: "Anything", quantity: 5 }],
          }),
        })
      )

      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        matched: Array<{ tileId: string }>
      }
      expect(body.matched.map((m) => m.tileId).sort()).toEqual(
        [0, 1, 2].map((i) => fx.tileIds[i]!).sort()
      )
    })

    it("lets a team that earned the tier through the website submit", async () => {
      await fx.completeTile(0, fx.teamAId)
      await fx.completeTile(1, fx.teamAId)
      // The tier rows predate completions unlocking tiers: they are stale.
      expect(await tierRows(fx.teamAId)).toEqual([])

      const { status } = await autoSubmit(3)

      expect(status).toBe(200)
    })

    it("does not unlock a tier for the other team", async () => {
      await autoSubmit(0)
      await autoSubmit(1)

      const { status } = await autoSubmit(3, fx.memberBId)

      expect(status).toBe(403)
    })
  })

  describe("plugin completions unlocking tiers", () => {
    it("unlocks the next tier when the XP requirement is met", async () => {
      const first = await autoSubmit(0)
      expect(first.status).toBe(200)
      expect(first.body.tierUnlocked).toBeNull()
      expect(await tierRows(fx.teamAId)).toEqual([0])

      const second = await autoSubmit(1)
      expect(second.body.tierUnlocked).toBe(1)
      expect(await tierRows(fx.teamAId)).toEqual([0, 1])
      expect(second.body.progression.unlockedTiers).toEqual([0, 1])
      expect(second.body.progression.tiers[1]).toMatchObject({
        tier: 1,
        isUnlocked: true,
      })
      expect(second.body.progression.tiers[1]!.unlockedAt).not.toBeNull()
      expect(await tierRows(fx.teamBId)).toEqual([])
    })

    it("cascades through every tier whose requirement is already met", async () => {
      // Tier 1 was completed before it was open, e.g. on the website.
      await fx.completeTile(3, fx.teamAId)
      await autoSubmit(0)

      const { body } = await autoSubmit(1)

      expect(body.tierUnlocked).toBe(2)
      expect(await tierRows(fx.teamAId)).toEqual([0, 1, 2])
      expect(body.progression.unlockedTiers).toEqual([0, 1, 2])
      expect(body.tiles.every((t) => !t.tierLocked)).toBe(true)
    })

    it("unlocks tiers from an item scan", async () => {
      apiKeyUser.mockResolvedValue(fx.memberAId)

      const response = await checkItems(
        new Request("http://localhost/api/runelite/items/check", {
          method: "POST",
          body: JSON.stringify({
            items: [{ itemId: 1, itemName: "Anything", quantity: 5 }],
          }),
        })
      )

      expect(response.status).toBe(200)
      expect(((await response.json()) as Board).tierUnlocked).toBe(1)
      expect(await tierRows(fx.teamAId)).toEqual([0, 1])
    })

    it("does not unlock anything for a goal group that is still incomplete", async () => {
      await db.insert(goalGroups).values({
        tileId: fx.tileIds[1]!,
        name: "Never complete",
        logicalOperator: "AND",
      })
      await autoSubmit(0)

      const { body } = await autoSubmit(1)

      expect(body.tierUnlocked).toBeNull()
      expect(await tierRows(fx.teamAId)).toEqual([0])
    })
  })
})
