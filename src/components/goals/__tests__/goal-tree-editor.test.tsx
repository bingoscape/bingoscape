import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "./dom-polyfills"
import type { GoalTreeNode } from "@/app/actions/goal-groups"
import { GoalTreeEditor } from "@/components/goal-tree-editor"

jest.mock("@/app/actions/goal-groups", () => ({
  createGoalGroup: jest.fn(),
  moveGoalToGroup: jest.fn(),
  moveGroupToGroup: jest.fn(),
  updateGoalGroup: jest.fn(),
  deleteGoalGroup: jest.fn(),
  reorderItems: jest.fn(),
  moveMultipleItems: jest.fn(),
}))
jest.mock("@/app/actions/bingo", () => ({
  addGoal: jest.fn(),
  createGoals: jest.fn(),
  createMetricGoal: jest.fn(),
  updateGoal: jest.fn(),
  updateItemGoal: jest.fn(),
  updateMetricGoal: jest.fn(),
}))
jest.mock("@/app/actions/osrs-items", () => ({ searchOsrsItems: jest.fn() }))

const now = new Date("2026-01-01T00:00:00Z")

const tree: GoalTreeNode[] = [
  {
    type: "group",
    id: "g1",
    data: {
      id: "g1",
      tileId: "t1",
      parentGroupId: null,
      name: "Raids",
      logicalOperator: "AND",
      minRequiredGoals: 1,
      orderIndex: 0,
      createdAt: now,
      updatedAt: now,
    },
    children: [],
  },
  {
    type: "goal",
    id: "goal1",
    data: {
      id: "goal1",
      tileId: "t1",
      parentGroupId: null,
      description: "Kill a boss",
      targetValue: 3,
      goalType: "generic",
      orderIndex: 0,
    },
  },
]

function renderEditor(
  props: Partial<React.ComponentProps<typeof GoalTreeEditor>> = {}
) {
  const onDeleteGoal = jest.fn()
  const onRefresh = jest.fn()
  render(
    <GoalTreeEditor
      tileId="t1"
      tree={tree}
      hasSufficientRights
      onRefresh={onRefresh}
      onDeleteGoal={onDeleteGoal}
      womLinked
      {...props}
    />
  )
  return { onDeleteGoal, onRefresh }
}

describe("GoalTreeEditor", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("renders the tree rows", () => {
    renderEditor()

    expect(screen.getByText("Raids")).toBeInTheDocument()
    expect(screen.getByText("Kill a boss")).toBeInTheDocument()
    expect(screen.getByText("Target: 3")).toBeInTheDocument()
  })

  it("offers no editing controls without sufficient rights", () => {
    renderEditor({ hasSufficientRights: false })

    expect(screen.getByText("Kill a boss")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /add new goal/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /create group/i })
    ).not.toBeInTheDocument()
  })

  it("opens the add-goal drawer with Item, XP / Kills and Other, Item first and selected", () => {
    renderEditor()
    expect(screen.queryByText("Goal type")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /add new goal/i }))

    const radios = screen.getAllByRole("radio")
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual([
      "Item",
      "XP / Kills",
      "Other",
    ])
    expect(screen.getByRole("radio", { name: "Item" })).toBeChecked()
    expect(screen.getByRole("dialog")).toHaveTextContent(/^Add New Goal/)
    expect(screen.queryByText(/Metric/)).not.toBeInTheDocument()
  })

  it("opens the drawer for a group from its Add button", () => {
    renderEditor()

    fireEvent.click(screen.getByRole("button", { name: /^add$/i }))

    expect(screen.getByText(/Add New Goal to Group/)).toBeInTheDocument()
  })

  it("switches the drawer form and footer by goal type", () => {
    renderEditor()
    fireEvent.click(screen.getByRole("button", { name: /add new goal/i }))
    expect(screen.getByRole("button", { name: "Add goals" })).toBeDisabled()

    fireEvent.click(screen.getByRole("radio", { name: "XP / Kills" }))
    expect(
      screen.getByRole("button", { name: /add xp \/ kills goal/i })
    ).toBeDisabled()

    fireEvent.click(screen.getByRole("radio", { name: "Other" }))
    expect(screen.getByLabelText("Description")).toBeInTheDocument()
  })

  describe("deleting", () => {
    it("asks before deleting a goal and only deletes after confirming", () => {
      const { onDeleteGoal } = renderEditor()

      fireEvent.click(
        screen.getByRole("button", { name: "Delete goal: Kill a boss" })
      )

      const dialog = screen.getByRole("alertdialog")
      expect(dialog).toHaveTextContent(/Delete "Kill a boss"\?/)
      expect(onDeleteGoal).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole("button", { name: "Delete goal" }))
      expect(onDeleteGoal).toHaveBeenCalledWith("goal1")
    })

    it("does not delete a goal when the confirmation is cancelled", () => {
      const { onDeleteGoal } = renderEditor()

      fireEvent.click(
        screen.getByRole("button", { name: "Delete goal: Kill a boss" })
      )
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

      expect(onDeleteGoal).not.toHaveBeenCalled()
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })

    it("asks before deleting a group and says its goals are kept", async () => {
      const { deleteGoalGroup } = jest.requireMock(
        "@/app/actions/goal-groups"
      ) as { deleteGoalGroup: jest.Mock }
      deleteGoalGroup.mockResolvedValue({ success: true })
      const { onRefresh } = renderEditor()

      fireEvent.click(
        screen.getByRole("button", { name: "Delete group: Raids" })
      )

      const dialog = screen.getByRole("alertdialog")
      expect(dialog).toHaveTextContent(/Delete group "Raids"\?/)
      expect(dialog).toHaveTextContent(/goals and groups inside it are kept/i)
      expect(deleteGoalGroup).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole("button", { name: "Delete group" }))
      await waitFor(() => expect(onRefresh).toHaveBeenCalled())
      expect(deleteGoalGroup).toHaveBeenCalledWith("g1")
    })
  })

  it("gives the icon-only row buttons accessible names and type=button", () => {
    renderEditor()

    for (const name of [
      "Edit goal: Kill a boss",
      "Delete goal: Kill a boss",
      "Reorder goal: Kill a boss",
      "Delete group: Raids",
      "Rename group: Raids",
      "Expand group: Raids",
    ]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute(
        "type",
        "button"
      )
    }
  })

  it("selects a goal row with Space like Ctrl+Click, and leaves a plain click alone", () => {
    renderEditor()
    const row = screen.getByRole("button", { name: /kill a boss/i, pressed: false })

    fireEvent.keyDown(row, { key: " " })
    expect(
      screen.getByRole("button", { name: /kill a boss/i, pressed: true })
    ).toBeInTheDocument()
    expect(screen.getByText("1 item selected")).toBeInTheDocument()

    fireEvent.keyDown(
      screen.getByRole("button", { name: /kill a boss/i, pressed: true }),
      { key: "Enter" }
    )
    expect(screen.queryByText("1 item selected")).not.toBeInTheDocument()
  })

  describe("editing a goal inline", () => {
    const { updateGoal } = jest.requireMock("@/app/actions/bingo") as {
      updateGoal: jest.Mock
    }
    const startEditing = () => {
      renderEditor()
      fireEvent.click(
        screen.getByRole("button", { name: "Edit goal: Kill a boss" })
      )
      return screen.getByLabelText("Target") as HTMLInputElement
    }

    it("lets the target be cleared without snapping back, and blocks saving until it is valid", () => {
      const target = startEditing()
      expect(target.value).toBe("3")

      fireEvent.change(target, { target: { value: "" } })
      expect(target.value).toBe("")
      fireEvent.blur(target)

      expect(screen.getByRole("alert")).toHaveTextContent("Enter a number")
      expect(target).toHaveAttribute("aria-invalid", "true")
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    })

    it("saves a shorthand target as the full number", async () => {
      updateGoal.mockResolvedValue({ success: true })
      const target = startEditing()

      fireEvent.change(target, { target: { value: "2k" } })
      expect(screen.getByText("= 2,000")).toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: "Save" }))

      await waitFor(() =>
        expect(updateGoal).toHaveBeenCalledWith("goal1", {
          description: "Kill a boss",
          targetValue: 2000,
        })
      )
    })
  })

  it("does not register a global drawer opener", () => {
    renderEditor()

    expect(
      (window as unknown as Record<string, unknown>).openAddGoalDrawer
    ).toBeUndefined()
  })
})
