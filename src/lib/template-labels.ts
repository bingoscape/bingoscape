import type { TemplateSummary } from "@/lib/template-summary"

export const BINGO_TYPE_LABELS = {
  standard: "Standard",
  progression: "Progression",
} as const

/** `5×5`, using the multiplication sign shown to users. */
export function formatBoardSize(rows: number, columns: number): string {
  return `${rows}×${columns}`
}

/** `"5x5"` (URL form) to `5×5` (display form). */
export function formatSizeParam(size: string): string {
  return size.replace("x", "×")
}

/** One line for confirmations and accessible names: `5×5 Standard board`. */
export function describeBoard(
  facts: Pick<TemplateSummary, "rows" | "columns" | "bingoType"> | null
): string {
  if (!facts) return "board"
  return `${formatBoardSize(facts.rows, facts.columns)} ${BINGO_TYPE_LABELS[facts.bingoType]} board`
}
