import {
  MAX_GOAL_TARGET,
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
