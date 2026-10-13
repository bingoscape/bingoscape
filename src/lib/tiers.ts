/**
 * Pure helpers for progression (tiered) Boards. A **Tier** is a group of Tiles;
 * higher Tiers stay locked until the Team has earned enough XP in the previous
 * Tier (mirrors `checkAndUnlockNextTier`).
 */

/** Default XP needed in a Tier to unlock the next one (server default). */
export const DEFAULT_TIER_XP_REQUIREMENT = 5

export interface TierRequirement {
  tier: number
  xpRequired: number
}

export interface TierProgressEntry {
  tier: number
  isUnlocked: boolean
  unlockedAt?: Date | null
}

export interface BoardTierData {
  requirements: TierRequirement[]
  progress: TierProgressEntry[]
}

interface TierTile {
  id: string
  tier: number
  weight: number
  index: number
  teamTileSubmissions?: Array<{ teamId: string; status: string }>
}

/** Tier 0 is always unlocked. */
export function getUnlockedTiers(progress: TierProgressEntry[]): Set<number> {
  const unlocked = new Set<number>([0])
  for (const p of progress) if (p.isUnlocked) unlocked.add(p.tier)
  return unlocked
}

export function getTierXpRequired(
  requirements: TierRequirement[],
  tier: number
): number {
  return (
    requirements.find((r) => r.tier === tier)?.xpRequired ??
    DEFAULT_TIER_XP_REQUIREMENT
  )
}

/** XP all Tiles of one Tier are worth together: the most a Team can earn there. */
export function getTierCapacity(
  tiles: Array<Pick<TierTile, "tier" | "weight">>,
  tier: number
): number {
  return tiles
    .filter((t) => t.tier === tier)
    .reduce((sum, t) => sum + t.weight, 0)
}

/**
 * The XP requirement of a Tier, capped at what the Tier can ever yield. A
 * requirement above that (a fixed default on a small Tier, or weights lowered
 * later) would otherwise keep the next Tier locked forever.
 */
export function getEffectiveTierXpRequired(
  requirements: TierRequirement[],
  tiles: Array<Pick<TierTile, "tier" | "weight">>,
  tier: number
): number {
  return Math.min(
    getTierXpRequired(requirements, tier),
    getTierCapacity(tiles, tier)
  )
}

/** XP the Team has earned from completed Tiles of one Tier. */
export function getTierEarnedXp(
  tiles: TierTile[],
  teamId: string | undefined,
  tier: number
): number {
  if (!teamId) return 0
  return tiles
    .filter((t) => t.tier === tier)
    .filter((t) =>
      t.teamTileSubmissions?.some(
        (tts) => tts.teamId === teamId && tts.status === "completed"
      )
    )
    .reduce((sum, t) => sum + t.weight, 0)
}

export interface TierBand<T extends TierTile> {
  tier: number
  tiles: T[]
}

/** Tiles grouped by Tier (ascending), each Tier's Tiles ordered by index. */
export function groupTilesByTier<T extends TierTile>(tiles: T[]): TierBand<T>[] {
  const byTier = new Map<number, T[]>()
  for (const tile of tiles) {
    const list = byTier.get(tile.tier) ?? []
    list.push(tile)
    byTier.set(tile.tier, list)
  }
  return [...byTier.entries()]
    .sort(([a], [b]) => a - b)
    .map(([tier, list]) => ({
      tier,
      tiles: list.sort((a, b) => a.index - b.index),
    }))
}

export interface TierStatus {
  tier: number
  unlocked: boolean
  /** XP earned in the previous Tier (what unlocks this one). */
  earnedInPrevious: number
  /** XP required in the previous Tier to unlock this one. */
  requiredInPrevious: number
  /** XP still missing; 0 when unlocked. */
  xpNeeded: number
}

/** Unlock status of one Tier for a Team. */
export function getTierStatus(
  tier: number,
  tiles: TierTile[],
  teamId: string | undefined,
  data: BoardTierData
): TierStatus {
  const unlocked = getUnlockedTiers(data.progress).has(tier)
  if (tier <= 0) {
    return {
      tier,
      unlocked: true,
      earnedInPrevious: 0,
      requiredInPrevious: 0,
      xpNeeded: 0,
    }
  }
  const earned = getTierEarnedXp(tiles, teamId, tier - 1)
  const required = getEffectiveTierXpRequired(
    data.requirements,
    tiles,
    tier - 1
  )
  return {
    tier,
    unlocked,
    earnedInPrevious: earned,
    requiredInPrevious: required,
    xpNeeded: unlocked ? 0 : Math.max(0, required - earned),
  }
}

/** Set when the Tile's Tier is still locked for the Team; null otherwise. */
export function getTileTierLock(
  tile: Pick<TierTile, "tier">,
  tiles: TierTile[],
  teamId: string | undefined,
  data: BoardTierData | null | undefined
): { tier: number; xpNeeded: number } | null {
  if (!data) return null
  const status = getTierStatus(tile.tier, tiles, teamId, data)
  return status.unlocked ? null : { tier: tile.tier, xpNeeded: status.xpNeeded }
}
