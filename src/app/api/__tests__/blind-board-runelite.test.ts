/**
 * @jest-environment node
 */
import { eq } from "drizzle-orm"

import { POST as checkItems } from "@/app/api/runelite/items/check/route"
import { POST as submitTile } from "@/app/api/runelite/tiles/[tileId]/submissions/route"
import { POST as autoSubmitTile } from "@/app/api/runelite/tiles/[tileId]/auto-submissions/route"
import { validateApiKey } from "@/lib/api-auth"
import { fetchTeamDrops } from "@/lib/team-drops"
import { fetchTeamTileCompletions } from "@/lib/team-tile-completions"
import { db } from "@/server/db"
import { submissions, teamTileSubmissions } from "@/server/db/schema"
import {
  createBlindFixture,
  expectNoSecrets,
  expectSecret,
  type BlindFixture,
} from "@/server/__tests__/helpers/blind-fixture"
import { setClock } from "@/server/__tests__/helpers/battleship-fixture"

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

afterEach(() => {
  jest.useRealTimers()
})

const EPOCH_CURSOR = {
  t: "1970-01-01T00:00:00.000000Z",
  id: "00000000-0000-0000-0000-000000000000",
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function imageRequest(url: string): Request {
  const form = new FormData()
  form.set("image", new File(["png"], "drop.png", { type: "image/png" }))
  return new Request(url, { method: "POST", body: form })
}

const tileParams = (tileId: string) => ({ params: Promise.resolve({ tileId }) })

describe.each([
  ["battleship", "battleship" as const],
  ["standard", "standard" as const],
])("RuneLite routes on a %s board", (_label, bingoType) => {
  const isBattleship = bingoType === "battleship"
  let fx: BlindFixture

  beforeEach(async () => {
    jest.clearAllMocks()
    fx = await createBlindFixture({ bingoType })
    // Tile 2 has no completed submission of team A yet.
    await db
      .delete(teamTileSubmissions)
      .where(eq(teamTileSubmissions.tileId, fx.tileIds[2]!))
  })

  afterEach(async () => {
    await fx.cleanup()
  })

  describe("POST /api/runelite/items/check", () => {
    async function check(userId: string) {
      apiKeyUser.mockResolvedValue(userId)
      const response = await checkItems(
        jsonRequest("http://localhost/api/runelite/items/check", {
          items: [{ itemId: 4151, itemName: "Abyssal whip", quantity: 5 }],
        })
      )
      return { status: response.status, body: (await response.json()) as unknown }
    }

    it("does not match goals of a blind board before the start", async () => {
      setClock(fx.clock.beforeStart)
      const { status, body } = await check(fx.memberAId)
      expect(status).toBe(200)
      if (isBattleship) {
        expectNoSecrets(body, fx.secrets)
        expect(body).toMatchObject({ matched: [], tilesAutoCompleted: [] })
      } else {
        expectSecret(body, fx.tag)
      }
    })

    it("matches goals from the start on", async () => {
      setClock(fx.clock.afterStart)
      const { body } = await check(fx.memberAId)
      expectSecret(body, "goalId")
      expect(body).toMatchObject({ matchedGoals: 1 })
    })
  })

  describe("POST /api/runelite/tiles/[tileId]/submissions", () => {
    async function submit(userId: string) {
      apiKeyUser.mockResolvedValue(userId)
      const tileId = fx.tileIds[2]!
      const response = await submitTile(
        imageRequest(`http://localhost/api/runelite/tiles/${tileId}/submissions`),
        tileParams(tileId)
      )
      return { status: response.status, body: (await response.json()) as unknown }
    }

    it("treats a blind tile as missing for a participant", async () => {
      setClock(fx.clock.beforeStart)
      const { status, body } = await submit(fx.memberAId)
      if (isBattleship) {
        expect(status).toBe(404)
        expect(body).toEqual({ error: "Tile not found" })
        expectNoSecrets(body, fx.secrets)
      } else {
        expect(status).toBe(200)
      }
    })

    it("accepts the manager before the start", async () => {
      setClock(fx.clock.beforeStart)
      expect((await submit(fx.managerId)).status).not.toBe(404)
    })

    it.each(["atStart", "afterStart", "afterEnd"] as const)(
      "accepts a participant %s",
      async (phase) => {
        setClock(fx.clock[phase])
        expect((await submit(fx.memberAId)).status).toBe(200)
      }
    )
  })

  describe("POST /api/runelite/tiles/[tileId]/auto-submissions", () => {
    async function autoSubmit(userId: string) {
      apiKeyUser.mockResolvedValue(userId)
      const tileId = fx.tileIds[2]!
      const response = await autoSubmitTile(
        imageRequest(
          `http://localhost/api/runelite/tiles/${tileId}/auto-submissions`
        ),
        tileParams(tileId)
      )
      return { status: response.status, body: (await response.json()) as unknown }
    }

    it("treats a blind tile as missing for a participant", async () => {
      setClock(fx.clock.beforeStart)
      const { status, body } = await autoSubmit(fx.memberAId)
      if (isBattleship) {
        expect(status).toBe(404)
        expect(body).toEqual({ error: "Tile not found" })
      } else {
        expect(status).not.toBe(404)
      }
    })

    it("accepts the manager before the start and everyone after", async () => {
      setClock(fx.clock.beforeStart)
      expect((await autoSubmit(fx.managerId)).status).not.toBe(404)

      setClock(fx.clock.afterStart)
      expect((await autoSubmit(fx.memberAId)).status).not.toBe(404)
    })
  })

  describe("team tile completions feed", () => {
    const read = () =>
      fetchTeamTileCompletions({
        teamIds: [fx.teamAId],
        after: EPOCH_CURSOR,
        limit: 50,
      })

    it("lists titles of a blind board to no one before the start", async () => {
      setClock(fx.clock.beforeStart)
      const { completions } = await read()
      if (isBattleship) {
        expect(completions).toEqual([])
      } else {
        expectSecret(completions, fx.titleOf(0))
      }
    })

    it.each(["atStart", "afterStart", "afterEnd"] as const)(
      "lists completions %s",
      async (phase) => {
        setClock(fx.clock[phase])
        expectSecret((await read()).completions, fx.titleOf(0))
      }
    )
  })

  describe("team drops feed", () => {
    beforeEach(async () => {
      // The feed only serves drops older than its two second lag.
      await db
        .update(submissions)
        .set({ createdAt: new Date(Date.now() - 5 * 60 * 1000) })
        .where(eq(submissions.id, fx.submissionId))
    })

    const read = () =>
      fetchTeamDrops({
        userId: fx.leaderAId,
        teamIds: [fx.teamAId],
        after: EPOCH_CURSOR,
        limit: 50,
      })

    it("lists titles of a blind board to no one before the start", async () => {
      setClock(fx.clock.beforeStart)
      const { drops } = await read()
      if (isBattleship) {
        expect(drops).toEqual([])
      } else {
        expectSecret(drops, fx.titleOf(0))
      }
    })

    it.each(["atStart", "afterStart", "afterEnd"] as const)(
      "lists drops %s",
      async (phase) => {
        setClock(fx.clock[phase])
        expectSecret((await read()).drops, fx.titleOf(0))
      }
    )
  })
})
