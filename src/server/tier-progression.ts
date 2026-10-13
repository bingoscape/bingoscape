import { and, asc, eq } from "drizzle-orm"

import { db } from "@/server/db"
import {
  bingos,
  teamTierProgress,
  teamTileSubmissions,
  tierXpRequirements,
  tiles,
} from "@/server/db/schema"
import {
  getEffectiveTierXpRequired,
  getTileTierLock,
  type BoardTierData,
} from "@/lib/tiers"

/** The shared database handle or a transaction of it. */
export type DbOrTransaction =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Session-free tier logic for progression Boards. The session-checked server
 * actions in `app/actions/bingo.ts` wrap these; the RuneLite routes and the
 * auto-completion of Tiles call them directly because they have no session.
 */

/**
 * Creates the missing tier rows of a Team (Tier 0 unlocked, the rest locked).
 * Idempotent: existing rows are left alone.
 */
async function ensureTeamTierRows(
  tx: DbOrTransaction,
  teamId: string,
  bingoId: string,
  tiers: number[]
) {
  if (tiers.length === 0) return
  await tx
    .insert(teamTierProgress)
    .values(
      tiers.map((tier) => ({
        teamId,
        bingoId,
        tier,
        isUnlocked: tier === 0,
        unlockedAt: tier === 0 ? new Date() : null,
      }))
    )
    .onConflictDoNothing()
}

/**
 * Unlocks every Tier the Team has earned: while the XP earned in the highest
 * unlocked Tier reaches that Tier's requirement, the next Tier opens, so one
 * completion can cascade through several Tiers.
 *
 * @returns the highest Tier unlocked by this call, or null if none was.
 */
export async function unlockNextTierForTeam(
  tx: DbOrTransaction,
  teamId: string,
  bingoId: string
): Promise<number | null> {
  const [bingo] = await tx
    .select({ bingoType: bingos.bingoType })
    .from(bingos)
    .where(eq(bingos.id, bingoId))
  if (bingo?.bingoType !== "progression") return null

  const tierRows = await tx
    .selectDistinct({ tier: tiles.tier })
    .from(tiles)
    .where(eq(tiles.bingoId, bingoId))
    .orderBy(asc(tiles.tier))
  const boardTiers = tierRows.map((r) => r.tier)
  if (boardTiers.length === 0) return null

  const requirements = await tx.query.tierXpRequirements.findMany({
    where: eq(tierXpRequirements.bingoId, bingoId),
  })

  // Tile weights and the Team's completed Tiles, per Tier.
  const tileRows = await tx
    .select({
      tier: tiles.tier,
      weight: tiles.weight,
      status: teamTileSubmissions.status,
    })
    .from(tiles)
    .leftJoin(
      teamTileSubmissions,
      and(
        eq(teamTileSubmissions.tileId, tiles.id),
        eq(teamTileSubmissions.teamId, teamId)
      )
    )
    .where(eq(tiles.bingoId, bingoId))
  const earnedByTier = new Map<number, number>()
  for (const row of tileRows) {
    if (row.status !== "completed") continue
    earnedByTier.set(row.tier, (earnedByTier.get(row.tier) ?? 0) + row.weight)
  }

  const readProgress = () =>
    tx.query.teamTierProgress.findMany({
      where: and(
        eq(teamTierProgress.teamId, teamId),
        eq(teamTierProgress.bingoId, bingoId)
      ),
    })

  // Rows are created lazily; a Tier added to the Board later has none yet.
  let progress = await readProgress()
  const known = new Set(progress.map((p) => p.tier))
  const missing = boardTiers.filter((t) => !known.has(t))
  if (missing.length > 0) {
    await ensureTeamTierRows(tx, teamId, bingoId, missing)
    progress = await readProgress()
  }

  const unlocked = new Set<number>([0])
  for (const p of progress) if (p.isUnlocked) unlocked.add(p.tier)

  let highestUnlocked = Math.max(...unlocked)
  let newlyUnlocked: number | null = null

  for (;;) {
    const nextTier = boardTiers.find((t) => t > highestUnlocked)
    if (nextTier === undefined) break

    const required = getEffectiveTierXpRequired(
      requirements.map((r) => ({ tier: r.tier, xpRequired: r.xpRequired })),
      tileRows,
      highestUnlocked
    )
    if ((earnedByTier.get(highestUnlocked) ?? 0) < required) break

    const [updated] = await tx
      .update(teamTierProgress)
      .set({ isUnlocked: true, unlockedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(teamTierProgress.teamId, teamId),
          eq(teamTierProgress.bingoId, bingoId),
          eq(teamTierProgress.tier, nextTier),
          eq(teamTierProgress.isUnlocked, false)
        )
      )
      .returning({ id: teamTierProgress.id })

    // A concurrent request that unlocked it first is the one to report it.
    if (updated) newlyUnlocked = nextTier
    highestUnlocked = nextTier
  }

  return newlyUnlocked
}

/** Tier unlock data of a Team on a progression Board (reads only). */
async function loadBoardTierData(
  tx: DbOrTransaction,
  teamId: string,
  bingoId: string
): Promise<BoardTierData> {
  const [requirements, progress] = await Promise.all([
    tx.query.tierXpRequirements.findMany({
      where: eq(tierXpRequirements.bingoId, bingoId),
    }),
    tx.query.teamTierProgress.findMany({
      where: and(
        eq(teamTierProgress.teamId, teamId),
        eq(teamTierProgress.bingoId, bingoId)
      ),
    }),
  ])
  return {
    requirements: requirements.map((r) => ({
      tier: r.tier,
      xpRequired: r.xpRequired,
    })),
    progress: progress.map((p) => ({
      tier: p.tier,
      isUnlocked: p.isUnlocked,
      unlockedAt: p.unlockedAt,
    })),
  }
}

/**
 * Set when a Tile of a progression Board sits in a Tier that is still locked
 * for the Team; null otherwise (always null on other Board types).
 *
 * Teams whose Tiles were completed before completions unlocked Tiers have
 * stale tier rows, so a lock is re-evaluated once after catching those up.
 * This writes, so only call it from submit paths.
 */
export async function getTierLockForSubmit(
  tx: DbOrTransaction,
  tile: { id: string; tier: number; bingoId: string },
  bingoType: string,
  teamId: string
): Promise<{ tier: number; xpNeeded: number } | null> {
  if (bingoType !== "progression" || tile.tier <= 0) return null

  const boardTiles = await tx.query.tiles.findMany({
    where: eq(tiles.bingoId, tile.bingoId),
    columns: { id: true, tier: true, weight: true, index: true },
    with: {
      teamTileSubmissions: {
        where: eq(teamTileSubmissions.teamId, teamId),
        columns: { teamId: true, status: true },
      },
    },
  })

  const lockOf = async () =>
    getTileTierLock(
      tile,
      boardTiles,
      teamId,
      await loadBoardTierData(tx, teamId, tile.bingoId)
    )

  const lock = await lockOf()
  if (!lock) return null

  await unlockNextTierForTeam(tx, teamId, tile.bingoId)
  return lockOf()
}

/** Body of the 403 a RuneLite route answers when a Tile's Tier is locked. */
export function tierLockedBody(lock: { tier: number; xpNeeded: number }) {
  return {
    error: `Tier ${lock.tier} is still locked for your team`,
    code: "TIER_LOCKED" as const,
    tier: lock.tier,
    xpNeeded: lock.xpNeeded,
  }
}
