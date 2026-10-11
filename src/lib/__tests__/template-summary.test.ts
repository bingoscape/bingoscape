/**
 * @jest-environment node
 */
import { parseExportedBingo } from "@/lib/bingo-template-schema"
import {
  summarizeStoredTemplate,
  summarizeTemplate,
} from "@/lib/template-summary"

function exported(raw: Record<string, unknown>) {
  const parsed = parseExportedBingo(raw)
  if (!parsed.success) throw new Error(parsed.error)
  return parsed.data
}

const tile = (index: number, extra: Record<string, unknown> = {}) => ({
  title: `Tile ${index}`,
  description: "",
  weight: 10,
  index,
  isHidden: false,
  ...extra,
})

describe("summarizeTemplate", () => {
  it("summarises a plain standard board", () => {
    const summary = summarizeTemplate(
      exported({
        version: "2.0",
        metadata: { title: "T", rows: 2, columns: 2, bingoType: "standard" },
        tiles: [tile(0), tile(1), tile(2), tile(3)],
      })
    )

    expect(summary).toEqual({
      schemaVersion: "2.0",
      bingoType: "standard",
      rows: 2,
      columns: 2,
      tileCount: 4,
      tierCount: 1,
      totalXp: 40,
      hasPatternBonuses: false,
      hasHiddenTiles: false,
    })
  })

  it("adds every pattern bonus to the total XP", () => {
    const summary = summarizeTemplate(
      exported({
        version: "2.0",
        metadata: {
          title: "T",
          rows: 2,
          columns: 2,
          bingoType: "standard",
          mainDiagonalBonusXP: 5,
          antiDiagonalBonusXP: 6,
          completeBoardBonusXP: 7,
        },
        tiles: [tile(0)],
        rowBonuses: [{ rowIndex: 0, bonusXP: 1 }],
        columnBonuses: [{ columnIndex: 1, bonusXP: 2 }],
      })
    )

    expect(summary.totalXp).toBe(10 + 5 + 6 + 7 + 1 + 2)
    expect(summary.hasPatternBonuses).toBe(true)
  })

  it("ignores zero-value bonuses", () => {
    const summary = summarizeTemplate(
      exported({
        version: "2.0",
        metadata: {
          title: "T",
          rows: 2,
          columns: 2,
          bingoType: "standard",
          mainDiagonalBonusXP: 0,
        },
        tiles: [tile(0)],
        rowBonuses: [{ rowIndex: 0, bonusXP: 0 }],
      })
    )

    expect(summary.hasPatternBonuses).toBe(false)
  })

  it("counts distinct tiers and hidden tiles on progression boards", () => {
    const summary = summarizeTemplate(
      exported({
        version: "2.0",
        metadata: { title: "T", rows: 2, columns: 2, bingoType: "progression" },
        tiles: [
          tile(0, { tier: 0 }),
          tile(1, { tier: 0 }),
          tile(2, { tier: 1, isHidden: true }),
          tile(3, { tier: 2 }),
        ],
      })
    )

    expect(summary.bingoType).toBe("progression")
    expect(summary.tierCount).toBe(3)
    expect(summary.hasHiddenTiles).toBe(true)
  })

  it("upgrades v1 exports: no bingoType means standard, tiles default hidden", () => {
    const summary = summarizeTemplate(
      exported({
        version: "1.0",
        metadata: { title: "Old", rows: 1, columns: 1 },
        tiles: [
          {
            title: "A",
            description: "",
            weight: 3,
            index: 0,
          },
        ],
      })
    )

    expect(summary.schemaVersion).toBe("1.0")
    expect(summary.bingoType).toBe("standard")
    expect(summary.totalXp).toBe(3)
  })

  it("handles an empty board", () => {
    const summary = summarizeTemplate(
      exported({
        version: "2.0",
        metadata: { title: "T", rows: 3, columns: 3 },
        tiles: [],
      })
    )

    expect(summary.tileCount).toBe(0)
    expect(summary.tierCount).toBe(0)
    expect(summary.totalXp).toBe(0)
  })
})

describe("summarizeStoredTemplate", () => {
  it("summarises a stored JSON document", () => {
    const result = summarizeStoredTemplate(
      JSON.stringify({
        version: "2.0",
        metadata: { title: "T", rows: 2, columns: 3 },
        tiles: [tile(0)],
      })
    )

    expect(result).toMatchObject({
      success: true,
      summary: { rows: 2, columns: 3, tileCount: 1 },
    })
  })

  it.each(["{nope", "null", JSON.stringify({ version: "2.0" })])(
    "reports unparsable data instead of throwing: %s",
    (raw) => {
      expect(summarizeStoredTemplate(raw)).toMatchObject({ success: false })
    }
  )
})
