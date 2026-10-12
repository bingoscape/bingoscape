/**
 * @jest-environment node
 */
import type { GoalTreeNode } from "@/app/actions/goal-groups"
import {
  buildGoalChip,
  buildTreeChips,
  countGoalTree,
  describeBatchConfirmation,
  describeBatchResult,
  describeGroupChip,
  describeGroupRule,
  formatGoalCounts,
  getSetupTiles,
  idsBetween,
  matchesTileQuery,
  mergeIds,
  pluralize,
  pruneSelection,
  tilePosition,
  updateSelection,
} from "@/lib/goal-setup"

const NOW = new Date("2026-01-01T00:00:00Z")

const goalNode = (
  id: string,
  data: Record<string, unknown> = {}
): GoalTreeNode => ({
  type: "goal",
  id,
  data: {
    id,
    tileId: "t1",
    parentGroupId: null,
    description: "Do the thing",
    targetValue: 1,
    goalType: "generic",
    orderIndex: 0,
    ...data,
  } as GoalTreeNode["data"],
})

const groupNode = (
  id: string,
  logicalOperator: "AND" | "OR" | "SUM",
  minRequiredGoals: number,
  children: GoalTreeNode[]
): GoalTreeNode => ({
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
    createdAt: NOW,
    updatedAt: NOW,
  },
  children,
})

describe("tilePosition", () => {
  it("counts from 1", () => {
    expect(tilePosition({ index: 0 })).toBe(1)
    expect(tilePosition({ index: 24 })).toBe(25)
  })
})

describe("getSetupTiles", () => {
  it("lists visible tiles in board order and counts the hidden ones", () => {
    const tiles = [
      { id: "c", index: 2, isHidden: false },
      { id: "a", index: 0, isHidden: false },
      { id: "h", index: 1, isHidden: true },
    ]
    const { rows, hiddenCount } = getSetupTiles(tiles)
    expect(rows.map((t) => t.id)).toEqual(["a", "c"])
    expect(hiddenCount).toBe(1)
  })

  it("does not change the input order", () => {
    const tiles = [
      { id: "b", index: 1, isHidden: false },
      { id: "a", index: 0, isHidden: false },
    ]
    getSetupTiles(tiles)
    expect(tiles.map((t) => t.id)).toEqual(["b", "a"])
  })

  it("handles an empty board", () => {
    expect(getSetupTiles([])).toEqual({ rows: [], hiddenCount: 0 })
  })
})

describe("matchesTileQuery", () => {
  const tile = { index: 6, title: "Fire cape" }

  it("matches everything for an empty query", () => {
    expect(matchesTileQuery(tile, "")).toBe(true)
    expect(matchesTileQuery(tile, "   ")).toBe(true)
  })

  it("matches part of the title in any case", () => {
    expect(matchesTileQuery(tile, "fire")).toBe(true)
    expect(matchesTileQuery(tile, "CAPE")).toBe(true)
    expect(matchesTileQuery(tile, "  re ca ")).toBe(true)
    expect(matchesTileQuery(tile, "zulrah")).toBe(false)
  })

  it("matches the 1-based position", () => {
    expect(matchesTileQuery(tile, "7")).toBe(true)
    expect(matchesTileQuery(tile, "#7")).toBe(true)
    expect(matchesTileQuery(tile, "6")).toBe(false)
  })

  it("lets a number match titles that contain it", () => {
    expect(matchesTileQuery({ index: 2, title: "99 Slayer" }, "99")).toBe(true)
  })

  it("does not treat a partial number as a position", () => {
    expect(matchesTileQuery({ index: 11, title: "Nex" }, "1")).toBe(false)
  })
})

describe("idsBetween", () => {
  const ids = ["a", "b", "c", "d", "e"]

  it("returns the range in list order, both ends included", () => {
    expect(idsBetween(ids, "b", "d")).toEqual(["b", "c", "d"])
  })

  it("works backwards", () => {
    expect(idsBetween(ids, "d", "b")).toEqual(["b", "c", "d"])
  })

  it("returns one id when anchor and target are the same", () => {
    expect(idsBetween(ids, "c", "c")).toEqual(["c"])
  })

  it("falls back to the target when the anchor is not listed", () => {
    expect(idsBetween(ids, "gone", "c")).toEqual(["c"])
    expect(idsBetween(ids, "a", "gone")).toEqual(["gone"])
  })
})

describe("updateSelection", () => {
  const ids = ["a", "b", "c", "d", "e"]

  it("selects and deselects a single tile", () => {
    const one = updateSelection(new Set(), ids, "b", true, null)
    expect([...one]).toEqual(["b"])
    const none = updateSelection(one, ids, "b", false, null)
    expect([...none]).toEqual([])
  })

  it("selects the whole range with an anchor", () => {
    const next = updateSelection(new Set(["a"]), ids, "d", true, "a")
    expect([...next].sort()).toEqual(["a", "b", "c", "d"])
  })

  it("keeps what was selected outside the range", () => {
    const next = updateSelection(new Set(["e"]), ids, "c", true, "a")
    expect([...next].sort()).toEqual(["a", "b", "c", "e"])
  })

  it("deselects a range", () => {
    const next = updateSelection(new Set(ids), ids, "d", false, "b")
    expect([...next].sort()).toEqual(["a", "e"])
  })

  it("does not change the given set", () => {
    const selected = new Set(["a"])
    updateSelection(selected, ids, "c", true, "a")
    expect([...selected]).toEqual(["a"])
  })
})

describe("pruneSelection", () => {
  it("drops ids that are no longer listed", () => {
    const next = pruneSelection(new Set(["a", "b"]), new Set(["b", "c"]))
    expect([...next]).toEqual(["b"])
  })

  it("returns the same set when nothing was dropped", () => {
    const selected = new Set(["a"])
    expect(pruneSelection(selected, new Set(["a", "b"]))).toBe(selected)
  })
})

describe("mergeIds", () => {
  it("adds new ids", () => {
    expect([...mergeIds(new Set(["a"]), ["b", "c"])].sort()).toEqual([
      "a",
      "b",
      "c",
    ])
  })

  it("returns the same set when there is nothing new", () => {
    const current = new Set(["a", "b"])
    expect(mergeIds(current, ["a", "b"])).toBe(current)
    expect(mergeIds(current, [])).toBe(current)
  })
})

describe("countGoalTree", () => {
  it("counts goals and groups at every depth", () => {
    const tree = [
      goalNode("a"),
      groupNode("g1", "AND", 1, [
        goalNode("b"),
        groupNode("g2", "OR", 2, [goalNode("c"), goalNode("d")]),
      ]),
    ]
    expect(countGoalTree(tree)).toEqual({ goals: 4, groups: 2 })
  })

  it("counts an empty tree and an empty group", () => {
    expect(countGoalTree([])).toEqual({ goals: 0, groups: 0 })
    expect(countGoalTree([groupNode("g", "AND", 1, [])])).toEqual({
      goals: 0,
      groups: 1,
    })
  })
})

describe("buildGoalChip", () => {
  it("shows an item with its image and quantity", () => {
    expect(
      buildGoalChip({
        key: "k",
        goalType: "item",
        description: "Dragon dagger#(p)",
        targetValue: 2,
        itemImageUrl: "/dagger.png",
      })
    ).toEqual({
      key: "k",
      kind: "item",
      label: "Dragon dagger (p)",
      target: "x2",
      imageUrl: "/dagger.png",
      pending: undefined,
    })
  })

  it("shows a skill with its XP target", () => {
    const chip = buildGoalChip({
      key: "k",
      goalType: "metric",
      description: "Slayer",
      targetValue: 13_034_431,
      metricType: "skill",
      metricName: "slayer",
    })
    expect(chip).toMatchObject({
      kind: "metric",
      label: "Slayer",
      target: "13,034,431 XP",
    })
  })

  it("shows a boss with kills, singular for one", () => {
    const many = buildGoalChip({
      key: "k",
      goalType: "metric",
      description: "x",
      targetValue: 50,
      metricType: "boss",
      metricName: "zulrah",
    })
    expect(many).toMatchObject({ label: "Zulrah", target: "50 kills" })
    const one = buildGoalChip({
      key: "k",
      goalType: "metric",
      description: "x",
      targetValue: 1,
      metricType: "boss",
      metricName: "zulrah",
    })
    expect(one.target).toBe("1 kill")
  })

  it("shows a task with its count", () => {
    expect(
      buildGoalChip({
        key: "k",
        goalType: "generic",
        description: "Complete 5 raids",
        targetValue: 5,
      })
    ).toMatchObject({ kind: "task", label: "Complete 5 raids", target: "x5" })
  })

  it("falls back to a task when a metric goal has no metric details", () => {
    expect(
      buildGoalChip({
        key: "k",
        goalType: "metric",
        description: "Odd one",
        targetValue: 1,
      })
    ).toMatchObject({ kind: "task", label: "Odd one" })
  })

  it("marks a pending goal", () => {
    expect(
      buildGoalChip({
        key: "k",
        description: "x",
        targetValue: 1,
        pending: true,
      }).pending
    ).toBe(true)
  })
})

describe("describeGroupChip", () => {
  it.each([
    [{ logicalOperator: "AND", minRequiredGoals: 1 }, 3, "All of 3"],
    [{ logicalOperator: "OR", minRequiredGoals: 2 }, 4, "Any 2 of 4"],
    [
      { logicalOperator: "SUM", minRequiredGoals: 1000 },
      2,
      "Total 1,000 across 2",
    ],
    [{ logicalOperator: "OR", minRequiredGoals: 0 }, 2, "Any 1 of 2"],
  ])("describes %j with %d goals", (group, count, expected) => {
    expect(describeGroupChip(group, count)).toBe(expected)
  })
})

describe("describeGroupRule", () => {
  it.each([
    [{ logicalOperator: "AND", minRequiredGoals: 1 }, "All of"],
    [{ logicalOperator: "OR", minRequiredGoals: 2 }, "Any 2 of"],
    [{ logicalOperator: "OR" }, "Any 1 of"],
    [
      { logicalOperator: "SUM", minRequiredGoals: 1_000_000 },
      "A combined total of 1,000,000 across",
    ],
  ])("describes %j", (group, expected) => {
    expect(describeGroupRule(group)).toBe(expected)
  })
})

describe("buildTreeChips", () => {
  it("makes one chip per top-level node, counting the goals inside groups", () => {
    const chips = buildTreeChips([
      goalNode("a", {
        goalType: "item",
        description: "Abyssal whip",
        itemGoal: { imageUrl: "/whip.png" },
      }),
      groupNode("g", "OR", 1, [
        goalNode("b"),
        groupNode("g2", "AND", 1, [goalNode("c")]),
      ]),
    ])

    expect(chips).toHaveLength(2)
    expect(chips[0]).toMatchObject({
      key: "a",
      kind: "item",
      label: "Abyssal whip",
      imageUrl: "/whip.png",
    })
    expect(chips[1]).toEqual({
      key: "g",
      kind: "group",
      label: "Any 1 of 2",
      target: null,
    })
  })

  it("returns nothing for an empty tree", () => {
    expect(buildTreeChips([])).toEqual([])
  })
})

describe("pluralize and formatGoalCounts", () => {
  it("uses the singular for exactly one", () => {
    expect(pluralize(1, "goal")).toBe("1 goal")
    expect(pluralize(0, "goal")).toBe("0 goals")
    expect(pluralize(2, "goal")).toBe("2 goals")
    expect(pluralize(2, "new goal")).toBe("2 new goals")
  })

  it("mentions groups only when there are some", () => {
    expect(formatGoalCounts(3, 0)).toBe("3 goals")
    expect(formatGoalCounts(4, 2)).toBe("4 goals and 2 groups")
    expect(formatGoalCounts(1, 1)).toBe("1 goal and 1 group")
  })
})

describe("describeBatchConfirmation", () => {
  it("states what is added to how many tiles", () => {
    const { headline } = describeBatchConfirmation(
      { kind: "goals", goalLabels: ["Abyssal whip x1", "Zulrah: 50 kills"] },
      5,
      0
    )
    expect(headline).toBe(
      "Add 2 goals to each of 5 tiles (10 new goals in total)."
    )
  })

  it("keeps it short for one goal on one tile", () => {
    const { headline } = describeBatchConfirmation(
      { kind: "goals", goalLabels: ["Abyssal whip x1"] },
      1,
      0
    )
    expect(headline).toBe("Add 1 goal to 1 tile.")
  })

  it("describes a copy with groups and totals", () => {
    const { headline } = describeBatchConfirmation(
      { kind: "copy", sourceLabel: "Fire cape (tile 3)", goals: 4, groups: 2 },
      5,
      0
    )
    expect(headline).toBe(
      "Copy the goals of Fire cape (tile 3) to each of 5 tiles: 4 goals and 2 groups per tile (20 goals and 10 groups in total)."
    )
  })

  it("describes a copy to a single tile without totals", () => {
    const { headline } = describeBatchConfirmation(
      { kind: "copy", sourceLabel: "Nex (tile 12)", goals: 3, groups: 0 },
      1,
      1
    )
    expect(headline).toBe("Copy the goals of Nex (tile 12) to 1 tile: 3 goals.")
  })

  it("says tiles without goals are empty", () => {
    expect(
      describeBatchConfirmation({ kind: "goals", goalLabels: ["a"] }, 3, 0).note
    ).toBe("None of these tiles has goals yet.")
    expect(
      describeBatchConfirmation({ kind: "goals", goalLabels: ["a"] }, 1, 0).note
    ).toBe("This tile has no goals yet.")
  })

  it("says existing goals are kept, never replaced", () => {
    const some = describeBatchConfirmation(
      { kind: "goals", goalLabels: ["a"] },
      5,
      2
    ).note
    expect(some).toBe(
      "2 of these tiles already have goals. They keep them; the new goals are added after them. Nothing is replaced or removed."
    )
    const single = describeBatchConfirmation(
      { kind: "goals", goalLabels: ["a"] },
      3,
      1
    ).note
    expect(single).toMatch(/^1 of these tiles already has goals\./)
    const all = describeBatchConfirmation(
      { kind: "goals", goalLabels: ["a"] },
      3,
      3
    ).note
    expect(all).toMatch(/^All of these tiles already have goals\./)
    const one = describeBatchConfirmation(
      { kind: "goals", goalLabels: ["a"] },
      1,
      1
    ).note
    expect(one).toMatch(/^This tile already has goals\./)
  })
})

describe("describeBatchResult", () => {
  it("reports goals and tiles", () => {
    expect(
      describeBatchResult({
        tilesUpdated: 5,
        goalsCreated: 10,
        groupsCreated: 0,
      })
    ).toBe("Created 10 goals on 5 tiles.")
  })

  it("uses the singular", () => {
    expect(
      describeBatchResult({
        tilesUpdated: 1,
        goalsCreated: 1,
        groupsCreated: 0,
      })
    ).toBe("Created 1 goal on 1 tile.")
  })

  it("mentions groups of a copied tree", () => {
    expect(
      describeBatchResult({
        tilesUpdated: 2,
        goalsCreated: 8,
        groupsCreated: 4,
      })
    ).toBe("Created 8 goals and 4 groups on 2 tiles.")
  })
})
