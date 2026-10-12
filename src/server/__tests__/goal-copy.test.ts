/**
 * @jest-environment node
 */
import {
  buildCopyPlan,
  type SourceGoal,
  type SourceGroup,
} from "@/server/goal-copy"

const group = (over: Partial<SourceGroup> = {}): SourceGroup => ({
  id: "g1",
  parentGroupId: null,
  name: null,
  logicalOperator: "AND",
  minRequiredGoals: 1,
  orderIndex: 0,
  ...over,
})

const goal = (over: Partial<SourceGoal> = {}): SourceGoal => ({
  id: "a",
  parentGroupId: null,
  description: "Do the thing",
  targetValue: 1,
  goalType: "generic",
  orderIndex: 0,
  ...over,
})

describe("buildCopyPlan", () => {
  it("fails for a tile without goals or groups", () => {
    expect(buildCopyPlan([], [])).toEqual({
      ok: false,
      error: "The source tile has no goals to copy",
    })
  })

  it("plans a single generic goal", () => {
    const result = buildCopyPlan([], [goal({ targetValue: 5 })])
    expect(result).toEqual({
      ok: true,
      plan: {
        goalCount: 1,
        groupCount: 0,
        nodes: [
          {
            kind: "goal",
            input: {
              type: "generic",
              description: "Do the thing",
              targetValue: 5,
            },
          },
        ],
      },
    })
  })

  it("plans item goals with their item details and exact variant", () => {
    const result = buildCopyPlan(
      [],
      [
        goal({
          description: "Dragon dagger#(p)",
          goalType: "item",
          itemGoal: {
            itemId: 1231,
            baseName: "Dragon dagger",
            exactVariant: "(p)",
            imageUrl: "/dagger.png",
          },
        }),
      ]
    )
    expect(result.ok && result.plan.nodes[0]).toEqual({
      kind: "goal",
      input: {
        type: "item",
        itemId: 1231,
        itemName: "Dragon dagger#(p)",
        baseName: "Dragon dagger",
        imageUrl: "/dagger.png",
        targetValue: 1,
        exactVariant: "(p)",
      },
    })
  })

  it("plans metric goals with their metric and description", () => {
    const result = buildCopyPlan(
      [],
      [
        goal({
          description: "Zulrah",
          targetValue: 50,
          goalType: "metric",
          metricGoal: { metricType: "boss", metricName: "zulrah" },
        }),
      ]
    )
    expect(result.ok && result.plan.nodes[0]).toEqual({
      kind: "goal",
      input: {
        type: "metric",
        metricType: "boss",
        metricName: "zulrah",
        targetValue: 50,
        description: "Zulrah",
      },
    })
  })

  it("keeps nested groups with operator, minimum and name", () => {
    const result = buildCopyPlan(
      [
        group({ id: "outer", name: "Raids" }),
        group({
          id: "inner",
          parentGroupId: "outer",
          logicalOperator: "OR",
          minRequiredGoals: 2,
        }),
        group({
          id: "sum",
          parentGroupId: "inner",
          logicalOperator: "SUM",
          minRequiredGoals: 1000,
        }),
      ],
      [
        goal({ id: "a", parentGroupId: "inner", description: "A" }),
        goal({ id: "b", parentGroupId: "sum", description: "B" }),
      ]
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan).toMatchObject({ goalCount: 2, groupCount: 3 })
    const [outer] = result.plan.nodes
    expect(outer).toMatchObject({
      kind: "group",
      name: "Raids",
      operator: "AND",
      minRequiredGoals: 1,
    })
    const inner = outer?.kind === "group" ? outer.children[0] : undefined
    expect(inner).toMatchObject({
      kind: "group",
      operator: "OR",
      minRequiredGoals: 2,
    })
    const children = inner?.kind === "group" ? inner.children : []
    expect(children.map((c) => c.kind)).toEqual(["group", "goal"])
    expect(children[0]).toMatchObject({
      kind: "group",
      operator: "SUM",
      minRequiredGoals: 1000,
    })
  })

  it("orders siblings by order index, with groups before goals on a tie", () => {
    const result = buildCopyPlan(
      [group({ id: "g", orderIndex: 1 })],
      [
        goal({ id: "z", description: "Late", orderIndex: 3 }),
        goal({ id: "y", description: "Tie", orderIndex: 1 }),
        goal({ id: "x", description: "Early", orderIndex: 0 }),
      ]
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(
      result.plan.nodes.map((n) =>
        n.kind === "group"
          ? "group"
          : (n.input as { description: string }).description
      )
    ).toEqual(["Early", "group", "Tie", "Late"])
  })

  it("keeps an empty group", () => {
    const result = buildCopyPlan([group({ logicalOperator: "OR" })], [])
    expect(result.ok && result.plan).toMatchObject({
      goalCount: 0,
      groupCount: 1,
    })
  })

  it("leaves out groups that cannot be reached from the top level", () => {
    // A cycle: neither group hangs off the top level.
    const result = buildCopyPlan(
      [
        group({ id: "a", parentGroupId: "b" }),
        group({ id: "b", parentGroupId: "a" }),
      ],
      [goal({ id: "x" })]
    )
    expect(result.ok && result.plan).toMatchObject({
      goalCount: 1,
      groupCount: 0,
    })
  })

  it("fails when an item goal has no item details", () => {
    const result = buildCopyPlan(
      [],
      [goal({ goalType: "item", itemGoal: null })]
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/cannot be copied/)
  })

  it("fails when a metric goal has no metric details", () => {
    const result = buildCopyPlan(
      [],
      [goal({ goalType: "metric", metricGoal: undefined })]
    )
    expect(result.ok).toBe(false)
  })

  it("fails, without a partial plan, when one goal is invalid", () => {
    const result = buildCopyPlan(
      [],
      [goal({ id: "ok" }), goal({ id: "bad", targetValue: 0, orderIndex: 1 })]
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe(
        "The source tile has a goal that cannot be copied: Target value must be greater than 0"
      )
    }
  })
})
