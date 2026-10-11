import type { GoalTreeNode } from "@/app/actions/goal-groups"
import type { OsrsItem } from "@/types/osrs-items"
import { flattenGoalTree, resolveItemId } from "@/components/goals/utils"

const now = new Date("2026-01-01T00:00:00Z")

function goal(id: string): GoalTreeNode {
  return {
    type: "goal",
    id,
    data: {
      id,
      tileId: "t1",
      parentGroupId: null,
      description: id,
      targetValue: 1,
      orderIndex: 0,
    },
  }
}

function group(
  id: string,
  logicalOperator: "AND" | "OR" | "SUM",
  children: GoalTreeNode[]
): GoalTreeNode {
  return {
    type: "group",
    id,
    data: {
      id,
      tileId: "t1",
      parentGroupId: null,
      name: id,
      logicalOperator,
      minRequiredGoals: 1,
      orderIndex: 0,
      createdAt: now,
      updatedAt: now,
    },
    children,
  }
}

describe("flattenGoalTree", () => {
  const tree = [
    group("g1", "OR", [goal("a"), group("g2", "SUM", [goal("b")])]),
    goal("c"),
  ]

  it("skips the children of collapsed groups", () => {
    const flat = flattenGoalTree(tree, new Set())

    expect(flat.map((n) => n.id)).toEqual(["g1", "c"])
  })

  it("lists children right after their expanded group with depth, parent and order", () => {
    const flat = flattenGoalTree(tree, new Set(["g1", "g2"]))

    expect(flat.map((n) => n.id)).toEqual(["g1", "a", "g2", "b", "c"])
    expect(
      flat.map((n) => [n.id, n.depth, n.parentId, n.orderIndex])
    ).toEqual([
      ["g1", 0, null, 0],
      ["a", 1, "g1", 0],
      ["g2", 1, "g1", 1],
      ["b", 2, "g2", 0],
      ["c", 0, null, 1],
    ])
  })

  it("passes the enclosing group's operator to its children", () => {
    const flat = flattenGoalTree(tree, new Set(["g1", "g2"]))

    expect(flat.map((n) => [n.id, n.parentOperator])).toEqual([
      ["g1", undefined],
      ["a", "OR"],
      ["g2", "OR"],
      ["b", "SUM"],
      ["c", undefined],
    ])
  })

  it("keeps the node type and data", () => {
    const flat = flattenGoalTree(tree, new Set())

    expect(flat[0]).toMatchObject({ type: "group", data: { name: "g1" } })
    expect(flat[1]).toMatchObject({ type: "goal", data: { description: "c" } })
  })
})

describe("resolveItemId", () => {
  it("returns a single id as is", () => {
    expect(resolveItemId({ id: 4151 } as OsrsItem)).toBe(4151)
  })

  it("uses the first id of a variant list", () => {
    expect(resolveItemId({ id: [11802, 11804] } as unknown as OsrsItem)).toBe(
      11802
    )
  })
})
