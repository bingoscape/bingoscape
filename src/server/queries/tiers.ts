import { getTeamTierProgress, getTierXpRequirements } from "@/app/actions/bingo"
import { logger } from "@/lib/logger"
import type { BoardTierData } from "@/lib/tiers"

/**
 * Tier unlock data for a progression Board, for the Team being viewed. Reads
 * only: Teams without tier rows simply see Tier 0 unlocked, and the rows are
 * created when the first Tile of the Team is reviewed
 * (see checkAndUnlockNextTier).
 */
export async function getBoardTierData(
  bingo: { id: string; bingoType: string } | undefined,
  teamId: string | undefined
): Promise<BoardTierData | null> {
  if (!bingo || bingo.bingoType !== "progression") return null

  try {
    const [requirements, progress] = await Promise.all([
      getTierXpRequirements(bingo.id),
      teamId ? getTeamTierProgress(teamId, bingo.id) : Promise.resolve([]),
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
  } catch (error) {
    // No fallback: empty data would render every Tier above 0 as locked and
    // hide the failure.
    logger.error({ error, bingoId: bingo.id }, "Failed to load tier data")
    throw error
  }
}
