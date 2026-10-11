import type { ExportedBingo } from "@/lib/bingo-template-schema"

/**
 * Server-side preview payloads for templates.
 *
 * Client components never see the stored JSON document: the server validates
 * it once and hands over only what the UI draws. For anyone but the creator,
 * hidden Tiles are masked here, so their content never reaches the browser.
 */

export const MASKED_TILE_TITLE = "???"

/** Hosts `next.config.js` allows for `next/image`. */
const ALLOWED_IMAGE_HOSTS = new Set([
  "oldschool.runescape.wiki",
  "runescape.wiki",
  "cdn.discordapp.com",
  "avatars.discordapp.com",
  "avatars.githubusercontent.com",
])

/**
 * Template JSON is user controlled. Only render header images the image
 * optimizer is configured for (or our own uploads); anything else would make
 * `next/image` throw while rendering the page.
 */
export function safePreviewImage(
  url: string | null | undefined
): string | null {
  if (!url) return null
  if (url.startsWith("/") && !url.startsWith("//")) return url
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" &&
      ALLOWED_IMAGE_HOSTS.has(parsed.hostname)
      ? url
      : null
  } catch {
    return null
  }
}

export interface TemplateCardPreviewCell {
  index: number
  headerImage: string | null
  tier: number
  masked: boolean
}

/** Minimal payload for the static mini-board on gallery cards. */
export interface TemplateCardPreview {
  rows: number
  columns: number
  bingoType: "standard" | "progression"
  cells: TemplateCardPreviewCell[]
}

export interface TemplatePreviewGoal {
  description: string
  targetValue: number
}

export interface TemplatePreviewTile {
  index: number
  title: string
  headerImage: string | null
  /** `null` when the Tile is masked. */
  weight: number | null
  tier: number
  /** Hidden Tile whose content was withheld from this viewer. */
  masked: boolean
  /** True for hidden Tiles, also when the viewer is the creator. */
  isHidden: boolean
  description: string
  goals: TemplatePreviewGoal[]
}

export interface TemplatePreviewTier {
  tier: number
  tileCount: number
  /** XP of the visible Tiles in this tier. */
  totalXp: number
  /** Tiles of this tier whose content is masked (their XP isn't in `totalXp`). */
  maskedCount: number
  /** XP needed in this tier to unlock the next one, if known. */
  unlockXp: number | null
}

export interface TemplatePreviewBonuses {
  rows: { index: number; xp: number }[]
  columns: { index: number; xp: number }[]
  mainDiagonal: number
  antiDiagonal: number
  completeBoard: number
}

/** Full payload for the tap-to-inspect board on the detail page. */
export interface TemplatePreviewData {
  rows: number
  columns: number
  bingoType: "standard" | "progression"
  tiles: TemplatePreviewTile[]
  /** Only for progression boards. */
  tiers: TemplatePreviewTier[]
  /** `null` when the template has no pattern bonuses. */
  bonuses: TemplatePreviewBonuses | null
  maskedCount: number
}

export function buildCardPreview(exported: ExportedBingo): TemplateCardPreview {
  const { rows, columns, bingoType } = exported.metadata
  return {
    rows,
    columns,
    bingoType,
    cells: exported.tiles.map((tile) => ({
      index: tile.index,
      headerImage: tile.isHidden ? null : safePreviewImage(tile.headerImage),
      tier: tile.tier,
      // Cards are public surfaces: never show hidden content, not even to
      // the creator, so the list looks the same for everyone.
      masked: tile.isHidden,
    })),
  }
}

export function buildDetailPreview(
  exported: ExportedBingo,
  options: { isOwner: boolean }
): TemplatePreviewData {
  const { metadata } = exported

  const tiles: TemplatePreviewTile[] = exported.tiles
    .map((tile) => {
      const masked = tile.isHidden && !options.isOwner
      return {
        index: tile.index,
        title: masked ? MASKED_TILE_TITLE : tile.title,
        headerImage: masked ? null : safePreviewImage(tile.headerImage),
        weight: masked ? null : tile.weight,
        tier: tile.tier,
        masked,
        isHidden: tile.isHidden,
        description: masked ? "" : tile.description,
        goals: masked
          ? []
          : (tile.goals ?? []).map((goal) => ({
              description: goal.description,
              targetValue: goal.targetValue,
            })),
      }
    })
    .sort((a, b) => a.index - b.index)

  let tiers: TemplatePreviewTier[] = []
  if (metadata.bingoType === "progression") {
    const unlockByTier = new Map(
      (exported.tierXpRequirements ?? []).map((r) => [r.tier, r.xpRequired])
    )
    const grouped = new Map<number, TemplatePreviewTier>()
    for (const tile of tiles) {
      const entry = grouped.get(tile.tier) ?? {
        tier: tile.tier,
        tileCount: 0,
        totalXp: 0,
        maskedCount: 0,
        unlockXp: null,
      }
      entry.tileCount += 1
      entry.totalXp += tile.weight ?? 0
      if (tile.masked) entry.maskedCount += 1
      grouped.set(tile.tier, entry)
    }
    tiers = [...grouped.values()].sort((a, b) => a.tier - b.tier)
    tiers.forEach((entry, i) => {
      const isLast = i === tiers.length - 1
      entry.unlockXp = isLast
        ? null
        : (unlockByTier.get(entry.tier) ??
          metadata.tiersUnlockRequirement ??
          null)
    })
  }

  const rowBonuses = (exported.rowBonuses ?? [])
    .filter((b) => b.bonusXP > 0)
    .map((b) => ({ index: b.rowIndex, xp: b.bonusXP }))
    .sort((a, b) => a.index - b.index)
  const columnBonuses = (exported.columnBonuses ?? [])
    .filter((b) => b.bonusXP > 0)
    .map((b) => ({ index: b.columnIndex, xp: b.bonusXP }))
    .sort((a, b) => a.index - b.index)
  const mainDiagonal = metadata.mainDiagonalBonusXP ?? 0
  const antiDiagonal = metadata.antiDiagonalBonusXP ?? 0
  const completeBoard = metadata.completeBoardBonusXP ?? 0
  const hasBonuses =
    rowBonuses.length > 0 ||
    columnBonuses.length > 0 ||
    mainDiagonal > 0 ||
    antiDiagonal > 0 ||
    completeBoard > 0

  return {
    rows: metadata.rows,
    columns: metadata.columns,
    bingoType: metadata.bingoType,
    tiles,
    tiers,
    bonuses: hasBonuses
      ? {
          rows: rowBonuses,
          columns: columnBonuses,
          mainDiagonal,
          antiDiagonal,
          completeBoard,
        }
      : null,
    maskedCount: tiles.filter((tile) => tile.masked).length,
  }
}
