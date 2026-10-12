import type { GoalTreeNode } from "@/app/actions/goal-groups"
import {
  describeNewGoals,
  formatNewGroupRule,
  summarizeGoalCompletion,
} from "@/lib/goal-summary"

const now = new Date("2026-01-01T00:00:00Z")

interface GoalOptions {
  goalType?: "generic" | "item" | "metric"
  metricGoal?: { metricType: string; metricName: string } | null
}

function goal(
  id: string,
  description: string,
  { goalType, metricGoal }: GoalOptions = {}
): GoalTreeNode {
  return {
    type: "goal",
    id,
    data: {
      id,
      tileId: "t1",
      parentGroupId: null,
      description,
      targetValue: 5,
      goalType,
      orderIndex: 0,
      metricGoal,
    } as GoalTreeNode["data"],
  }
}

const task = (description: string) => goal(description, description)
const item = (name: string) => goal(name, name, { goalType: "item" })
const skill = (metricName: string) =>
  goal(metricName, metricName, {
    goalType: "metric",
    metricGoal: { metricType: "skill", metricName },
  })
const boss = (metricName: string) =>
  goal(metricName, metricName, {
    goalType: "metric",
    metricGoal: { metricType: "boss", metricName },
  })
const activity = (metricName: string) =>
  goal(metricName, metricName, {
    goalType: "metric",
    metricGoal: { metricType: "activity", metricName },
  })

let groupCount = 0
function group(
  logicalOperator: "AND" | "OR" | "SUM",
  minRequiredGoals: number,
  children: GoalTreeNode[]
): GoalTreeNode {
  const id = `group-${groupCount++}`
  return {
    type: "group",
    id,
    data: {
      id,
      tileId: "t1",
      parentGroupId: null,
      name: null,
      logicalOperator,
      minRequiredGoals,
      orderIndex: 0,
      createdAt: now,
      updatedAt: now,
    },
    children,
  }
}

describe("summarizeGoalCompletion", () => {
  describe("an empty tree", () => {
    it("has nothing to summarise", () => {
      expect(summarizeGoalCompletion([])).toBeNull()
    })
  })

  describe("a single top-level goal", () => {
    it("names a task by its description", () => {
      expect(summarizeGoalCompletion([task("Do a raid")])).toBe(
        "Complete: Do a raid"
      )
    })

    it("reads an item variant the way players do", () => {
      expect(summarizeGoalCompletion([item("Dragon dagger#(p)")])).toBe(
        "Complete: Dragon dagger (p)"
      )
    })

    it("names skill, boss and activity goals by what they track", () => {
      expect(summarizeGoalCompletion([skill("attack")])).toBe(
        "Complete: Attack XP"
      )
      expect(summarizeGoalCompletion([boss("zulrah")])).toBe(
        "Complete: Zulrah kills"
      )
      expect(summarizeGoalCompletion([activity("clue_scrolls_all")])).toBe(
        "Complete: Clue Scrolls (All)"
      )
    })

    it("treats a goal without a type as a task", () => {
      expect(summarizeGoalCompletion([goal("x", "Mystery")])).toBe(
        "Complete: Mystery"
      )
    })

    it("falls back to the description when a metric goal has no metric loaded", () => {
      expect(
        summarizeGoalCompletion([
          goal("x", "Some metric", { goalType: "metric", metricGoal: null }),
        ])
      ).toBe("Complete: Some metric")
    })

    it("shortens a very long name", () => {
      expect(summarizeGoalCompletion([task("A".repeat(40))])).toBe(
        `Complete: ${"A".repeat(31)}…`
      )
    })
  })

  describe("several top-level nodes", () => {
    it("needs all of them, since the top level is an implicit AND", () => {
      expect(
        summarizeGoalCompletion([item("Abyssal whip"), task("Do a raid")])
      ).toBe("Complete all of: Abyssal whip, Do a raid")
    })

    it("lists up to three members by name", () => {
      expect(
        summarizeGoalCompletion([
          item("Abyssal whip"),
          item("Dragon warhammer"),
          skill("attack"),
        ])
      ).toBe("Complete all of: Abyssal whip, Dragon warhammer, Attack XP")
    })

    it("counts more than three members by kind, items first", () => {
      expect(
        summarizeGoalCompletion([
          task("Do a raid"),
          item("Abyssal whip"),
          skill("attack"),
          item("Dragon warhammer"),
        ])
      ).toBe("Complete all of: 2 items, 1 XP goal, 1 task")
    })

    it("uses the singular and plural noun of each kind", () => {
      expect(
        summarizeGoalCompletion([
          item("a"),
          item("b"),
          item("c"),
          skill("attack"),
          skill("mining"),
        ])
      ).toBe("Complete all of: 3 items, 2 XP goals")
    })

    it("folds kinds beyond the third into +N more", () => {
      expect(
        summarizeGoalCompletion([
          item("a"),
          skill("attack"),
          boss("zulrah"),
          activity("clue_scrolls_all"),
          task("Do a raid"),
        ])
      ).toBe("Complete all of: 1 item, 1 XP goal, 1 kill goal +2 more")
    })

    it("counts groups as groups", () => {
      expect(
        summarizeGoalCompletion([
          item("a"),
          item("b"),
          group("AND", 1, [item("c"), item("d")]),
          group("OR", 1, [item("e"), item("f")]),
        ])
      ).toBe("Complete all of: 2 items, 2 groups")
    })

    it("combines goals and groups at the top level with all of", () => {
      expect(
        summarizeGoalCompletion([
          item("Abyssal whip"),
          group("OR", 1, [boss("zulrah"), boss("vorkath")]),
        ])
      ).toBe(
        "Complete all of: Abyssal whip, any 1 of (Zulrah kills, Vorkath kills)"
      )
    })
  })

  describe("a single top-level group", () => {
    it("describes an OR group by how many of its members are needed", () => {
      expect(
        summarizeGoalCompletion([
          group("OR", 1, [
            item("Abyssal whip"),
            item("Dragon warhammer"),
            boss("zulrah"),
          ]),
        ])
      ).toBe("Complete any 1 of: Abyssal whip, Dragon warhammer, Zulrah kills")
    })

    it("uses the group's minimum of required goals", () => {
      expect(
        summarizeGoalCompletion([
          group("OR", 2, [
            item("a"),
            item("b"),
            item("c"),
            item("d"),
            item("e"),
          ]),
        ])
      ).toBe("Complete any 2 of: 5 items")
    })

    it("reads a minimum of 0 as the default of 1, like the completion check", () => {
      expect(
        summarizeGoalCompletion([group("OR", 0, [item("a"), item("b")])])
      ).toBe("Complete any 1 of: a, b")
    })

    it("describes an AND group as all of its members", () => {
      expect(
        summarizeGoalCompletion([group("AND", 1, [item("a"), item("b")])])
      ).toBe("Complete all of: a, b")
    })

    it("sees through an AND group with a single member", () => {
      expect(summarizeGoalCompletion([group("AND", 1, [item("a")])])).toBe(
        "Complete: a"
      )
    })

    it("describes a SUM group by the combined total it needs", () => {
      expect(
        summarizeGoalCompletion([
          group("SUM", 1_000_000, [skill("mining"), skill("smithing")]),
        ])
      ).toBe(
        "Complete a combined total of 1,000,000 across: Mining XP, Smithing XP"
      )
    })

    it("says that a group without members can never be completed", () => {
      expect(summarizeGoalCompletion([group("AND", 1, [])])).toBe(
        "Complete: an empty group (never completes)"
      )
      expect(
        summarizeGoalCompletion([item("Abyssal whip"), group("OR", 1, [])])
      ).toBe("Complete all of: Abyssal whip, an empty group (never completes)")
    })
  })

  describe("nested groups", () => {
    it("writes a nested group in parentheses after its rule", () => {
      expect(
        summarizeGoalCompletion([
          group("AND", 1, [
            item("Abyssal whip"),
            group("OR", 2, [boss("zulrah"), boss("vorkath")]),
          ]),
        ])
      ).toBe(
        "Complete all of: Abyssal whip, any 2 of (Zulrah kills, Vorkath kills)"
      )
    })

    it("counts the members of a large nested group", () => {
      expect(
        summarizeGoalCompletion([
          group("OR", 1, [
            group("SUM", 50, [item("a"), item("b"), item("c"), item("d")]),
            item("Abyssal whip"),
          ]),
        ])
      ).toBe(
        "Complete any 1 of: a combined total of 50 across (4 items), Abyssal whip"
      )
    })

    it("folds groups nested deeper than two levels into a goal count", () => {
      expect(
        summarizeGoalCompletion([
          group("OR", 1, [
            group("AND", 1, [
              item("Abyssal whip"),
              group("OR", 1, [item("b"), item("c")]),
            ]),
            item("Dragon warhammer"),
          ]),
        ])
      ).toBe(
        "Complete any 1 of: all of (Abyssal whip, a nested group (2 goals)), Dragon warhammer"
      )
    })

    it("uses the singular for a folded group with one goal and counts goals in its subgroups", () => {
      const folded = (children: GoalTreeNode[]) =>
        summarizeGoalCompletion([
          group("OR", 1, [
            group("OR", 1, [item("a"), group("AND", 1, children)]),
            item("z"),
          ]),
        ])

      expect(folded([item("x")])).toBe(
        "Complete any 1 of: any 1 of (a, a nested group (1 goal)), z"
      )
      expect(folded([item("x"), group("OR", 1, [item("y"), item("w")])])).toBe(
        "Complete any 1 of: any 1 of (a, a nested group (3 goals)), z"
      )
    })
  })
})

describe("formatNewGroupRule", () => {
  it("names an AND group by its size", () => {
    expect(formatNewGroupRule({ kind: "all" }, 3)).toBe("all 3")
  })

  it("names an OR group by how many of its members count", () => {
    expect(formatNewGroupRule({ kind: "any", min: 1 }, 3)).toBe("any 1 of 3")
    expect(formatNewGroupRule({ kind: "any", min: 2 }, 5)).toBe("any 2 of 5")
  })
})

describe("describeNewGoals", () => {
  const names = ["Abyssal whip", "Dragon warhammer", "Zulrah kills"]

  it("describes an OR group with a required count", () => {
    expect(describeNewGoals(names, { kind: "any", min: 2 })).toBe(
      "Tile needs any 2 of: Abyssal whip, Dragon warhammer, Zulrah kills"
    )
  })

  it("describes any one of them", () => {
    expect(describeNewGoals(names, { kind: "any", min: 1 })).toBe(
      "Tile needs any 1 of: Abyssal whip, Dragon warhammer, Zulrah kills"
    )
  })

  it("describes an AND group", () => {
    expect(describeNewGoals(names, { kind: "all" })).toBe(
      "Tile needs all of: Abyssal whip, Dragon warhammer, Zulrah kills"
    )
  })

  it("describes separate goals at the top level as all needed", () => {
    expect(describeNewGoals(names, { kind: "separate" })).toBe(
      "Each item is its own goal; the tile needs all of: Abyssal whip, Dragon warhammer, Zulrah kills"
    )
  })

  it("talks about the new group instead of the tile when nested", () => {
    expect(describeNewGoals(names, { kind: "all" }, { nested: true })).toBe(
      "The new group needs all of: Abyssal whip, Dragon warhammer, Zulrah kills"
    )
    expect(
      describeNewGoals(names, { kind: "any", min: 2 }, { nested: true })
    ).toBe(
      "The new group needs any 2 of: Abyssal whip, Dragon warhammer, Zulrah kills"
    )
    expect(
      describeNewGoals(names, { kind: "separate" }, { nested: true })
    ).toBe(
      "Each item is its own goal in the group: Abyssal whip, Dragon warhammer, Zulrah kills"
    )
  })

  it("counts instead of lists more than three names, like the tile summary", () => {
    const many = ["a", "b", "c", "d", "e"]
    expect(describeNewGoals(many, { kind: "any", min: 2 })).toBe(
      "Tile needs any 2 of: 5 items"
    )
    expect(describeNewGoals(many.slice(0, 3), { kind: "all" })).toBe(
      "Tile needs all of: a, b, c"
    )
  })

  it("shortens a very long name", () => {
    const text = describeNewGoals(["x".repeat(60), "y"], { kind: "all" })
    expect(text).toContain("…")
    expect(text.length).toBeLessThan(70)
  })
})
