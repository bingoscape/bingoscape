import { eq, inArray } from "drizzle-orm"

import { db } from "@/server/db"
import {
  bingos,
  goals,
  itemGoals,
  teamTileSubmissions,
  tierXpRequirements,
  tiles,
} from "@/server/db/schema"
import {
  createBattleshipFixture,
  type BattleshipFixture,
} from "@/server/__tests__/helpers/battleship-fixture"

/**
 * A committed progression event on top of the battleship fixture's two teams
 * and 3x3 board (see there for the board indexes). Tiles 0-2 are Tier 0,
 * 3-5 Tier 1 and 6-8 Tier 2; every Tile weighs 1 and carries one item goal
 * (target 1) with the item id `itemIdOf(index)`, so a single plugin
 * auto-submission completes it.
 *
 * Tier 0 needs 2 XP to open Tier 1, Tier 1 needs 1 XP to open Tier 2. No team
 * has tier rows yet, like a freshly created Team.
 */
export interface ProgressionFixture extends BattleshipFixture {
  /** Distinct per fixture so assertions never match another test's data. */
  tag: string
  /** Strings that only exist in the content of a Tile (title, description, image). */
  secrets: string[]
  itemIdOf: (index: number) => number
  tierOf: (index: number) => number
  titleOf: (index: number) => string
  descriptionOf: (index: number) => string
  /** Marks the Tile at `index` as completed for the team, without any route. */
  completeTile: (index: number, teamId: string) => Promise<void>
  /** Removes the goals of the Tiles at the given indexes. */
  removeGoals: (indexes: number[]) => Promise<void>
}

export const PROGRESSION_TIER_XP = [2, 1] as const

export async function createProgressionFixture(): Promise<ProgressionFixture> {
  const base = await createBattleshipFixture({ bingoType: "progression" })
  const tag = `zp${Math.random().toString(36).slice(2, 10)}`

  const tierOf = (i: number) => Math.floor(i / 3)
  const titleOf = (i: number) => `Secret title ${i} ${tag}`
  const descriptionOf = (i: number) => `Secret description ${i} ${tag}`
  const imageOf = (i: number) => `https://example.test/${tag}-header-${i}.png`
  const itemIdOf = (i: number) => 5000 + i

  await db
    .update(bingos)
    .set({ visible: true })
    .where(eq(bingos.id, base.bingoId))

  for (const [index, tileId] of base.tileIds.entries()) {
    await db
      .update(tiles)
      .set({
        title: titleOf(index),
        description: descriptionOf(index),
        headerImage: imageOf(index),
        weight: 1,
        tier: tierOf(index),
      })
      .where(eq(tiles.id, tileId))

    const [goal] = await db
      .insert(goals)
      .values({
        tileId,
        description: `Secret goal ${index} ${tag}`,
        targetValue: 1,
        goalType: "item",
      })
      .returning({ id: goals.id })
    await db.insert(itemGoals).values({
      goalId: goal!.id,
      itemId: itemIdOf(index),
      baseName: `Secret item ${index} ${tag}`,
      imageUrl: `https://example.test/${tag}-item-${index}.png`,
    })
  }

  await db.insert(tierXpRequirements).values(
    PROGRESSION_TIER_XP.map((xpRequired, tier) => ({
      bingoId: base.bingoId,
      tier,
      xpRequired,
    }))
  )

  return {
    ...base,
    tag,
    secrets: [
      tag,
      ...base.tileIds.flatMap((_, i) => [titleOf(i), descriptionOf(i)]),
    ],
    itemIdOf,
    tierOf,
    titleOf,
    descriptionOf,
    completeTile: async (index, teamId) => {
      await db
        .insert(teamTileSubmissions)
        .values({
          tileId: base.tileIds[index]!,
          teamId,
          status: "completed",
          completedAt: new Date(),
        })
        .onConflictDoNothing()
    },
    removeGoals: async (indexes) => {
      await db.delete(goals).where(
        inArray(
          goals.tileId,
          indexes.map((i) => base.tileIds[i]!)
        )
      )
    },
  }
}
