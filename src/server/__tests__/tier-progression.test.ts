/**
 * @jest-environment node
 */
import { eq } from "drizzle-orm"

import { db } from "@/server/db"
import { teamTierProgress, tiles } from "@/server/db/schema"
import { createBattleshipFixture } from "@/server/__tests__/helpers/battleship-fixture"
import {
  createProgressionFixture,
  type ProgressionFixture,
} from "@/server/__tests__/helpers/progression-fixture"
import { unlockNextTierForTeam } from "@/server/tier-progression"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))

describe("unlockNextTierForTeam", () => {
  describe("on a progression board", () => {
    let fx: ProgressionFixture

    beforeEach(async () => {
      fx = await createProgressionFixture()
    })

    afterEach(async () => {
      await fx.cleanup()
    })

    it("does nothing until the requirement is met", async () => {
      await fx.completeTile(0, fx.teamAId)

      expect(await unlockNextTierForTeam(db, fx.teamAId, fx.bingoId)).toBeNull()
    })

    it("returns the highest tier it unlocked and is idempotent", async () => {
      await fx.completeTile(0, fx.teamAId)
      await fx.completeTile(1, fx.teamAId)
      await fx.completeTile(3, fx.teamAId)

      expect(await unlockNextTierForTeam(db, fx.teamAId, fx.bingoId)).toBe(2)
      expect(await unlockNextTierForTeam(db, fx.teamAId, fx.bingoId)).toBeNull()
    })

    it("follows the tiers that exist when the board skips a tier number", async () => {
      // Tier 1 does not exist: Tier 0 opens Tier 2 directly.
      await db
        .update(tiles)
        .set({ tier: 2 })
        .where(eq(tiles.id, fx.tileIds[3]!))
      await db.update(tiles).set({ tier: 2 }).where(eq(tiles.id, fx.tileIds[4]!))
      await db.update(tiles).set({ tier: 2 }).where(eq(tiles.id, fx.tileIds[5]!))
      await fx.completeTile(0, fx.teamAId)
      await fx.completeTile(1, fx.teamAId)

      expect(await unlockNextTierForTeam(db, fx.teamAId, fx.bingoId)).toBe(2)
      const rows = await db.query.teamTierProgress.findMany({
        where: eq(teamTierProgress.teamId, fx.teamAId),
      })
      expect(rows.filter((r) => r.isUnlocked).map((r) => r.tier).sort()).toEqual(
        [0, 2]
      )
    })
  })

  it("ignores boards that are not progression boards", async () => {
    const fx = await createBattleshipFixture({ bingoType: "standard" })
    try {
      expect(await unlockNextTierForTeam(db, fx.teamAId, fx.bingoId)).toBeNull()
    } finally {
      await fx.cleanup()
    }
  })
})
