import {
  buildGenericGoalInput,
  buildItemGoalInput,
  buildMetricGoalInput,
  formatAddedGoal,
} from "@/components/goals/goal-inputs"
import { ABYSSAL_WHIP, DRAGON_DAGGER_P } from "./item-fixtures"

describe("buildItemGoalInput", () => {
  it("builds the createGoals input of a plain item", () => {
    expect(buildItemGoalInput(ABYSSAL_WHIP, 3)).toEqual({
      type: "item",
      itemId: 4151,
      itemName: "Abyssal whip",
      baseName: "Abyssal whip",
      imageUrl: "/whip.png",
      targetValue: 3,
      exactVariant: null,
    })
  })

  it("uses the first id of an item with several, and keeps its variant", () => {
    expect(buildItemGoalInput(DRAGON_DAGGER_P, 1)).toEqual({
      type: "item",
      itemId: 1231,
      itemName: "Dragon dagger#(p)",
      baseName: "Dragon dagger",
      imageUrl: "/dagger.png",
      targetValue: 1,
      exactVariant: "(p)",
    })
  })
})

describe("buildGenericGoalInput", () => {
  it("trims the description", () => {
    expect(buildGenericGoalInput("  Do a raid ", 2)).toEqual({
      type: "generic",
      description: "Do a raid",
      targetValue: 2,
    })
  })
})

describe("buildMetricGoalInput", () => {
  it("builds the createGoals input of a skill, boss or activity goal", () => {
    expect(buildMetricGoalInput("skill", "attack", 5_000_000)).toEqual({
      type: "metric",
      metricType: "skill",
      metricName: "attack",
      targetValue: 5_000_000,
    })
  })
})

describe("formatAddedGoal", () => {
  it("reads an item as its name and quantity", () => {
    expect(formatAddedGoal(buildItemGoalInput(ABYSSAL_WHIP, 1))).toBe(
      "Abyssal whip x1"
    )
  })

  it("names a variant the way players read it and separates thousands", () => {
    expect(formatAddedGoal(buildItemGoalInput(DRAGON_DAGGER_P, 1500))).toBe(
      "Dragon dagger (p) x1,500"
    )
  })

  it("reads a task as its description and target", () => {
    expect(formatAddedGoal(buildGenericGoalInput(" Do a raid ", 2))).toBe(
      "Do a raid x2"
    )
  })

  it("reads an XP goal with the unit of its metric", () => {
    expect(
      formatAddedGoal(buildMetricGoalInput("skill", "attack", 5_000_000))
    ).toBe("Attack: 5,000,000 XP")
  })

  it("uses the singular for a target of one", () => {
    expect(formatAddedGoal(buildMetricGoalInput("boss", "zulrah", 1))).toBe(
      "Zulrah: 1 kill"
    )
    expect(formatAddedGoal(buildMetricGoalInput("boss", "zulrah", 50))).toBe(
      "Zulrah: 50 kills"
    )
  })

  it("leaves out the unit of an activity", () => {
    expect(
      formatAddedGoal(buildMetricGoalInput("activity", "clue_scrolls_all", 10))
    ).toBe("Clue Scrolls (All): 10")
  })
})
