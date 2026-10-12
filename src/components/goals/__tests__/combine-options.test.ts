import {
  atLeastError,
  clampAtLeast,
  combineAddLabel,
  INITIAL_COMBINE,
  planCombine,
  type CombineState,
} from "@/components/goals/combine-options"

const state = (mode: CombineState["mode"], atLeast = "2"): CombineState => ({
  mode,
  atLeast,
})

describe("INITIAL_COMBINE", () => {
  it("starts with separate goals, which needs no extra click", () => {
    expect(INITIAL_COMBINE.mode).toBe("separate")
  })
})

describe("planCombine", () => {
  it("adds separate goals without a group", () => {
    expect(planCombine(state("separate"), 3)).toEqual({
      rule: { kind: "separate" },
      group: undefined,
      error: null,
    })
  })

  it("wraps all of them in an AND group", () => {
    expect(planCombine(state("all"), 3)).toEqual({
      rule: { kind: "all" },
      group: { operator: "AND" },
      error: null,
    })
  })

  it("wraps any one of them in an OR group that needs 1", () => {
    expect(planCombine(state("any"), 3)).toEqual({
      rule: { kind: "any", min: 1 },
      group: { operator: "OR", minRequiredGoals: 1 },
      error: null,
    })
  })

  it("wraps at least N in an OR group that needs N", () => {
    expect(planCombine(state("atLeast", "2"), 3)).toEqual({
      rule: { kind: "any", min: 2 },
      group: { operator: "OR", minRequiredGoals: 2 },
      error: null,
    })
  })

  it("accepts N from 1 up to the number of items", () => {
    expect(planCombine(state("atLeast", "1"), 3).error).toBeNull()
    expect(planCombine(state("atLeast", "3"), 3).error).toBeNull()
  })

  it.each([["0"], ["4"], [""], ["abc"], ["1.5"], ["-1"], ["2k"]])(
    "rejects N = %j for 3 items",
    (raw) => {
      const plan = planCombine(state("atLeast", raw), 3)
      expect(plan.error).toBe("Enter a number from 1 to 3")
      expect(plan.group).toBeUndefined()
    }
  )

  it("reads N with surrounding spaces", () => {
    expect(planCombine(state("atLeast", " 2 "), 3).group).toEqual({
      operator: "OR",
      minRequiredGoals: 2,
    })
  })

  it.each([0, 1])("ignores the choice for %d items", (count) => {
    for (const mode of ["all", "any", "atLeast"] as const) {
      expect(planCombine(state(mode, "9"), count)).toEqual({
        rule: { kind: "separate" },
        group: undefined,
        error: null,
      })
    }
  })

  it("names the valid range in the error", () => {
    expect(atLeastError(7)).toBe("Enter a number from 1 to 7")
  })
})

describe("combineAddLabel", () => {
  it("counts separate goals", () => {
    const plan = planCombine(state("separate"), 3)
    expect(combineAddLabel(plan, 0)).toBe("Add goals")
    expect(combineAddLabel(plan, 1)).toBe("Add 1 goal")
    expect(combineAddLabel(plan, 3)).toBe("Add 3 goals")
  })

  it("names the group", () => {
    expect(combineAddLabel(planCombine(state("all"), 3), 3)).toBe(
      "Add group: all 3"
    )
    expect(combineAddLabel(planCombine(state("any"), 3), 3)).toBe(
      "Add group: any 1 of 3"
    )
    expect(combineAddLabel(planCombine(state("atLeast", "2"), 5), 5)).toBe(
      "Add group: any 2 of 5"
    )
  })

  it("does not name a group with an invalid N", () => {
    expect(combineAddLabel(planCombine(state("atLeast", "9"), 3), 3)).toBe(
      "Add group"
    )
  })
})

describe("clampAtLeast", () => {
  it("lowers N to the number of items left", () => {
    expect(clampAtLeast("5", 3)).toBe("3")
    expect(clampAtLeast("4", 2)).toBe("2")
  })

  it("leaves a valid N alone", () => {
    expect(clampAtLeast("2", 3)).toBe("2")
    expect(clampAtLeast("3", 3)).toBe("3")
  })

  it("leaves text that is not a number for the user to fix", () => {
    expect(clampAtLeast("", 3)).toBe("")
    expect(clampAtLeast("abc", 3)).toBe("abc")
    expect(clampAtLeast("0", 3)).toBe("0")
  })

  it("does not touch N while the choice is hidden", () => {
    expect(clampAtLeast("2", 1)).toBe("2")
    expect(clampAtLeast("5", 0)).toBe("5")
  })
})
