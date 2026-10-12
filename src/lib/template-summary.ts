import type { BingoType } from "@/server/db/schema"
import {
  parseExportedBingo,
  type ExportedBingo,
} from "@/lib/bingo-template-schema"

/**
 * Denormalised facts about a template, stored in `bingo_templates` so the
 * gallery can filter, sort and count without parsing every JSON document.
 * Field names match the table columns.
 */
export interface TemplateSummary {
  schemaVersion: string
  bingoType: BingoType
  rows: number
  columns: number
  tileCount: number
  /** Distinct tiers used by the tiles (1 for a standard board with tiles). */
  tierCount: number
  /** Sum of tile weights plus every pattern bonus. */
  totalXp: number
  hasPatternBonuses: boolean
  hasHiddenTiles: boolean
}

/** Sum of every pattern bonus (rows, columns, diagonals, full board). */
export function sumPatternBonuses(exported: ExportedBingo): number {
  const { metadata, rowBonuses, columnBonuses } = exported
  return (
    (rowBonuses ?? []).reduce((sum, b) => sum + b.bonusXP, 0) +
    (columnBonuses ?? []).reduce((sum, b) => sum + b.bonusXP, 0) +
    (metadata.mainDiagonalBonusXP ?? 0) +
    (metadata.antiDiagonalBonusXP ?? 0) +
    (metadata.completeBoardBonusXP ?? 0)
  )
}

/**
 * Pure summary of an already validated export. Used when a template is saved
 * and by the backfill script, so both always agree.
 */
export function summarizeTemplate(exported: ExportedBingo): TemplateSummary {
  const { metadata, tiles } = exported
  const patternBonusXp = sumPatternBonuses(exported)

  return {
    schemaVersion: exported.version,
    bingoType: metadata.bingoType,
    rows: metadata.rows,
    columns: metadata.columns,
    tileCount: tiles.length,
    tierCount: new Set(tiles.map((tile) => tile.tier)).size,
    totalXp: tiles.reduce((sum, tile) => sum + tile.weight, 0) + patternBonusXp,
    hasPatternBonuses: patternBonusXp > 0,
    hasHiddenTiles: tiles.some((tile) => tile.isHidden),
  }
}

export type SummarizeStoredTemplateResult =
  | { success: true; summary: TemplateSummary }
  | { success: false; error: string }

/**
 * Summarises the raw `template_data` column. Never throws: unparsable rows are
 * reported so the backfill can log and skip them.
 */
export function summarizeStoredTemplate(
  raw: string
): SummarizeStoredTemplateResult {
  const parsed = parseExportedBingo(raw)
  if (!parsed.success) return { success: false, error: parsed.error }
  return { success: true, summary: summarizeTemplate(parsed.data) }
}
