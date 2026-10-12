import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import "@/components/goals/__tests__/dom-polyfills"
import { createGoals } from "@/app/actions/bingo"
import { applyGoalsToTiles } from "@/app/actions/goal-batch"
import { searchOsrsItems } from "@/app/actions/osrs-items"
import { GoalSetupView } from "@/components/goal-setup/goal-setup-view"
import { resetQuickAddMemory } from "@/components/goals/quick-add-bar"
import { searchFixtureItems } from "@/components/goals/__tests__/item-fixtures"
import { toast } from "@/hooks/use-toast"
import { makeBoard, makeGoal, makeTile } from "./fixtures"

jest.mock("@/app/actions/bingo", () => ({ createGoals: jest.fn() }))
jest.mock("@/app/actions/goal-batch", () => ({ applyGoalsToTiles: jest.fn() }))
jest.mock("@/app/actions/osrs-items", () => ({ searchOsrsItems: jest.fn() }))
jest.mock("@/hooks/use-toast", () => ({ toast: jest.fn() }))

const mockedCreateGoals = createGoals as jest.Mock
const mockedApply = applyGoalsToTiles as jest.Mock
const mockedSearch = searchOsrsItems as jest.MockedFunction<
  typeof searchOsrsItems
>
const mockedToast = toast as jest.Mock

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function renderView(
  props: Partial<React.ComponentProps<typeof GoalSetupView>> = {}
) {
  const onBack = jest.fn()
  const onOpenTile = jest.fn()
  const onRefresh = jest.fn()
  const onOpenTrackerSettings = jest.fn()
  const defaults: React.ComponentProps<typeof GoalSetupView> = {
    bingoId: "bingo-1",
    tiles: makeBoard(),
    womLinked: true,
    onBack,
    onOpenTile,
    onRefresh,
    onOpenTrackerSettings,
  }
  const utils = render(<GoalSetupView {...defaults} {...props} />)
  const rerender = (
    next: Partial<React.ComponentProps<typeof GoalSetupView>>
  ) => utils.rerender(<GoalSetupView {...defaults} {...props} {...next} />)
  return { ...utils, rerender, onBack, onOpenTile, onRefresh }
}

/** The rows (and not the goal chips, which are list items too). */
const rowElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>("[data-setup-row]"))
const rowTitles = (container: HTMLElement) =>
  rowElements(container).map(
    (row) =>
      document.getElementById(row.getAttribute("aria-labelledby") ?? "")
        ?.textContent
  )
const row = (title: string) => screen.getByRole("listitem", { name: title })
/** Focusing makes the row the tab stop, a state update React must see in act. */
const focusRow = (title: string) => act(() => row(title).focus())

const checkbox = (title: string) =>
  screen.getByRole("checkbox", { name: `Select ${title}` })
const toggleFilter = () =>
  fireEvent.click(
    screen.getByRole("switch", { name: "Only tiles without goals" })
  )
const openAddGoals = (title: string) =>
  fireEvent.click(screen.getByRole("button", { name: `Add goals to ${title}` }))

const clickAsync = (element: HTMLElement) =>
  act(async () => {
    fireEvent.click(element)
  })

beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
  resetQuickAddMemory()
  // The quick-add bar starts on "Other": no item search needed for most tests.
  window.localStorage.setItem("bingoscape:goals:quick-add-type", "generic")
  mockedSearch.mockImplementation(async (query) => searchFixtureItems(query))
  mockedCreateGoals.mockResolvedValue({
    success: true,
    goals: [{ goal: { id: "new-goal" } }],
    groupId: null,
  })
})

describe("GoalSetupView: the list", () => {
  it("lists the visible tiles in board order, even when given out of order", () => {
    const tiles = makeBoard().reverse()
    const { container } = renderView({ tiles })

    expect(rowTitles(container)).toEqual([
      "Fire cape",
      "Zulrah",
      "Dragon pickaxe",
      "Chambers purple",
      "Nex",
    ])
  })

  it("is a labelled list of tiles", () => {
    renderView()
    expect(screen.getByRole("list", { name: "Tiles" })).toBeInTheDocument()
  })

  it("shows each tile's position", () => {
    renderView()
    expect(within(row("Nex")).getByText("6")).toBeInTheDocument()
    expect(within(row("Fire cape")).getByText("1")).toBeInTheDocument()
  })

  it("summarises what completes each tile in one line", () => {
    renderView()
    expect(
      within(row("Fire cape")).getByText("Complete: Fire cape")
    ).toBeInTheDocument()
    expect(
      within(row("Zulrah")).getByText(
        "Complete any 2 of: Zulrah kills, Tanzanite fang, Magic fang"
      )
    ).toBeInTheDocument()
    expect(
      within(row("Chambers purple")).getByText("Complete: Complete 5 raids")
    ).toBeInTheDocument()
  })

  it("shows a tile without goals calmly, as 'No goals yet'", () => {
    renderView()
    expect(
      within(row("Dragon pickaxe")).getByText("No goals yet")
    ).toBeInTheDocument()
    expect(row("Dragon pickaxe")).toHaveClass("border-dashed")
    expect(
      within(row("Dragon pickaxe")).queryByRole("list", {
        name: "Goals of Dragon pickaxe",
      })
    ).not.toBeInTheDocument()
  })

  it("shows goals as chips with their type and target", () => {
    renderView()
    const chips = within(
      screen.getByRole("list", { name: "Goals of Zulrah" })
    ).getAllByRole("listitem")
    expect(chips.map((chip) => chip.textContent)).toEqual(["Any 2 of 3"])

    const chambers = within(
      screen.getByRole("list", { name: "Goals of Chambers purple" })
    )
    expect(chambers.getByText("Complete 5 raids")).toBeInTheDocument()
    expect(chambers.getByText("x5")).toBeInTheDocument()
  })

  it("does not list hidden tiles, and says there are some", () => {
    const { container } = renderView()
    expect(rowTitles(container)).not.toContain("Secret")
    expect(
      screen.getByText(
        "1 hidden tile not listed. Reveal a hidden tile to set up its goals."
      )
    ).toBeInTheDocument()
  })

  it("does not mention hidden tiles when there are none", () => {
    renderView({ tiles: makeBoard().filter((tile) => !tile.isHidden) })
    expect(screen.queryByText(/hidden tile/)).not.toBeInTheDocument()
  })

  it("counts the tiles without goals (hidden ones excluded)", () => {
    renderView()
    expect(screen.getByText(/2 of 5 tiles have no goals/)).toBeInTheDocument()
  })

  it("uses the singular for one tile", () => {
    renderView({
      tiles: makeBoard().map((tile) =>
        tile.id === "t6"
          ? makeTile({
              id: "t6",
              index: 5,
              title: "Nex",
              goals: [makeGoal({ id: "g6", tileId: "t6" })],
            })
          : tile
      ),
    })
    expect(screen.getByText(/1 of 5 tiles has no goals/)).toBeInTheDocument()
  })

  it("says so when every tile has goals", () => {
    renderView({
      tiles: makeBoard()
        .filter((tile) => !tile.isHidden)
        .map((tile) =>
          tile.goals?.length
            ? tile
            : makeTile({
                id: tile.id,
                index: tile.index,
                title: tile.title,
                goals: [makeGoal({ id: `g-${tile.id}`, tileId: tile.id })],
              })
        ),
    })
    expect(screen.getByText("Every tile has goals")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Select all without goals" })
    ).toBeDisabled()
  })

  it("handles a board without tiles", () => {
    renderView({ tiles: [] })
    expect(
      screen.getByText("This board has no tiles to set up.")
    ).toBeInTheDocument()
  })

  it("leaves with the back button", () => {
    const { onBack } = renderView()
    fireEvent.click(screen.getByRole("button", { name: "Back to board" }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("opens a tile in the tile panel", () => {
    const { onOpenTile } = renderView()
    fireEvent.click(
      screen.getByRole("button", { name: "Open Zulrah in the tile panel" })
    )
    expect(onOpenTile).toHaveBeenCalledWith("t2")
  })
})

describe("GoalSetupView: only tiles without goals", () => {
  it("shows just the tiles without goals while the filter is on", () => {
    const { container } = renderView()
    toggleFilter()
    expect(rowTitles(container)).toEqual(["Dragon pickaxe", "Nex"])
  })

  it("brings every tile back when the filter is switched off", () => {
    const { container } = renderView()
    toggleFilter()
    toggleFilter()
    expect(rowTitles(container)).toHaveLength(5)
  })

  it("keeps a row that just received goals in the list while the filter is on", () => {
    const { container, rerender } = renderView()
    toggleFilter()

    rerender({
      tiles: makeBoard().map((tile) =>
        tile.id === "t3"
          ? makeTile({
              id: "t3",
              index: 2,
              title: "Dragon pickaxe",
              goals: [
                makeGoal({ id: "new", tileId: "t3", description: "Do it" }),
              ],
            })
          : tile
      ),
    })

    expect(rowTitles(container)).toEqual(["Dragon pickaxe", "Nex"])
    // The count follows the data, the list does not jump.
    expect(screen.getByText(/1 of 5 tiles has no goals/)).toBeInTheDocument()
  })

  it("forgets such rows when the filter is switched off and on again", () => {
    const { container, rerender } = renderView()
    toggleFilter()
    rerender({
      tiles: makeBoard().map((tile) =>
        tile.id === "t3"
          ? makeTile({
              id: "t3",
              index: 2,
              title: "Dragon pickaxe",
              goals: [makeGoal({ id: "new", tileId: "t3" })],
            })
          : tile
      ),
    })
    toggleFilter()
    toggleFilter()

    expect(rowTitles(container)).toEqual(["Nex"])
  })

  it("explains an empty result", () => {
    renderView({
      tiles: makeBoard().filter((tile) => tile.goals?.length),
    })
    toggleFilter()
    expect(screen.getByRole("status")).toHaveTextContent(
      "Every tile has goals."
    )
  })
})

describe("GoalSetupView: quick add on a row", () => {
  it("opens the bar for that row only, and only one at a time", () => {
    renderView()
    openAddGoals("Dragon pickaxe")
    expect(
      screen.getByRole("group", { name: "Add goals to Dragon pickaxe" })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("search")).toHaveLength(1)

    openAddGoals("Nex")
    expect(
      screen.queryByRole("group", { name: "Add goals to Dragon pickaxe" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("group", { name: "Add goals to Nex" })
    ).toBeInTheDocument()
  })

  it("marks the toggle as expanded and closes the bar with it", () => {
    renderView()
    const toggle = screen.getByRole("button", {
      name: "Add goals to Dragon pickaxe",
    })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(toggle)

    const open = screen.getByRole("button", {
      name: "Close the goal form of Dragon pickaxe",
    })
    expect(open).toHaveAttribute("aria-expanded", "true")
    fireEvent.click(open)
    expect(screen.queryByRole("search")).not.toBeInTheDocument()
  })

  it("puts the cursor in the bar when it opens", () => {
    renderView()
    openAddGoals("Dragon pickaxe")
    expect(screen.getByLabelText("Description")).toHaveFocus()
  })

  it("creates the goal on the row's tile through createGoals", async () => {
    const { onRefresh } = renderView()
    openAddGoals("Dragon pickaxe")
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Get a pet" },
    })
    fireEvent.change(screen.getByLabelText("Target"), {
      target: { value: "3" },
    })

    await clickAsync(screen.getByRole("button", { name: "Add goal" }))

    await waitFor(() => expect(mockedCreateGoals).toHaveBeenCalledTimes(1))
    expect(mockedCreateGoals).toHaveBeenCalledWith(
      "t3",
      [{ type: "generic", description: "Get a pet", targetValue: 3 }],
      { parentGroupId: null }
    )
    await waitFor(() => expect(onRefresh).toHaveBeenCalled())
  })

  it("adds an item with its quantity to the row's tile", async () => {
    window.localStorage.setItem("bingoscape:goals:quick-add-type", "item")
    renderView()
    openAddGoals("Nex")
    const search = screen.getByRole("combobox", { name: "Search items" })
    fireEvent.change(search, { target: { value: "abyssal wh" } })
    await screen.findByRole(
      "option",
      { name: "Abyssal whip" },
      { timeout: 2000 }
    )
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: "Abyssal whip" })
      ).toHaveAttribute("aria-selected", "true")
    )
    fireEvent.change(screen.getByRole("textbox", { name: "Quantity" }), {
      target: { value: "2" },
    })

    await act(async () => {
      fireEvent.keyDown(search, { key: "Enter" })
    })

    await waitFor(() =>
      expect(mockedCreateGoals).toHaveBeenCalledWith(
        "t6",
        [
          expect.objectContaining({
            type: "item",
            itemId: 4151,
            itemName: "Abyssal whip",
            targetValue: 2,
          }),
        ],
        { parentGroupId: null }
      )
    )
  })

  it("shows the new goal right away as a saving chip, and in the summary", async () => {
    const pending = deferred<unknown>()
    mockedCreateGoals.mockReturnValue(pending.promise)
    renderView()
    openAddGoals("Dragon pickaxe")
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Get a pet" },
    })

    await clickAsync(screen.getByRole("button", { name: "Add goal" }))

    const chips = within(
      screen.getByRole("list", { name: "Goals of Dragon pickaxe" })
    )
    expect(chips.getByText("Get a pet")).toBeInTheDocument()
    expect(chips.getByText("Saving")).toBeInTheDocument()
    expect(
      within(row("Dragon pickaxe")).getByText("Complete: Get a pet")
    ).toBeInTheDocument()

    await act(async () => {
      pending.resolve({
        success: true,
        goals: [{ goal: { id: "new-goal" } }],
        groupId: null,
      })
    })
    expect(chips.queryByText("Saving")).not.toBeInTheDocument()
    expect(chips.getByText("Get a pet")).toBeInTheDocument()
  })

  it("takes the goal back and shows the error when the server refuses", async () => {
    mockedCreateGoals.mockResolvedValue({ success: false, error: "Nope" })
    const { onRefresh } = renderView()
    openAddGoals("Dragon pickaxe")
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Get a pet" },
    })

    await clickAsync(screen.getByRole("button", { name: "Add goal" }))

    await waitFor(() =>
      expect(mockedToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Nope", variant: "destructive" })
      )
    )
    expect(
      screen.queryByRole("list", { name: "Goals of Dragon pickaxe" })
    ).not.toBeInTheDocument()
    expect(
      within(row("Dragon pickaxe")).getByText("No goals yet")
    ).toBeInTheDocument()
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it("keeps a saving chip visible when the bar is closed", async () => {
    mockedCreateGoals.mockReturnValue(new Promise(() => {}))
    renderView()
    openAddGoals("Dragon pickaxe")
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Get a pet" },
    })
    await clickAsync(screen.getByRole("button", { name: "Add goal" }))

    fireEvent.click(
      screen.getByRole("button", {
        name: "Close the goal form of Dragon pickaxe",
      })
    )

    expect(
      within(
        screen.getByRole("list", { name: "Goals of Dragon pickaxe" })
      ).getByText("Get a pet")
    ).toBeInTheDocument()
  })
})

describe("GoalSetupView: keyboard", () => {
  const key = (element: HTMLElement, name: string, init = {}) =>
    fireEvent.keyDown(element, { key: name, ...init })

  it("makes only the first row a tab stop at first", () => {
    const { container } = renderView()
    const tabIndexes = rowElements(container).map((r) =>
      r.getAttribute("tabindex")
    )
    expect(tabIndexes).toEqual(["0", "-1", "-1", "-1", "-1"])
  })

  it("keeps the controls inside the other rows out of the tab order", () => {
    renderView()
    expect(
      screen.getByRole("button", { name: "Add goals to Fire cape" })
    ).toHaveAttribute("tabindex", "0")
    expect(
      screen.getByRole("button", { name: "Add goals to Zulrah" })
    ).toHaveAttribute("tabindex", "-1")
    expect(checkbox("Zulrah")).toHaveAttribute("tabindex", "-1")
    expect(checkbox("Fire cape")).toHaveAttribute("tabindex", "0")
  })

  it("moves between rows with the arrow keys and hands the tab stop on", () => {
    renderView()
    focusRow("Fire cape")

    key(row("Fire cape"), "ArrowDown")
    expect(row("Zulrah")).toHaveFocus()
    expect(row("Zulrah")).toHaveAttribute("tabindex", "0")
    expect(row("Fire cape")).toHaveAttribute("tabindex", "-1")

    key(row("Zulrah"), "ArrowDown")
    expect(row("Dragon pickaxe")).toHaveFocus()

    key(row("Dragon pickaxe"), "ArrowUp")
    expect(row("Zulrah")).toHaveFocus()
  })

  it("stops at the first and last row", () => {
    renderView()
    focusRow("Fire cape")
    key(row("Fire cape"), "ArrowUp")
    expect(row("Fire cape")).toHaveFocus()

    key(row("Fire cape"), "End")
    expect(row("Nex")).toHaveFocus()
    key(row("Nex"), "ArrowDown")
    expect(row("Nex")).toHaveFocus()

    key(row("Nex"), "Home")
    expect(row("Fire cape")).toHaveFocus()
  })

  it("moves only through the listed rows while the filter is on", () => {
    renderView()
    toggleFilter()
    focusRow("Dragon pickaxe")
    key(row("Dragon pickaxe"), "ArrowDown")
    expect(row("Nex")).toHaveFocus()
  })

  it("opens the row's quick-add bar with Enter and puts the cursor in it", () => {
    renderView()
    focusRow("Dragon pickaxe")

    key(row("Dragon pickaxe"), "Enter")

    expect(
      screen.getByRole("group", { name: "Add goals to Dragon pickaxe" })
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Description")).toHaveFocus()
  })

  it("puts the cursor back into an already open bar with Enter", () => {
    renderView()
    focusRow("Dragon pickaxe")
    key(row("Dragon pickaxe"), "Enter")
    focusRow("Dragon pickaxe")

    key(row("Dragon pickaxe"), "Enter")

    expect(screen.getAllByRole("search")).toHaveLength(1)
    expect(screen.getByLabelText("Description")).toHaveFocus()
  })

  it("closes the bar with Escape and returns to the row", () => {
    renderView()
    focusRow("Dragon pickaxe")
    key(row("Dragon pickaxe"), "Enter")

    key(screen.getByLabelText("Description"), "Escape")

    expect(screen.queryByRole("search")).not.toBeInTheDocument()
    expect(row("Dragon pickaxe")).toHaveFocus()
  })

  it("lets the first Escape empty the item search instead of closing the bar", async () => {
    window.localStorage.setItem("bingoscape:goals:quick-add-type", "item")
    renderView()
    focusRow("Nex")
    key(row("Nex"), "Enter")
    const search = screen.getByRole("combobox", { name: "Search items" })
    fireEvent.change(search, { target: { value: "aby" } })

    key(search, "Escape")
    expect(screen.getByRole("search")).toBeInTheDocument()
    await waitFor(() => expect(search).toHaveValue(""))

    key(search, "Escape")
    expect(screen.queryByRole("search")).not.toBeInTheDocument()
    expect(row("Nex")).toHaveFocus()
  })

  it("closes an open bar with Escape on the row itself", () => {
    renderView()
    focusRow("Dragon pickaxe")
    key(row("Dragon pickaxe"), "Enter")
    focusRow("Dragon pickaxe")

    key(row("Dragon pickaxe"), "Escape")

    expect(screen.queryByRole("search")).not.toBeInTheDocument()
  })

  it("selects the row with Space", () => {
    renderView()
    focusRow("Zulrah")
    key(row("Zulrah"), " ")
    expect(checkbox("Zulrah")).toBeChecked()
    expect(screen.getByText("1 tile selected")).toBeInTheDocument()

    key(row("Zulrah"), " ")
    expect(checkbox("Zulrah")).not.toBeChecked()
  })

  it("leaves keys typed in the quick-add bar alone", () => {
    renderView()
    focusRow("Dragon pickaxe")
    key(row("Dragon pickaxe"), "Enter")
    const description = screen.getByLabelText("Description")

    key(description, "ArrowDown")
    key(description, " ")

    expect(description).toHaveFocus()
    expect(checkbox("Dragon pickaxe")).not.toBeChecked()
  })

  it("makes a row the tab stop when focus enters it by other means", () => {
    renderView()
    const button = screen.getByRole("button", { name: "Add goals to Nex" })
    act(() => button.focus())
    expect(row("Nex")).toHaveAttribute("tabindex", "0")
    expect(row("Fire cape")).toHaveAttribute("tabindex", "-1")
  })
})

describe("GoalSetupView: selecting rows", () => {
  it("selects and deselects with the checkbox and counts them", () => {
    renderView()
    fireEvent.click(checkbox("Fire cape"))
    expect(checkbox("Fire cape")).toBeChecked()
    expect(screen.getByText("1 tile selected")).toBeInTheDocument()

    fireEvent.click(checkbox("Zulrah"))
    expect(screen.getByText("2 tiles selected")).toBeInTheDocument()

    fireEvent.click(checkbox("Fire cape"))
    expect(screen.getByText("1 tile selected")).toBeInTheDocument()
  })

  it("selects a range with shift-click", () => {
    renderView()
    fireEvent.click(checkbox("Fire cape"))
    fireEvent.click(checkbox("Dragon pickaxe"), { shiftKey: true })

    expect(checkbox("Fire cape")).toBeChecked()
    expect(checkbox("Zulrah")).toBeChecked()
    expect(checkbox("Dragon pickaxe")).toBeChecked()
    expect(checkbox("Chambers purple")).not.toBeChecked()
    expect(screen.getByText("3 tiles selected")).toBeInTheDocument()
  })

  it("selects a range backwards and keeps earlier selections", () => {
    renderView()
    fireEvent.click(checkbox("Nex"))
    fireEvent.click(checkbox("Chambers purple"))
    fireEvent.click(checkbox("Zulrah"), { shiftKey: true })

    expect(screen.getByText("4 tiles selected")).toBeInTheDocument()
    expect(checkbox("Fire cape")).not.toBeChecked()
    expect(checkbox("Nex")).toBeChecked()
  })

  it("deselects a range when the anchor was deselected", () => {
    renderView()
    fireEvent.click(checkbox("Fire cape"))
    fireEvent.click(checkbox("Nex"), { shiftKey: true })
    expect(screen.getByText("5 tiles selected")).toBeInTheDocument()

    fireEvent.click(checkbox("Zulrah"))
    fireEvent.click(checkbox("Chambers purple"), { shiftKey: true })
    expect(checkbox("Zulrah")).not.toBeChecked()
    expect(checkbox("Dragon pickaxe")).not.toBeChecked()
    expect(checkbox("Chambers purple")).not.toBeChecked()
    expect(screen.getByText("2 tiles selected")).toBeInTheDocument()
  })

  it("selects all tiles without goals", () => {
    renderView()
    fireEvent.click(checkbox("Fire cape"))

    fireEvent.click(
      screen.getByRole("button", { name: "Select all without goals" })
    )

    expect(screen.getByText("2 tiles selected")).toBeInTheDocument()
    expect(checkbox("Dragon pickaxe")).toBeChecked()
    expect(checkbox("Nex")).toBeChecked()
    expect(checkbox("Fire cape")).not.toBeChecked()
  })

  it("clears the selection", () => {
    renderView()
    fireEvent.click(checkbox("Fire cape"))
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }))
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument()
    expect(checkbox("Fire cape")).not.toBeChecked()
  })

  it("shows the apply action only while something is selected", () => {
    renderView()
    expect(
      screen.queryByRole("button", { name: "Apply a goal to selected tiles" })
    ).not.toBeInTheDocument()
    fireEvent.click(checkbox("Fire cape"))
    expect(
      screen.getByRole("button", { name: "Apply a goal to selected tiles" })
    ).toBeInTheDocument()
  })

  it("forgets selected tiles that are no longer listed", () => {
    const { rerender } = renderView()
    fireEvent.click(checkbox("Fire cape"))
    fireEvent.click(checkbox("Nex"))

    rerender({ tiles: makeBoard().filter((tile) => tile.id !== "t6") })

    expect(screen.getByText("1 tile selected")).toBeInTheDocument()
  })
})

describe("GoalSetupView: apply a goal to the selected tiles", () => {
  const SUCCESS = {
    success: true,
    tilesUpdated: 2,
    goalsCreated: 2,
    groupsCreated: 0,
  }

  async function openApplyDialog(...titles: string[]) {
    for (const title of titles) fireEvent.click(checkbox(title))
    fireEvent.click(
      screen.getByRole("button", { name: "Apply a goal to selected tiles" })
    )
    const dialog = await screen.findByRole("dialog")
    return within(dialog)
  }

  async function stageTask(
    dialog: ReturnType<typeof within>,
    text = "Get a pet"
  ) {
    fireEvent.change(dialog.getByLabelText("Description"), {
      target: { value: text },
    })
    await clickAsync(dialog.getByRole("button", { name: "Add goal" }))
  }

  it("opens a dialog titled with the number of tiles, on the new goals tab", async () => {
    renderView()
    const dialog = await openApplyDialog("Dragon pickaxe", "Nex")
    expect(
      dialog.getByRole("heading", { name: "Apply a goal to 2 selected tiles" })
    ).toBeInTheDocument()
    expect(dialog.getByRole("tab", { name: "New goals" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(
      dialog.getByRole("search", { name: "Add a goal" })
    ).toBeInTheDocument()
  })

  it("collects goals first: nothing is sent while adding", async () => {
    renderView()
    const dialog = await openApplyDialog("Dragon pickaxe", "Nex")
    await stageTask(dialog, "Get a pet")

    expect(
      within(dialog.getByRole("list", { name: "Goals to add" })).getByText(
        "Get a pet x1"
      )
    ).toBeInTheDocument()
    expect(mockedApply).not.toHaveBeenCalled()
    expect(mockedCreateGoals).not.toHaveBeenCalled()
  })

  it("lets a collected goal be removed", async () => {
    renderView()
    const dialog = await openApplyDialog("Nex")
    await stageTask(dialog, "Get a pet")

    fireEvent.click(dialog.getByRole("button", { name: "Remove Get a pet x1" }))

    expect(
      dialog.queryByRole("list", { name: "Goals to add" })
    ).not.toBeInTheDocument()
  })

  it("asks for a goal before reviewing", async () => {
    renderView()
    const dialog = await openApplyDialog("Nex")
    fireEvent.click(dialog.getByRole("button", { name: "Review" }))
    expect(dialog.getByRole("alert")).toHaveTextContent(
      "Add at least one goal first."
    )
    expect(dialog.queryByText(/Check before adding/)).not.toBeInTheDocument()
  })

  it("states exactly what will be added to how many tiles before applying", async () => {
    renderView()
    const dialog = await openApplyDialog("Dragon pickaxe", "Nex")
    await stageTask(dialog, "Get a pet")
    await stageTask(dialog, "Do a raid")

    fireEvent.click(dialog.getByRole("button", { name: "Review" }))

    expect(
      dialog.getByText("Add 2 goals to each of 2 tiles (4 new goals in total).")
    ).toBeInTheDocument()
    const goalList = dialog.getByRole("list", { name: "Goals to add" })
    expect(
      within(goalList)
        .getAllByRole("listitem")
        .map((i) => i.textContent)
    ).toEqual(["Get a pet x1", "Do a raid x1"])
    const tileList = dialog.getByRole("list", {
      name: "Tiles that will change",
    })
    expect(
      within(tileList)
        .getAllByRole("listitem")
        .map((i) => i.textContent)
    ).toEqual(["3. Dragon pickaxe", "6. Nex"])
    expect(
      dialog.getByText("None of these tiles has goals yet.")
    ).toBeInTheDocument()
    expect(mockedApply).not.toHaveBeenCalled()
  })

  it("says existing goals stay when a selected tile already has some", async () => {
    renderView()
    const dialog = await openApplyDialog("Fire cape", "Nex")
    await stageTask(dialog)

    fireEvent.click(dialog.getByRole("button", { name: "Review" }))

    expect(
      dialog.getByText(
        "1 of these tiles already has goals. They keep them; the new goals are added after them. Nothing is replaced or removed."
      )
    ).toBeInTheDocument()
  })

  it("sends the tiles in board order with the goals and reports the result", async () => {
    mockedApply.mockResolvedValue(SUCCESS)
    const { onRefresh } = renderView()
    // Select out of order: the request still lists tiles in board order.
    fireEvent.click(checkbox("Nex"))
    fireEvent.click(checkbox("Dragon pickaxe"))
    fireEvent.click(
      screen.getByRole("button", { name: "Apply a goal to selected tiles" })
    )
    const dialog = within(await screen.findByRole("dialog"))
    await stageTask(dialog, "Get a pet")
    fireEvent.click(dialog.getByRole("button", { name: "Review" }))

    await clickAsync(dialog.getByRole("button", { name: "Add to 2 tiles" }))

    expect(mockedApply).toHaveBeenCalledTimes(1)
    expect(mockedApply).toHaveBeenCalledWith("bingo-1", ["t3", "t6"], {
      kind: "goals",
      goals: [{ type: "generic", description: "Get a pet", targetValue: 1 }],
    })
    expect(
      await dialog.findByText("Created 2 goals on 2 tiles.")
    ).toBeInTheDocument()
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it("clears the selection once applied and closes with Done", async () => {
    mockedApply.mockResolvedValue(SUCCESS)
    renderView()
    const dialog = await openApplyDialog("Dragon pickaxe", "Nex")
    await stageTask(dialog)
    fireEvent.click(dialog.getByRole("button", { name: "Review" }))
    await clickAsync(dialog.getByRole("button", { name: "Add to 2 tiles" }))

    fireEvent.click(await dialog.findByRole("button", { name: "Done" }))

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(screen.queryByText(/tiles? selected/)).not.toBeInTheDocument()
    expect(checkbox("Nex")).not.toBeChecked()
  })

  it("shows a pending state while the server works and blocks a second click", async () => {
    const pending = deferred<unknown>()
    mockedApply.mockReturnValue(pending.promise)
    renderView()
    const dialog = await openApplyDialog("Dragon pickaxe", "Nex")
    await stageTask(dialog)
    fireEvent.click(dialog.getByRole("button", { name: "Review" }))

    await clickAsync(dialog.getByRole("button", { name: "Add to 2 tiles" }))

    const busy = dialog.getByRole("button", { name: "Adding..." })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute("aria-busy", "true")
    expect(dialog.getByRole("button", { name: "Back" })).toBeDisabled()
    fireEvent.click(busy)
    expect(mockedApply).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(SUCCESS)
    })
    expect(
      await dialog.findByText("Created 2 goals on 2 tiles.")
    ).toBeInTheDocument()
  })

  describe("when the server refuses", () => {
    async function applyAndFail(
      error = "Some of the selected tiles are not on this board"
    ) {
      mockedApply.mockResolvedValue({ success: false, error })
      const view = renderView()
      const dialog = await openApplyDialog("Dragon pickaxe", "Nex")
      await stageTask(dialog)
      fireEvent.click(dialog.getByRole("button", { name: "Review" }))
      await clickAsync(dialog.getByRole("button", { name: "Add to 2 tiles" }))
      return { dialog, ...view }
    }

    it("says nothing was changed and stays on the check step", async () => {
      const { dialog } = await applyAndFail()

      expect(dialog.getByRole("alert")).toHaveTextContent(
        "Nothing was changed. Some of the selected tiles are not on this board"
      )
      expect(
        dialog.getByRole("button", { name: "Add to 2 tiles" })
      ).toBeEnabled()
      expect(dialog.queryByText(/Created/)).not.toBeInTheDocument()
    })

    it("does not refresh the page and keeps the selection", async () => {
      const { dialog, onRefresh } = await applyAndFail()
      expect(onRefresh).not.toHaveBeenCalled()

      fireEvent.click(dialog.getByRole("button", { name: "Back" }))
      fireEvent.click(dialog.getByRole("button", { name: "Cancel" }))
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      )

      expect(screen.getByText("2 tiles selected")).toBeInTheDocument()
      expect(checkbox("Nex")).toBeChecked()
      expect(within(row("Nex")).getByText("No goals yet")).toBeInTheDocument()
    })

    it("can be tried again", async () => {
      const { dialog } = await applyAndFail()
      mockedApply.mockResolvedValue(SUCCESS)

      await clickAsync(dialog.getByRole("button", { name: "Add to 2 tiles" }))

      expect(
        await dialog.findByText("Created 2 goals on 2 tiles.")
      ).toBeInTheDocument()
      expect(mockedApply).toHaveBeenCalledTimes(2)
    })

    it("keeps the collected goals when going back", async () => {
      const { dialog } = await applyAndFail()
      fireEvent.click(dialog.getByRole("button", { name: "Back" }))
      expect(
        within(dialog.getByRole("list", { name: "Goals to add" })).getByText(
          "Get a pet x1"
        )
      ).toBeInTheDocument()
      expect(dialog.queryByRole("alert")).not.toBeInTheDocument()
    })
  })

  it("reports an unreachable server without throwing", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation()
    mockedApply.mockRejectedValue(new Error("network down"))
    renderView()
    const dialog = await openApplyDialog("Nex")
    await stageTask(dialog)
    fireEvent.click(dialog.getByRole("button", { name: "Review" }))

    await clickAsync(dialog.getByRole("button", { name: "Add to 1 tile" }))

    expect(dialog.getByRole("alert")).toHaveTextContent(
      "Nothing was changed. Could not reach the server."
    )
    consoleError.mockRestore()
  })

  it("applies a copy of one tile's goals to all selected tiles", async () => {
    mockedApply.mockResolvedValue({
      success: true,
      tilesUpdated: 2,
      goalsCreated: 6,
      groupsCreated: 2,
    })
    renderView()
    const dialog = await openApplyDialog("Dragon pickaxe", "Nex")
    fireEvent.mouseDown(
      dialog.getByRole("tab", { name: "Copy a tile's goals" }),
      {
        button: 0,
      }
    )
    fireEvent.click(await dialog.findByRole("option", { name: /Zulrah/ }))
    fireEvent.click(dialog.getByRole("button", { name: "Review" }))

    expect(
      dialog.getByText(
        "Copy the goals of Zulrah (tile 2) to each of 2 tiles: 3 goals and 1 group per tile (6 goals and 2 groups in total)."
      )
    ).toBeInTheDocument()

    await clickAsync(dialog.getByRole("button", { name: "Add to 2 tiles" }))

    expect(mockedApply).toHaveBeenCalledWith("bingo-1", ["t3", "t6"], {
      kind: "copy",
      sourceTileId: "t2",
    })
    expect(
      await dialog.findByText("Created 6 goals and 2 groups on 2 tiles.")
    ).toBeInTheDocument()
  })

  it("does not offer a selected tile as the copy source", async () => {
    renderView()
    const dialog = await openApplyDialog("Fire cape", "Nex")
    fireEvent.mouseDown(
      dialog.getByRole("tab", { name: "Copy a tile's goals" }),
      {
        button: 0,
      }
    )
    const options = await dialog.findAllByRole("option")
    expect(options.map((o) => o.textContent)).toEqual([
      "2Zulrah3 goals",
      "4Chambers purple1 goal",
    ])
  })
})

describe("GoalSetupView: copy goals from another tile", () => {
  async function openCopyDialog(title: string) {
    fireEvent.click(
      screen.getByRole("button", {
        name: `Copy goals to ${title} from another tile`,
      })
    )
    return within(await screen.findByRole("dialog"))
  }

  it("opens a copy-only dialog for that tile", async () => {
    renderView()
    const dialog = await openCopyDialog("Dragon pickaxe")
    expect(
      dialog.getByRole("heading", { name: "Copy goals to Dragon pickaxe" })
    ).toBeInTheDocument()
    expect(dialog.queryByRole("tab")).not.toBeInTheDocument()
    expect(
      dialog.getByPlaceholderText("Search by name or number...")
    ).toBeInTheDocument()
  })

  it("lists only other tiles that have goals", async () => {
    renderView()
    const dialog = await openCopyDialog("Fire cape")
    const names = (await dialog.findAllByRole("option")).map(
      (o) => o.textContent
    )
    expect(names).toEqual(["2Zulrah3 goals", "4Chambers purple1 goal"])
  })

  it("searches by title", async () => {
    renderView()
    const dialog = await openCopyDialog("Dragon pickaxe")
    fireEvent.change(
      dialog.getByPlaceholderText("Search by name or number..."),
      {
        target: { value: "cham" },
      }
    )
    const options = await dialog.findAllByRole("option")
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent("Chambers purple")
  })

  it("searches by position", async () => {
    renderView()
    const dialog = await openCopyDialog("Dragon pickaxe")
    fireEvent.change(
      dialog.getByPlaceholderText("Search by name or number..."),
      {
        target: { value: "4" },
      }
    )
    const options = await dialog.findAllByRole("option")
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent("Chambers purple")
  })

  it("says when nothing matches", async () => {
    renderView()
    const dialog = await openCopyDialog("Dragon pickaxe")
    fireEvent.change(
      dialog.getByPlaceholderText("Search by name or number..."),
      {
        target: { value: "zzz" },
      }
    )
    expect(
      await dialog.findByText("No tile with goals matches.")
    ).toBeInTheDocument()
  })

  it("previews the goals that will be copied, groups and targets included", async () => {
    renderView()
    const dialog = await openCopyDialog("Dragon pickaxe")

    fireEvent.click(await dialog.findByRole("option", { name: /Zulrah/ }))

    expect(
      dialog.getByText("Goals of Zulrah (tile 2): 3 goals and 1 group")
    ).toBeInTheDocument()
    expect(
      dialog.getByText(
        "Complete any 2 of: Zulrah kills, Tanzanite fang, Magic fang"
      )
    ).toBeInTheDocument()
    const preview = within(
      dialog.getByRole("group", {
        name: "Goals that will be copied from Zulrah",
      })
    )
    expect(preview.getByText("Any 2 of:")).toBeInTheDocument()
    expect(preview.getByText("Zulrah")).toBeInTheDocument()
    expect(preview.getByText("50 kills")).toBeInTheDocument()
    expect(preview.getByText("Tanzanite fang")).toBeInTheDocument()
    expect(preview.getByText("Magic fang")).toBeInTheDocument()
    expect(mockedApply).not.toHaveBeenCalled()
  })

  it("asks for a source before reviewing", async () => {
    renderView()
    const dialog = await openCopyDialog("Dragon pickaxe")
    fireEvent.click(dialog.getByRole("button", { name: "Review" }))
    expect(dialog.getByRole("alert")).toHaveTextContent(
      "Choose a tile to copy the goals from."
    )
  })

  it("appends: says a destination's existing goals are kept", async () => {
    renderView()
    const dialog = await openCopyDialog("Fire cape")
    fireEvent.click(await dialog.findByRole("option", { name: /Zulrah/ }))
    fireEvent.click(dialog.getByRole("button", { name: "Review" }))

    expect(
      dialog.getByText(
        "Copy the goals of Zulrah (tile 2) to 1 tile: 3 goals and 1 group."
      )
    ).toBeInTheDocument()
    expect(
      dialog.getByText(
        "This tile already has goals. They keep them; the new goals are added after them. Nothing is replaced or removed."
      )
    ).toBeInTheDocument()
  })

  it("offers no way to replace the destination's goals", async () => {
    renderView()
    const dialog = await openCopyDialog("Fire cape")
    fireEvent.click(await dialog.findByRole("option", { name: /Zulrah/ }))
    fireEvent.click(dialog.getByRole("button", { name: "Review" }))

    expect(
      dialog.queryByText(/replace goals|overwrite/i)
    ).not.toBeInTheDocument()
    expect(dialog.queryByRole("radio")).not.toBeInTheDocument()
    expect(dialog.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("copies after confirming, for that tile only", async () => {
    mockedApply.mockResolvedValue({
      success: true,
      tilesUpdated: 1,
      goalsCreated: 3,
      groupsCreated: 1,
    })
    const { onRefresh } = renderView()
    fireEvent.click(checkbox("Nex"))
    const dialog = await openCopyDialog("Dragon pickaxe")
    fireEvent.click(await dialog.findByRole("option", { name: /Zulrah/ }))
    fireEvent.click(dialog.getByRole("button", { name: "Review" }))

    await clickAsync(dialog.getByRole("button", { name: "Add to 1 tile" }))

    expect(mockedApply).toHaveBeenCalledWith("bingo-1", ["t3"], {
      kind: "copy",
      sourceTileId: "t2",
    })
    expect(
      await dialog.findByText("Created 3 goals and 1 group on 1 tile.")
    ).toBeInTheDocument()
    expect(onRefresh).toHaveBeenCalledTimes(1)
    // A copy to one row does not touch the checkbox selection.
    fireEvent.click(await dialog.findByRole("button", { name: "Done" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(checkbox("Nex")).toBeChecked()
  })

  it("leaves everything as it was when the copy fails", async () => {
    mockedApply.mockResolvedValue({
      success: false,
      error: "The source tile has no goals to copy",
    })
    const { onRefresh } = renderView()
    const dialog = await openCopyDialog("Dragon pickaxe")
    fireEvent.click(await dialog.findByRole("option", { name: /Zulrah/ }))
    fireEvent.click(dialog.getByRole("button", { name: "Review" }))

    await clickAsync(dialog.getByRole("button", { name: "Add to 1 tile" }))

    expect(dialog.getByRole("alert")).toHaveTextContent(
      "Nothing was changed. The source tile has no goals to copy"
    )
    expect(onRefresh).not.toHaveBeenCalled()

    fireEvent.click(dialog.getByRole("button", { name: "Close" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(
      within(row("Dragon pickaxe")).getByText("No goals yet")
    ).toBeInTheDocument()
  })

  it("closes without changing anything on Cancel", async () => {
    renderView()
    const dialog = await openCopyDialog("Dragon pickaxe")
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(mockedApply).not.toHaveBeenCalled()
  })
})
