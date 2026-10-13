/**
 * @jest-environment node
 */
import { eq } from "drizzle-orm"

import {
  deleteTier,
  setTierXpRequirement,
  updateTile,
  updateTileTier,
} from "@/app/actions/bingo"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  teamTierProgress,
  tierXpRequirements,
} from "@/server/db/schema"
import {
  createProgressionFixture,
  type ProgressionFixture,
} from "@/server/__tests__/helpers/progression-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/server/notifications", () => ({
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

const session = getServerAuthSession as jest.Mock

async function unlockedTiers(teamId: string) {
  const rows = await db.query.teamTierProgress.findMany({
    where: eq(teamTierProgress.teamId, teamId),
  })
  return rows
    .filter((r) => r.isUnlocked)
    .map((r) => r.tier)
    .sort()
}

/** Tier 0 of the fixture (tiles 0-2, weight 1) needs 2 XP to open Tier 1. */
describe("editing a progression board re-evaluates tier unlocks", () => {
  let fx: ProgressionFixture

  beforeEach(async () => {
    fx = await createProgressionFixture()
    // The manager created the event, so the role lookup resolves to admin.
    session.mockResolvedValue({ user: { id: fx.managerId } })
  })

  afterEach(async () => {
    await fx.cleanup()
  })

  it("opens the next tier when the requirement is lowered to what a team earned", async () => {
    await setTierXpRequirement(fx.bingoId, 0, 3)
    await fx.completeTile(0, fx.teamAId)
    await fx.completeTile(1, fx.teamAId)
    expect(await unlockedTiers(fx.teamAId)).toEqual([0])

    const result = await setTierXpRequirement(fx.bingoId, 0, 2)

    expect(result).toEqual({ success: true })
    expect(await unlockedTiers(fx.teamAId)).toEqual([0, 1])
    expect(await unlockedTiers(fx.teamBId)).toEqual([0])
  })

  it("opens the next tier when a tile weight is raised", async () => {
    await fx.completeTile(0, fx.teamAId)

    const result = await updateTile(fx.tileIds[0]!, { weight: 2 })

    expect(result).toEqual({ success: true })
    expect(await unlockedTiers(fx.teamAId)).toEqual([0, 1])
  })

  it("leaves tiers alone when an edit does not touch weight or tier", async () => {
    await fx.completeTile(0, fx.teamAId)
    await fx.completeTile(1, fx.teamAId)

    await updateTile(fx.tileIds[0]!, { title: "Renamed" })

    expect(await unlockedTiers(fx.teamAId)).toEqual([])
  })

  it("opens the next tier when a completed tile moves into the tier", async () => {
    await fx.completeTile(0, fx.teamAId)
    await fx.completeTile(3, fx.teamAId)

    const result = await updateTileTier(fx.tileIds[3]!, 0)

    expect(result).toEqual({ success: true })
    expect(await unlockedTiers(fx.teamAId)).toEqual([0, 1])
  })

  it("deletes a tier whose later tiers were stored in descending order", async () => {
    // Row order decides when the unique index is checked, so insert the
    // higher tiers first.
    await db
      .delete(tierXpRequirements)
      .where(eq(tierXpRequirements.bingoId, fx.bingoId))
    await db.insert(tierXpRequirements).values(
      [2, 1, 0].map((tier) => ({
        bingoId: fx.bingoId,
        tier,
        xpRequired: tier + 1,
      }))
    )
    await db.insert(teamTierProgress).values(
      [2, 1, 0].map((tier) => ({
        teamId: fx.teamAId,
        bingoId: fx.bingoId,
        tier,
        isUnlocked: true,
      }))
    )

    const result = await deleteTier(fx.bingoId, 0)

    expect(result).toMatchObject({ success: true })
    const requirements = await db.query.tierXpRequirements.findMany({
      where: eq(tierXpRequirements.bingoId, fx.bingoId),
    })
    // The old tiers 1 and 2 are now 0 and 1, with their requirements.
    expect(
      requirements.map((r) => [r.tier, r.xpRequired]).sort()
    ).toEqual([
      [0, 2],
      [1, 3],
    ])
    expect(await unlockedTiers(fx.teamAId)).toEqual([0, 1])
  })
})
