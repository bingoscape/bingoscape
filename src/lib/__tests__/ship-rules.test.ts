import {
  aggregateShipRuleCounts,
  mergeShipRulesByLength,
  totalShipTiles,
  validateShipRulesFitBoard,
} from "../ship-rules"

describe("ship-rules", () => {
  it("aggregates counts for duplicate lengths", () => {
    expect(
      aggregateShipRuleCounts([
        { length: 3, count: 2 },
        { length: 3, count: 1 },
        { length: 2, count: 1 },
      ])
    ).toEqual({ 2: 1, 3: 3 })
  })

  it("merges duplicate-length rules into one row per length", () => {
    expect(
      mergeShipRulesByLength([
        { length: 3, count: 2 },
        { length: 2, count: 1 },
        { length: 3, count: 1 },
      ])
    ).toEqual([
      { length: 2, count: 1 },
      { length: 3, count: 3 },
    ])
  })

  it("sums total ship tiles across rules", () => {
    expect(
      totalShipTiles([
        { length: 3, count: 2 },
        { length: 2, count: 1 },
      ])
    ).toBe(8)
  })

  it("accepts rules that fit on the board", () => {
    expect(
      validateShipRulesFitBoard(
        [
          { length: 3, count: 2 },
          { length: 2, count: 1 },
        ],
        5,
        5
      )
    ).toBeNull()
  })

  it("rejects rules that exceed board cell count", () => {
    expect(
      validateShipRulesFitBoard([{ length: 5, count: 6 }], 5, 5)
    ).toMatch(/only has 25/)
  })

  it("rejects ship lengths longer than board dimensions", () => {
    expect(
      validateShipRulesFitBoard([{ length: 6, count: 1 }], 5, 5)
    ).toMatch(/exceeds board dimensions/)
  })
})
