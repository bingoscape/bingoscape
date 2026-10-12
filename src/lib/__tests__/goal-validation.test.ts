import {
  MAX_BATCH_TILES,
  MAX_BATCH_TOTAL_ROWS,
  MAX_GOAL_TARGET,
  validateBatchSize,
  validateDescription,
  validateTargetValue,
} from "@/lib/goal-validation"

describe("validateTargetValue", () => {
  it.each([1, 500_000, MAX_GOAL_TARGET])("accepts %d", (value) => {
    expect(validateTargetValue(value)).toBeNull()
  })

  it.each([
    0,
    -5,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    MAX_GOAL_TARGET + 1,
  ])("rejects %p", (value) => {
    expect(validateTargetValue(value)).toEqual(expect.any(String))
  })

  it("rejects non-numbers", () => {
    expect(validateTargetValue("5")).toEqual(expect.any(String))
    expect(validateTargetValue(undefined)).toEqual(expect.any(String))
  })
})

describe("validateDescription", () => {
  it("accepts a non-empty description", () => {
    expect(validateDescription("Kill Zulrah")).toBeNull()
  })

  it.each(["", "   ", undefined, null])("rejects %p", (value) => {
    expect(validateDescription(value)).toBe("Description cannot be empty")
  })
})

describe("validateBatchSize", () => {
  it("accepts a batch within the limits", () => {
    expect(validateBatchSize(1, 1)).toBeNull()
    expect(validateBatchSize(25, 2)).toBeNull()
  })

  it("accepts exactly the limits", () => {
    expect(validateBatchSize(MAX_BATCH_TILES, 5)).toBeNull()
    expect(validateBatchSize(10, MAX_BATCH_TOTAL_ROWS / 10)).toBeNull()
  })

  it("rejects an empty selection", () => {
    expect(validateBatchSize(0, 1)).toBe("Select at least one tile")
  })

  it("rejects too many tiles", () => {
    expect(validateBatchSize(MAX_BATCH_TILES + 1, 1)).toBe(
      "You can change at most 100 tiles at once"
    )
  })

  it("rejects too many goals in total and says how many", () => {
    const error = validateBatchSize(60, 9)
    expect(error).toContain("540")
    expect(error).toContain(`limit is ${MAX_BATCH_TOTAL_ROWS}`)
  })

  it("only checks the tile count when there are no rows yet", () => {
    expect(validateBatchSize(50, 0)).toBeNull()
  })
})
