import { fireEvent, render, screen } from "@testing-library/react"
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
  const onAddGoal = jest.fn()
  render(
    <GoalTreeEditor
      tileId="t1"
      tree={tree}
      hasSufficientRights
      onRefresh={jest.fn()}
      onDeleteGoal={jest.fn()}
      onAddGoal={onAddGoal}
      newGoal={{}}
      onNewGoalChange={jest.fn()}
      {...props}
    />
  )
  return { onAddGoal }
}

describe("GoalTreeEditor", () => {
  beforeEach(() => {
    // The drawer has no SheetDescription (existing behaviour); keep Radix's
    // accessibility warning out of the test output without hiding other warnings.
    const warn = console.warn
    jest.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes("Missing `Description`")) return
      warn(...args)
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
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

  it("opens the add-goal drawer with the three goal types from the Add New Goal button", () => {
    renderEditor()
    expect(screen.queryByText("Select Goal Type")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /add new goal/i }))

    expect(screen.getByText("Select Goal Type")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Generic" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Item" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Metric" })).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toHaveTextContent(/^Add New Goal\s*Select/)
  })

  it("creates a top-level generic goal through onAddGoal(null)", () => {
    const { onAddGoal } = renderEditor()

    fireEvent.click(screen.getByRole("button", { name: /add new goal/i }))
    fireEvent.click(screen.getByRole("button", { name: /^add goal$/i }))

    expect(onAddGoal).toHaveBeenCalledWith(null)
  })

  it("opens the drawer for a group from its Add button and adds into that group", () => {
    const { onAddGoal } = renderEditor()

    fireEvent.click(screen.getByRole("button", { name: /^add$/i }))

    expect(screen.getByText(/Add New Goal to Group/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^add goal$/i }))
    expect(onAddGoal).toHaveBeenCalledWith("g1")
  })

  it("switches the drawer form and footer by goal type", () => {
    renderEditor()
    fireEvent.click(screen.getByRole("button", { name: /add new goal/i }))
    expect(screen.getByLabelText("Description")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Metric" }))
    expect(
      screen.getByRole("button", { name: /add metric goal/i })
    ).toBeDisabled()
  })

  it("does not register a global drawer opener", () => {
    renderEditor()

    expect(
      (window as unknown as Record<string, unknown>).openAddGoalDrawer
    ).toBeUndefined()
  })
})
