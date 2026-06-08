import {
  describeFleetRules,
  presetsForBoard,
  SHIP_FLEET_PRESETS,
} from "../ship-fleet-presets"

describe("ship-fleet-presets", () => {
  it("describes rules in plain language", () => {
    expect(
      describeFleetRules([
        { length: 3, count: 2 },
        { length: 2, count: 1 },
      ])
    ).toEqual(["2 ships · 3 tiles each", "1 ship · 2 tiles each"])
  })

  it("filters presets that do not fit small boards", () => {
    const presets = presetsForBoard(3, 3)
    expect(presets.map((preset) => preset.id)).not.toContain("classic")
    expect(presets.map((preset) => preset.id)).toContain("small")
  })

  it("includes classic preset on a 5x5 board", () => {
    const presets = presetsForBoard(5, 5)
    expect(presets.map((preset) => preset.id)).toContain("classic")
    expect(presets.length).toBe(SHIP_FLEET_PRESETS.length)
  })
})
