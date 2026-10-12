/**
 * @jest-environment node
 */
import { eq } from "drizzle-orm"

import { submitImage } from "@/app/actions/bingo"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { teamTileSubmissions } from "@/server/db/schema"
import {
  createBlindFixture,
  expectNoSecrets,
  type BlindFixture,
} from "@/server/__tests__/helpers/blind-fixture"
import { setClock } from "@/server/__tests__/helpers/battleship-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/app/actions/notifications", () => ({
  createNotification: jest.fn(),
}))
jest.mock("@/lib/discord-webhook", () => ({
  sendDiscordWebhook: jest.fn(),
  createSubmissionEmbed: jest.fn(),
}))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))
const mockWriteFile = jest.fn(async (..._args: unknown[]) => undefined)

// Never touch the real uploads directory.
jest.mock("fs/promises", () => ({
  __esModule: true,
  default: {
    access: jest.fn(async () => undefined),
    mkdir: jest.fn(async () => undefined),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    unlink: jest.fn(async () => undefined),
  },
}))

const session = getServerAuthSession as jest.Mock

function signInAs(userId: string | null) {
  session.mockResolvedValue(userId ? { user: { id: userId } } : null)
}

afterEach(() => {
  jest.useRealTimers()
})

function submissionForm(fx: BlindFixture, tileIndex: number): FormData {
  const form = new FormData()
  form.set("tileId", fx.tileIds[tileIndex]!)
  form.set("teamId", fx.teamAId)
  form.set("image", new File(["png"], "drop.png", { type: "image/png" }))
  return form
}

async function submissionCount(fx: BlindFixture, tileIndex: number) {
  return (
    await db
      .select()
      .from(teamTileSubmissions)
      .where(eq(teamTileSubmissions.tileId, fx.tileIds[tileIndex]!))
  ).length
}

describe("submitImage on a battleship board", () => {
  let fx: BlindFixture

  beforeEach(async () => {
    jest.clearAllMocks()
    fx = await createBlindFixture()
  })

  afterEach(async () => {
    await fx.cleanup()
  })

  it("treats a blind tile as missing for a team member before the start", async () => {
    setClock(fx.clock.beforeStart)
    signInAs(fx.memberAId)

    const result = await submitImage(submissionForm(fx, 2))

    expect(result).toEqual({ success: false, error: "Tile not found" })
    expectNoSecrets(result, fx.secrets)
    expect(mockWriteFile).not.toHaveBeenCalled()
    expect(await submissionCount(fx, 2)).toBe(0)
  })

  it("lets the manager submit before the start", async () => {
    setClock(fx.clock.beforeStart)
    signInAs(fx.managerId)

    expect((await submitImage(submissionForm(fx, 2))).success).toBe(true)
    expect(await submissionCount(fx, 2)).toBe(1)
  })

  it.each(["atStart", "afterStart", "afterEnd"] as const)(
    "lets a team member submit %s",
    async (phase) => {
      setClock(fx.clock[phase])
      signInAs(fx.memberAId)

      expect((await submitImage(submissionForm(fx, 2))).success).toBe(true)
      expect(await submissionCount(fx, 2)).toBe(1)
    }
  )
})

describe("submitImage on a standard board", () => {
  it("is unaffected before the start", async () => {
    const fx = await createBlindFixture({ bingoType: "standard" })
    try {
      setClock(fx.clock.beforeStart)
      signInAs(fx.memberAId)
      expect((await submitImage(submissionForm(fx, 2))).success).toBe(true)
    } finally {
      await fx.cleanup()
    }
  })
})
