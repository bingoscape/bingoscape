import getTemplateBoard from "@/lib/getTemplateBoard"
import {
  CURRENT_EXPORT_VERSION,
  parseExportedBingo,
} from "@/lib/bingo-template-schema"

const baseTile = {
  title: "Tile",
  description: "Desc",
  weight: 1,
  index: 0,
  isHidden: false,
}

function board(overrides: Record<string, unknown> = {}) {
  return {
    version: CURRENT_EXPORT_VERSION,
    metadata: {
      title: "Board",
      rows: 2,
      columns: 2,
      bingoType: "standard",
    },
    tiles: [baseTile],
    ...overrides,
  }
}

describe("parseExportedBingo", () => {
  it("upgrades a v1.0 export (no bingoType) to a standard board", () => {
    const result = parseExportedBingo(getTemplateBoard())

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.metadata.bingoType).toBe("standard")
    expect(result.data.tiles).toHaveLength(9)
    expect(result.data.tiles[0]?.tier).toBe(0)
  })

  it("accepts an already-parsed object", () => {
    expect(parseExportedBingo(board()).success).toBe(true)
  })

  it("rejects malformed JSON", () => {
    const result = parseExportedBingo("{not json")
    expect(result).toEqual({
      success: false,
      error: "Template data is not valid JSON",
    })
  })

  it("rejects non-integer weights that would fail the integer column", () => {
    const result = parseExportedBingo(
      board({ tiles: [{ ...baseTile, weight: 1.5 }] })
    )
    expect(result.success).toBe(false)
  })

  it("rejects tiles outside the board and duplicate indexes", () => {
    expect(
      parseExportedBingo(board({ tiles: [{ ...baseTile, index: 4 }] })).success
    ).toBe(false)
    expect(
      parseExportedBingo(board({ tiles: [baseTile, baseTile] })).success
    ).toBe(false)
  })

  it("rejects oversized boards", () => {
    const result = parseExportedBingo(
      board({ metadata: { title: "Big", rows: 11, columns: 2 } })
    )
    expect(result.success).toBe(false)
  })

  it("rejects bonuses outside the board", () => {
    expect(
      parseExportedBingo(board({ rowBonuses: [{ rowIndex: 2, bonusXP: 5 }] }))
        .success
    ).toBe(false)
    expect(
      parseExportedBingo(
        board({ columnBonuses: [{ columnIndex: 2, bonusXP: 5 }] })
      ).success
    ).toBe(false)
  })

  it("rejects goals and groups that reference an unknown group", () => {
    const orphanGoal = {
      ...baseTile,
      goals: [
        { description: "g", targetValue: 1, parentLocalId: "missing" },
      ],
    }
    expect(parseExportedBingo(board({ tiles: [orphanGoal] })).success).toBe(
      false
    )

    const orphanGroup = {
      ...baseTile,
      goalGroups: [
        { localId: "g1", parentLocalId: "missing", logicalOperator: "AND" },
      ],
    }
    expect(parseExportedBingo(board({ tiles: [orphanGroup] })).success).toBe(
      false
    )
  })

  it("accepts nested goal groups with all operators", () => {
    const tile = {
      ...baseTile,
      goalGroups: [
        { localId: "g1", logicalOperator: "OR", minRequiredGoals: 2 },
        { localId: "g2", parentLocalId: "g1", logicalOperator: "SUM" },
      ],
      goals: [
        {
          description: "g",
          targetValue: 1,
          parentLocalId: "g2",
          goalType: "metric",
          metricGoal: { metricType: "skill", metricName: "attack" },
        },
      ],
    }
    expect(parseExportedBingo(board({ tiles: [tile] })).success).toBe(true)
  })

  it("does not require a codephrase", () => {
    const result = parseExportedBingo(board())
    expect(result.success).toBe(true)
  })
})
