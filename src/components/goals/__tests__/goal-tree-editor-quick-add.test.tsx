import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import "./dom-polyfills"
import type { GoalTreeNode } from "@/app/actions/goal-groups"
import { GoalTreeEditor } from "@/components/goal-tree-editor"
import { resetQuickAddMemory } from "@/components/goals/quick-add-bar"
import { createGoals } from "@/app/actions/bingo"
import { searchOsrsItems } from "@/app/actions/osrs-items"
import { toast } from "@/hooks/use-toast"
import { searchFixtureItems } from "./item-fixtures"

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
jest.mock("@/hooks/use-toast", () => ({ toast: jest.fn() }))

const mockedCreateGoals = createGoals as jest.Mock
const mockedSearch = searchOsrsItems as jest.MockedFunction<
  typeof searchOsrsItems
>
const mockedToast = toast as jest.Mock

const now = new Date("2026-01-01T00:00:00Z")

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function taskGoal(id: string, description: string): GoalTreeNode {
  return {
    type: "goal",
    id,
    data: {
      id,
      tileId: "t1",
      parentGroupId: null,
      description,
      targetValue: 1,
      goalType: "generic",
      orderIndex: 0,
    },
  }
}

function itemGoalNode(id: string, name: string): GoalTreeNode {
  return {
    type: "goal",
    id,
    data: {
      id,
      tileId: "t1",
      parentGroupId: null,
      description: name,
      targetValue: 1,
      goalType: "item",
      orderIndex: 1,
      itemGoal: {
        id: `${id}-item`,
        goalId: id,
        itemId: 4151,
        baseName: name,
        exactVariant: null,
        imageUrl: "/whip.png",
        createdAt: now,
        updatedAt: now,
      },
    },
  }
}

function groupNode(
  id: string,
  logicalOperator: "AND" | "OR" | "SUM",
  minRequiredGoals: number,
  children: GoalTreeNode[]
): GoalTreeNode {
  return {
    type: "group",
    id,
    data: {
      id,
      tileId: "t1",
      parentGroupId: null,
      name: "Drops",
      logicalOperator,
      minRequiredGoals,
      orderIndex: 0,
      createdAt: now,
      updatedAt: now,
    },
    children,
  }
}

function renderEditor(
  props: Partial<React.ComponentProps<typeof GoalTreeEditor>> = {}
) {
  const onRefresh = jest.fn()
  const onOpenTrackerSettings = jest.fn()
  const defaults: React.ComponentProps<typeof GoalTreeEditor> = {
    tileId: "t1",
    tree: [],
    hasSufficientRights: true,
    onRefresh,
    onDeleteGoal: jest.fn(),
    womLinked: true,
    onOpenTrackerSettings,
  }
  const utils = render(<GoalTreeEditor {...defaults} {...props} />)
  const rerender = (
    next: Partial<React.ComponentProps<typeof GoalTreeEditor>>
  ) => utils.rerender(<GoalTreeEditor {...defaults} {...props} {...next} />)
  return { ...utils, onRefresh, onOpenTrackerSettings, rerender }
}

const searchField = () =>
  screen.getByRole("combobox", { name: "Search items" }) as HTMLInputElement

/** Searches for an item and adds the top result with Enter. */
async function addItem(query: string, optionName: string) {
  fireEvent.change(searchField(), { target: { value: query } })
  await screen.findByRole("option", { name: optionName }, { timeout: 2000 })
  await waitFor(() =>
    expect(screen.getByRole("option", { name: optionName })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  )
  fireEvent.keyDown(searchField(), { key: "Enter" })
}

const pendingRows = (container: HTMLElement) =>
  container.querySelectorAll("[data-pending-goal]")

const whipInput = {
  type: "item",
  itemId: 4151,
  itemName: "Abyssal whip",
  baseName: "Abyssal whip",
  imageUrl: "/whip.png",
  targetValue: 1,
  exactVariant: null,
}

describe("GoalTreeEditor quick add", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetQuickAddMemory()
    mockedSearch.mockImplementation(async (query) => searchFixtureItems(query))
  })

  describe("empty state", () => {
    it("tells the user to add the first goal and focuses the quick-add search", () => {
      renderEditor({ tree: [] })

      expect(
        screen.getByText(
          "No goals yet — add the first goal to decide when this tile counts as complete."
        )
      ).toBeInTheDocument()
      expect(
        screen.getByRole("search", { name: "Add a goal" })
      ).toBeInTheDocument()
      expect(searchField()).toHaveFocus()
    })

    it("shows neither a summary nor the groups help", () => {
      renderEditor({ tree: [] })

      expect(screen.queryByText(/^Complete/)).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: /how do groups work/i })
      ).not.toBeInTheDocument()
    })

    it("gives a read-only user a neutral message and no way to add", () => {
      renderEditor({ tree: [], hasSufficientRights: false })

      expect(
        screen.getByText("This tile has no goals yet.")
      ).toBeInTheDocument()
      expect(screen.queryByText(/add the first goal/i)).not.toBeInTheDocument()
      expect(screen.queryByRole("search")).not.toBeInTheDocument()
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
      expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })

    it("is not shown when the tile has goals, and the search does not take focus", () => {
      renderEditor({ tree: [taskGoal("g1", "Kill a boss")] })

      expect(screen.queryByText(/No goals yet/)).not.toBeInTheDocument()
      expect(searchField()).not.toHaveFocus()
    })

    it("does not take focus again when the tile becomes empty later", () => {
      const { rerender } = renderEditor({
        tree: [taskGoal("g1", "Kill a boss")],
      })

      rerender({ tree: [] })

      expect(screen.getByText(/No goals yet/)).toBeInTheDocument()
      expect(searchField()).not.toHaveFocus()
    })

    it("does not render the empty list rail", () => {
      const { container } = renderEditor({ tree: [] })

      expect(container.querySelector(".border-l")).not.toBeInTheDocument()
    })
  })

  describe("completion summary", () => {
    it("describes what completes the tile above the list", () => {
      renderEditor({
        tree: [
          itemGoalNode("g2", "Abyssal whip"),
          taskGoal("g1", "Kill a boss"),
        ],
      })

      expect(
        screen.getByText("Complete all of: Abyssal whip, Kill a boss")
      ).toBeInTheDocument()
    })

    it("follows the group's rule", () => {
      renderEditor({
        tree: [
          groupNode("grp", "OR", 2, [
            taskGoal("a", "Kill a boss"),
            taskGoal("b", "Get a pet"),
            taskGoal("c", "Do a raid"),
          ]),
        ],
      })

      expect(
        screen.getByText("Complete any 2 of: Kill a boss, Get a pet, Do a raid")
      ).toBeInTheDocument()
    })

    it("is shown to read-only users as well", () => {
      renderEditor({
        tree: [taskGoal("g1", "Kill a boss")],
        hasSufficientRights: false,
      })

      expect(screen.getByText("Complete: Kill a boss")).toBeInTheDocument()
    })

    it("updates when the tree changes", () => {
      const { rerender } = renderEditor({
        tree: [taskGoal("g1", "Kill a boss")],
      })

      rerender({
        tree: [taskGoal("g1", "Kill a boss"), taskGoal("g2", "Get a pet")],
      })

      expect(
        screen.getByText("Complete all of: Kill a boss, Get a pet")
      ).toBeInTheDocument()
    })
  })

  describe("groups help", () => {
    const trigger = () =>
      screen.getByRole("button", { name: "How do groups work?" })

    it("is closed by default and does not show the old tip", () => {
      renderEditor({ tree: [taskGoal("g1", "Kill a boss")] })

      expect(trigger()).toHaveAttribute("aria-expanded", "false")
      expect(screen.queryByText(/Tip:/)).not.toBeInTheDocument()
      expect(
        screen.queryByText(/Goals outside any group/)
      ).not.toBeInTheDocument()
    })

    it("opens and closes on demand", () => {
      renderEditor({ tree: [taskGoal("g1", "Kill a boss")] })

      fireEvent.click(trigger())
      expect(trigger()).toHaveAttribute("aria-expanded", "true")
      expect(screen.getByText(/Goals outside any group/)).toBeInTheDocument()

      fireEvent.click(trigger())
      expect(trigger()).toHaveAttribute("aria-expanded", "false")
      expect(
        screen.queryByText(/Goals outside any group/)
      ).not.toBeInTheDocument()
    })

    it("explains AND, OR and SUM, dragging and multi-select", () => {
      renderEditor({ tree: [taskGoal("g1", "Kill a boss")] })

      fireEvent.click(trigger())

      const help = screen.getByRole("list")
      expect(within(help).getByText("AND")).toBeInTheDocument()
      expect(within(help).getByText("OR")).toBeInTheDocument()
      expect(within(help).getByText("SUM")).toBeInTheDocument()
      expect(help).toHaveTextContent(/at least the minimum you set/)
      expect(help).toHaveTextContent(/Drag a goal onto a group/)
      expect(within(help).getByText("Ctrl/Cmd+Click")).toBeInTheDocument()
      expect(within(help).getByText("Space")).toBeInTheDocument()
    })

    it("is not offered to read-only users", () => {
      renderEditor({
        tree: [taskGoal("g1", "Kill a boss")],
        hasSufficientRights: false,
      })

      expect(
        screen.queryByRole("button", { name: /how do groups work/i })
      ).not.toBeInTheDocument()
    })
  })

  describe("the drawer stays available", () => {
    it("is opened by the Add several goals button", () => {
      renderEditor({ tree: [taskGoal("g1", "Kill a boss")] })

      fireEvent.click(screen.getByRole("button", { name: "Add several goals" }))

      expect(screen.getByRole("dialog")).toHaveTextContent(/^Add New Goal/)
    })
  })

  describe("adding a goal optimistically", () => {
    it("shows a muted pending row at once, confirms it, and drops it when the tree has the real goal", async () => {
      const answer = deferred<unknown>()
      mockedCreateGoals.mockReturnValue(answer.promise)
      const { container, onRefresh, rerender } = renderEditor({
        tree: [taskGoal("g1", "Kill a boss")],
      })

      await addItem("abyssal", "Abyssal whip")

      // Right away: a pending row, in the list and in the summary.
      const [row] = pendingRows(container)
      expect(row).toBeInTheDocument()
      expect(
        within(row as HTMLElement).getByText("Abyssal whip")
      ).toBeInTheDocument()
      expect(
        within(row as HTMLElement).getByText("Saving...")
      ).toBeInTheDocument()
      expect(row).toHaveAttribute("aria-busy", "true")
      expect(
        screen.getByText("Complete all of: Kill a boss, Abyssal whip")
      ).toBeInTheDocument()
      await waitFor(() => expect(mockedCreateGoals).toHaveBeenCalledTimes(1))
      expect(mockedCreateGoals).toHaveBeenCalledWith("t1", [whipInput], {
        parentGroupId: null,
      })
      expect(onRefresh).not.toHaveBeenCalled()

      // The server answered: refresh, and show it as saved while waiting.
      await act(async () => {
        answer.resolve({ success: true, goals: [{ goal: { id: "new1" } }] })
      })
      await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1))
      expect(within(row as HTMLElement).getByText("Saved")).toBeInTheDocument()
      expect(pendingRows(container)).toHaveLength(1)

      // The refreshed tree contains the real goal: the pending row is gone.
      rerender({
        tree: [
          taskGoal("g1", "Kill a boss"),
          itemGoalNode("new1", "Abyssal whip"),
        ],
      })
      expect(pendingRows(container)).toHaveLength(0)
      expect(
        screen.getAllByRole("button", { name: "Edit goal: Abyssal whip" })
      ).toHaveLength(1)
    })

    it("cannot be dragged, edited or deleted while pending", async () => {
      mockedCreateGoals.mockReturnValue(new Promise(() => undefined))
      const { container } = renderEditor({
        tree: [taskGoal("g1", "Kill a boss")],
      })

      await addItem("abyssal", "Abyssal whip")

      const [row] = pendingRows(container)
      expect(row).toBeInTheDocument()
      expect(
        within(row as HTMLElement).queryByRole("button")
      ).not.toBeInTheDocument()
      for (const name of [
        "Reorder goal: Abyssal whip",
        "Edit goal: Abyssal whip",
        "Delete goal: Abyssal whip",
      ]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
      }
    })

    it("keeps a saved goal on screen until the tree contains it, however often the tree changes", async () => {
      mockedCreateGoals.mockResolvedValue({
        success: true,
        goals: [{ goal: { id: "new1" } }],
      })
      const { container, onRefresh, rerender } = renderEditor({
        tree: [taskGoal("g1", "Kill a boss")],
      })
      await addItem("abyssal", "Abyssal whip")
      await waitFor(() => expect(onRefresh).toHaveBeenCalled())

      // A change that does not include the new goal yet.
      rerender({ tree: [taskGoal("g1", "Kill a boss (edited)")] })

      expect(pendingRows(container)).toHaveLength(1)
      expect(screen.getByText("Saved")).toBeInTheDocument()
    })

    it("sends each goal only after the previous one was saved, so they land in order", async () => {
      const first = deferred<unknown>()
      mockedCreateGoals
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce({
          success: true,
          goals: [{ goal: { id: "b" } }],
        })
      const { container } = renderEditor({ tree: [] })

      await addItem("abyssal", "Abyssal whip")
      await addItem("dragon dagger", "Dragon dagger (p)")

      expect(pendingRows(container)).toHaveLength(2)
      await waitFor(() => expect(mockedCreateGoals).toHaveBeenCalledTimes(1))
      // Give a wrongly parallel second call the chance to show up.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })
      expect(mockedCreateGoals).toHaveBeenCalledTimes(1)

      await act(async () => {
        first.resolve({ success: true, goals: [{ goal: { id: "a" } }] })
      })

      await waitFor(() => expect(mockedCreateGoals).toHaveBeenCalledTimes(2))
      expect(mockedCreateGoals.mock.calls[0]?.[1]?.[0]).toMatchObject({
        itemName: "Abyssal whip",
      })
      expect(mockedCreateGoals.mock.calls[1]?.[1]?.[0]).toMatchObject({
        itemName: "Dragon dagger#(p)",
      })
    })

    it("hides the empty state while a goal is pending", async () => {
      mockedCreateGoals.mockReturnValue(new Promise(() => undefined))
      renderEditor({ tree: [] })

      await addItem("abyssal", "Abyssal whip")

      expect(screen.queryByText(/No goals yet/)).not.toBeInTheDocument()
      expect(screen.getByText("Complete: Abyssal whip")).toBeInTheDocument()
    })

    it("does not show a pending goal of another tile", async () => {
      mockedCreateGoals.mockReturnValue(new Promise(() => undefined))
      const { container, rerender } = renderEditor({ tree: [] })
      await addItem("abyssal", "Abyssal whip")
      expect(pendingRows(container)).toHaveLength(1)

      rerender({ tileId: "t2" })

      expect(pendingRows(container)).toHaveLength(0)
    })

    it("drops the pending row after a save that returned no goal id, relying on the refresh", async () => {
      mockedCreateGoals.mockResolvedValue({ success: true, goals: [{}] })
      const { container, onRefresh } = renderEditor({
        tree: [taskGoal("g1", "Kill a boss")],
      })

      await addItem("abyssal", "Abyssal whip")

      await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(pendingRows(container)).toHaveLength(0))
    })

    describe("when the server refuses", () => {
      it("takes the row back, shows the server's error and puts the search text back", async () => {
        mockedCreateGoals.mockResolvedValue({
          success: false,
          error: "You do not have permission to add goals to this tile",
        })
        const { container, onRefresh } = renderEditor({
          tree: [taskGoal("g1", "Kill a boss")],
        })

        await addItem("abyssal", "Abyssal whip")
        expect(pendingRows(container)).toHaveLength(1)

        await waitFor(() => expect(pendingRows(container)).toHaveLength(0))
        expect(mockedToast).toHaveBeenCalledWith({
          title: "Error",
          description: "You do not have permission to add goals to this tile",
          variant: "destructive",
        })
        expect(onRefresh).not.toHaveBeenCalled()
        expect(screen.getByText("Complete: Kill a boss")).toBeInTheDocument()
        await waitFor(() => expect(searchField()).toHaveValue("abyssal"))
      })

      it("brings the empty state back on an empty tile", async () => {
        mockedCreateGoals.mockResolvedValue({ success: false, error: "Nope" })
        renderEditor({ tree: [] })

        await addItem("abyssal", "Abyssal whip")

        expect(await screen.findByText(/No goals yet/)).toBeInTheDocument()
        expect(mockedToast).toHaveBeenCalledTimes(1)
      })

      it("treats a thrown error like a refusal", async () => {
        const consoleError = jest
          .spyOn(console, "error")
          .mockImplementation(() => undefined)
        mockedCreateGoals.mockRejectedValue(new Error("network down"))
        const { container, onRefresh } = renderEditor({ tree: [] })

        await addItem("abyssal", "Abyssal whip")

        await waitFor(() => expect(pendingRows(container)).toHaveLength(0))
        expect(mockedToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Failed to add the goal",
          variant: "destructive",
        })
        expect(onRefresh).not.toHaveBeenCalled()
        consoleError.mockRestore()
      })

      it("only takes back the goal that failed", async () => {
        mockedCreateGoals
          .mockResolvedValueOnce({
            success: true,
            goals: [{ goal: { id: "a" } }],
          })
          .mockResolvedValueOnce({ success: false, error: "Nope" })
        const { container } = renderEditor({ tree: [] })

        await addItem("abyssal", "Abyssal whip")
        await addItem("dragon dagger", "Dragon dagger (p)")

        await waitFor(() => expect(mockedToast).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(pendingRows(container)).toHaveLength(1))
        expect(
          within(pendingRows(container)[0] as HTMLElement).getByText(
            "Abyssal whip"
          )
        ).toBeInTheDocument()
      })
    })

    describe("other goal types", () => {
      it("adds an XP goal at the top level in one go", async () => {
        window.localStorage.setItem("bingoscape:goals:quick-add-type", "metric")
        mockedCreateGoals.mockResolvedValue({
          success: true,
          goals: [{ goal: { id: "x1" } }],
        })
        const { container } = renderEditor({ tree: [], womLinked: false })

        fireEvent.click(
          within(screen.getByRole("radiogroup", { name: "Skill" })).getByRole(
            "radio",
            { name: "Attack" }
          )
        )
        fireEvent.change(screen.getByLabelText("XP to gain"), {
          target: { value: "5m" },
        })
        fireEvent.click(screen.getByRole("button", { name: "Add skill goal" }))

        // The pending row reads like the saved one will.
        expect(
          within(pendingRows(container)[0] as HTMLElement).getByText("Attack")
        ).toBeInTheDocument()
        expect(
          within(pendingRows(container)[0] as HTMLElement).getByText(
            "Target: 5,000,000"
          )
        ).toBeInTheDocument()
        expect(screen.getByText("Complete: Attack XP")).toBeInTheDocument()
        await waitFor(() =>
          expect(mockedCreateGoals).toHaveBeenCalledWith(
            "t1",
            [
              {
                type: "metric",
                metricType: "skill",
                metricName: "attack",
                targetValue: 5_000_000,
              },
            ],
            { parentGroupId: null }
          )
        )
      })

      it("adds a task at the top level", async () => {
        window.localStorage.setItem(
          "bingoscape:goals:quick-add-type",
          "generic"
        )
        mockedCreateGoals.mockResolvedValue({
          success: true,
          goals: [{ goal: { id: "t" } }],
        })
        const { container } = renderEditor({ tree: [] })

        fireEvent.change(screen.getByLabelText("Description"), {
          target: { value: "Get a pet" },
        })
        fireEvent.click(screen.getByRole("button", { name: "Add goal" }))

        expect(pendingRows(container)).toHaveLength(1)
        await waitFor(() =>
          expect(mockedCreateGoals).toHaveBeenCalledWith(
            "t1",
            [{ type: "generic", description: "Get a pet", targetValue: 1 }],
            { parentGroupId: null }
          )
        )
      })
    })
  })
})
