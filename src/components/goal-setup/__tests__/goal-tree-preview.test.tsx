import { render, screen, within } from "@testing-library/react"
import type { GoalTreeNode } from "@/app/actions/goal-groups"
import { GoalTreePreview } from "@/components/goal-setup/goal-tree-preview"
import { buildGoalTree } from "@/lib/goal-tree"
import { makeGoal, makeGroup } from "./fixtures"

function treeOf(
  goals: ReturnType<typeof makeGoal>[],
  groups: ReturnType<typeof makeGroup>[]
): GoalTreeNode[] {
  return buildGoalTree(goals as never, groups as never)
}

describe("GoalTreePreview", () => {
  it("is a labelled group", () => {
    render(
      <GoalTreePreview
        tree={treeOf([makeGoal({ id: "a", tileId: "t" })], [])}
        label="Goals that will be copied from Zulrah"
      />
    )
    expect(
      screen.getByRole("group", {
        name: "Goals that will be copied from Zulrah",
      })
    ).toBeInTheDocument()
  })

  it("shows top-level goals with their targets", () => {
    render(
      <GoalTreePreview
        tree={treeOf(
          [
            makeGoal({
              id: "a",
              tileId: "t",
              description: "Complete 5 raids",
              targetValue: 5,
            }),
            makeGoal({
              id: "b",
              tileId: "t",
              kind: "metric",
              description: "Slayer",
              targetValue: 13_034_431,
              orderIndex: 1,
              metric: { metricType: "skill", metricName: "slayer" },
            }),
          ],
          []
        )}
        label="Preview"
      />
    )
    expect(screen.getByText("Complete 5 raids")).toBeInTheDocument()
    expect(screen.getByText("x5")).toBeInTheDocument()
    expect(screen.getByText("Slayer")).toBeInTheDocument()
    expect(screen.getByText("13,034,431 XP")).toBeInTheDocument()
  })

  it("shows nested groups with their operator and minimum count", () => {
    render(
      <GoalTreePreview
        tree={treeOf(
          [
            makeGoal({
              id: "a",
              tileId: "t",
              description: "Whip",
              kind: "item",
              parentGroupId: "inner",
            }),
            makeGoal({
              id: "b",
              tileId: "t",
              description: "Tentacle",
              kind: "item",
              parentGroupId: "inner",
              orderIndex: 1,
            }),
            makeGoal({
              id: "c",
              tileId: "t",
              description: "Do a raid",
              parentGroupId: "outer",
              orderIndex: 1,
            }),
          ],
          [
            makeGroup("outer", "t", "AND", 1),
            makeGroup("inner", "t", "OR", 2, "outer"),
          ]
        )}
        label="Preview"
      />
    )

    const preview = within(screen.getByRole("group", { name: "Preview" }))
    expect(preview.getByText("All of:")).toBeInTheDocument()
    expect(preview.getByText("Any 2 of:")).toBeInTheDocument()
    // The inner group sits inside the outer one, and holds its two goals.
    const lists = preview.getAllByRole("list")
    const outerList = lists[0]!
    expect(within(outerList).getByText("Any 2 of:")).toBeInTheDocument()
    expect(within(outerList).getByText("Whip")).toBeInTheDocument()
    expect(within(outerList).getByText("Tentacle")).toBeInTheDocument()
    expect(within(outerList).getByText("Do a raid")).toBeInTheDocument()
  })

  it("describes a sum group with its total", () => {
    render(
      <GoalTreePreview
        tree={treeOf(
          [
            makeGoal({
              id: "a",
              tileId: "t",
              description: "Bones",
              parentGroupId: "sum",
            }),
          ],
          [makeGroup("sum", "t", "SUM", 1000)]
        )}
        label="Preview"
      />
    )
    expect(
      screen.getByText("A combined total of 1,000 across:")
    ).toBeInTheDocument()
  })

  it("says an empty group never completes", () => {
    render(
      <GoalTreePreview
        tree={treeOf([], [makeGroup("g", "t", "OR", 1)])}
        label="Preview"
      />
    )
    expect(
      screen.getByText("An empty group (never completes)")
    ).toBeInTheDocument()
  })
})
