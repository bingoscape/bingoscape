import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { AddGoalDrawer } from "@/components/goals/add-goal-drawer"
import "./dom-polyfills"
import { addGoal, createGoals, createMetricGoal } from "@/app/actions/bingo"
import { resolveOsrsItemNames, searchOsrsItems } from "@/app/actions/osrs-items"
import { toast } from "@/hooks/use-toast"
import {
  ABYSSAL_TENTACLE,
  ABYSSAL_WHIP,
  DRAGON_DAGGER_P,
  searchFixtureItems,
} from "./item-fixtures"

jest.mock("@/app/actions/bingo", () => ({
  addGoal: jest.fn(),
  createGoals: jest.fn(),
  createMetricGoal: jest.fn(),
}))
jest.mock("@/app/actions/osrs-items", () => ({
  searchOsrsItems: jest.fn(),
  resolveOsrsItemNames: jest.fn(),
}))
jest.mock("@/hooks/use-toast", () => ({ toast: jest.fn() }))

const mockedAddGoal = addGoal as jest.Mock
const mockedCreateGoals = createGoals as jest.Mock
const mockedCreateMetricGoal = createMetricGoal as jest.Mock
const mockedSearch = searchOsrsItems as jest.MockedFunction<
  typeof searchOsrsItems
>
const mockedResolve = resolveOsrsItemNames as jest.MockedFunction<
  typeof resolveOsrsItemNames
>
const mockedToast = toast as jest.Mock

function renderDrawer(
  props: Partial<React.ComponentProps<typeof AddGoalDrawer>> = {}
) {
  const onOpenChange = jest.fn()
  const onRefresh = jest.fn()
  const utils = render(
    <AddGoalDrawer
      open
      onOpenChange={onOpenChange}
      tileId="t1"
      parentGroupId={null}
      onRefresh={onRefresh}
      womLinked
      {...props}
    />
  )
  return { onOpenChange, onRefresh, ...utils }
}

const submit = () =>
  fireEvent.click(
    screen.getByRole("button", {
      name: /^add (\d+ goals?|goals|goal|xp \/ kills goal)$/i,
    })
  )

const searchField = () =>
  screen.getByRole("combobox", { name: "Search items" }) as HTMLInputElement

/** Searches for an item and picks the result, waiting for the debounced search. */
async function pickItem(query: string, optionName: string) {
  fireEvent.change(searchField(), { target: { value: query } })
  fireEvent.click(
    await screen.findByRole("option", { name: optionName }, { timeout: 2000 })
  )
}

const quantityInput = (itemName: string) =>
  screen.getByRole("textbox", {
    name: `Quantity of ${itemName}`,
  }) as HTMLInputElement

const skillRadios = () =>
  within(screen.getByRole("radiogroup", { name: "Skill" })).getAllByRole(
    "radio"
  )

describe("AddGoalDrawer", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedSearch.mockImplementation(async (query) => searchFixtureItems(query))
  })

  it("has a description, so Radix does not warn about a missing one", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined)
    renderDrawer()

    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      /press done/i
    )
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("Missing `Description`")
    )
    warn.mockRestore()
  })

  it("starts on the Item type with the item search focused", () => {
    renderDrawer()

    expect(screen.getByRole("radio", { name: "Item" })).toBeChecked()
    expect(searchField()).toHaveFocus()
  })

  it("focuses the first field of the chosen type", () => {
    renderDrawer()

    fireEvent.click(screen.getByRole("radio", { name: "Other" }))
    expect(screen.getByLabelText("Description")).toHaveFocus()

    fireEvent.click(screen.getByRole("radio", { name: "XP / Kills" }))
    expect(screen.getByRole("radio", { name: "Overall" })).toHaveFocus()
  })

  describe("type radio group", () => {
    it("is a labelled radiogroup with one checked radio", () => {
      renderDrawer()

      const group = screen.getByRole("radiogroup", { name: "Goal type" })
      const radios = within(group).getAllByRole("radio")
      expect(radios).toHaveLength(3)
      expect(
        radios.filter((r) => r.getAttribute("aria-checked") === "true")
      ).toHaveLength(1)
    })

    it("moves focus and selection with the arrow keys", async () => {
      renderDrawer()
      const item = screen.getByRole("radio", { name: "Item" })
      act(() => item.focus())

      // Radix moves focus on the next tick, and selection follows focus.
      fireEvent.keyDown(item, { key: "ArrowRight" })
      await waitFor(() =>
        expect(screen.getByRole("radio", { name: "XP / Kills" })).toBeChecked()
      )
      // The new form must not steal focus from the radio group.
      expect(screen.getByRole("radio", { name: "XP / Kills" })).toHaveFocus()

      fireEvent.keyDown(screen.getByRole("radio", { name: "XP / Kills" }), {
        key: "ArrowRight",
      })
      await waitFor(() =>
        expect(screen.getByRole("radio", { name: "Other" })).toBeChecked()
      )

      fireEvent.keyDown(screen.getByRole("radio", { name: "Other" }), {
        key: "ArrowLeft",
      })
      await waitFor(() =>
        expect(screen.getByRole("radio", { name: "XP / Kills" })).toBeChecked()
      )
    })
  })

  describe("adding several goals in a row", () => {
    it("keeps the drawer open and the type, clears the fields and lists what was added", async () => {
      mockedAddGoal.mockResolvedValue({ success: true, goal: {} })
      const { onOpenChange, onRefresh } = renderDrawer({ parentGroupId: "g1" })

      fireEvent.click(screen.getByRole("radio", { name: "Other" }))
      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "Complete a raid" },
      })
      fireEvent.change(screen.getByLabelText("Target"), {
        target: { value: "2" },
      })
      submit()

      await waitFor(() =>
        expect(screen.getByText("Complete a raid x2")).toBeInTheDocument()
      )
      expect(mockedAddGoal).toHaveBeenCalledWith("t1", {
        description: "Complete a raid",
        targetValue: 2,
        parentGroupId: "g1",
      })
      expect(onRefresh).toHaveBeenCalledTimes(1)
      expect(onOpenChange).not.toHaveBeenCalled()
      expect(screen.getByRole("radio", { name: "Other" })).toBeChecked()
      expect(screen.getByLabelText("Description")).toHaveValue("")
      expect(screen.getByLabelText("Description")).toHaveFocus()
      expect(screen.getByText(/Add New Goal to Group/)).toBeInTheDocument()
    })

    it("adds item goals, stays open on Item and lists them most recent first, capped", async () => {
      mockedCreateGoals.mockResolvedValue({ success: true, goals: [{}] })
      const { onOpenChange } = renderDrawer()

      for (let i = 1; i <= 4; i++) {
        await pickItem("whip", "Abyssal whip")
        fireEvent.change(quantityInput("Abyssal whip"), {
          target: { value: String(i) },
        })
        submit()
        await waitFor(() =>
          expect(screen.getByText(`Abyssal whip x${i}`)).toBeInTheDocument()
        )
      }

      const status = screen.getByRole("status", { name: "Added goals" })
      const entries = within(status).getAllByRole("listitem")
      expect(entries.map((e) => e.textContent)).toEqual([
        "Abyssal whip x4",
        "Abyssal whip x3",
        "Abyssal whip x2",
      ])
      expect(onOpenChange).not.toHaveBeenCalled()
      expect(screen.getByRole("radio", { name: "Item" })).toBeChecked()
      // The selection is gone and the search is empty and focused again.
      expect(
        screen.queryByRole("heading", { name: /Selected/ })
      ).not.toBeInTheDocument()
      expect(searchField()).toHaveValue("")
      expect(searchField()).toHaveFocus()
      expect(screen.getByRole("button", { name: "Add goals" })).toBeDisabled()
    }, 15000)

    it("creates every picked item as its own goal with its own quantity", async () => {
      mockedCreateGoals.mockResolvedValue({ success: true, goals: [{}, {}] })
      renderDrawer({ parentGroupId: "g1" })

      await pickItem("whip", "Abyssal whip")
      await pickItem("tentacle", "Abyssal tentacle")
      fireEvent.change(quantityInput("Abyssal whip"), {
        target: { value: "2" },
      })
      fireEvent.change(quantityInput("Abyssal tentacle"), {
        target: { value: "500k" },
      })
      expect(screen.getByRole("button", { name: "Add 2 goals" })).toBeEnabled()
      submit()

      await waitFor(() =>
        expect(screen.getByText("Abyssal whip x2")).toBeInTheDocument()
      )
      expect(screen.getByText("Abyssal tentacle x500,000")).toBeInTheDocument()
      expect(mockedCreateGoals).toHaveBeenCalledTimes(1)
      expect(mockedCreateGoals).toHaveBeenCalledWith(
        "t1",
        [
          {
            type: "item",
            itemId: 4151,
            itemName: "Abyssal whip",
            baseName: "Abyssal whip",
            imageUrl: ABYSSAL_WHIP.imageUrl,
            targetValue: 2,
            exactVariant: null,
          },
          {
            type: "item",
            itemId: 12006,
            itemName: "Abyssal tentacle",
            baseName: "Abyssal tentacle",
            imageUrl: ABYSSAL_TENTACLE.imageUrl,
            targetValue: 500_000,
            exactVariant: null,
          },
        ],
        { parentGroupId: "g1" }
      )
    })

    it("adds a variant with its base name, variant and first item id", async () => {
      mockedCreateGoals.mockResolvedValue({ success: true, goals: [{}] })
      renderDrawer()

      await pickItem("dragon dagger", "Dragon dagger (p)")
      submit()

      await waitFor(() =>
        expect(screen.getByText("Dragon dagger (p) x1")).toBeInTheDocument()
      )
      expect(mockedCreateGoals).toHaveBeenCalledWith(
        "t1",
        [
          expect.objectContaining({
            itemId: 1231,
            itemName: "Dragon dagger#(p)",
            baseName: "Dragon dagger",
            exactVariant: "(p)",
            targetValue: 1,
          }),
        ],
        { parentGroupId: null }
      )
    })

    it("lets the same item be added again in a later add", async () => {
      mockedCreateGoals.mockResolvedValue({ success: true, goals: [{}] })
      renderDrawer()

      await pickItem("whip", "Abyssal whip")
      submit()
      await waitFor(() =>
        expect(screen.getByText("Abyssal whip x1")).toBeInTheDocument()
      )
      await pickItem("whip", "Abyssal whip")
      submit()

      await waitFor(() => expect(mockedCreateGoals).toHaveBeenCalledTimes(2))
    })

    it("keeps the selection and quantities when the server rejects the goals", async () => {
      mockedCreateGoals.mockResolvedValue({ success: false, error: "Nope" })
      renderDrawer()

      await pickItem("whip", "Abyssal whip")
      fireEvent.change(quantityInput("Abyssal whip"), {
        target: { value: "3" },
      })
      submit()

      await waitFor(() => expect(mockedCreateGoals).toHaveBeenCalled())
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Add 1 goal" })).toBeEnabled()
      )
      expect(quantityInput("Abyssal whip")).toHaveValue("3")
      expect(screen.queryByText("Abyssal whip x3")).not.toBeInTheDocument()
    })

    it("adds an XP goal with shorthand and keeps the XP / Kills type", async () => {
      mockedCreateMetricGoal.mockResolvedValue({ success: true, goal: {} })
      const { onOpenChange } = renderDrawer()

      fireEvent.click(screen.getByRole("radio", { name: "XP / Kills" }))
      fireEvent.click(screen.getByRole("radio", { name: "Woodcutting" }))
      fireEvent.change(screen.getByLabelText("XP to gain"), {
        target: { value: "2.5m" },
      })
      submit()

      await waitFor(() =>
        expect(
          screen.getByText("Woodcutting: 2,500,000 XP")
        ).toBeInTheDocument()
      )
      expect(mockedCreateMetricGoal).toHaveBeenCalledWith(
        "t1",
        "skill",
        "woodcutting",
        2_500_000,
        undefined,
        null
      )
      expect(onOpenChange).not.toHaveBeenCalled()
      expect(screen.getByRole("radio", { name: "XP / Kills" })).toBeChecked()
      expect(screen.getByLabelText("XP to gain")).toHaveValue("")
      // The skill is cleared for the next goal.
      expect(
        skillRadios().filter((r) => r.getAttribute("aria-checked") === "true")
      ).toHaveLength(0)
    })

    it("adds a boss goal picked from the searchable list and keeps the Boss type", async () => {
      mockedCreateMetricGoal.mockResolvedValue({ success: true, goal: {} })
      renderDrawer()

      fireEvent.click(screen.getByRole("radio", { name: "XP / Kills" }))
      fireEvent.click(screen.getByRole("radio", { name: "Boss" }))
      fireEvent.change(
        screen.getByRole("combobox", { name: "Search bosses" }),
        { target: { value: "zulrah" } }
      )
      fireEvent.click(await screen.findByRole("option", { name: "Zulrah" }))
      fireEvent.change(screen.getByLabelText("Kills"), {
        target: { value: "25" },
      })
      submit()

      await waitFor(() =>
        expect(screen.getByText("Zulrah: 25 kills")).toBeInTheDocument()
      )
      expect(mockedCreateMetricGoal).toHaveBeenCalledWith(
        "t1",
        "boss",
        "zulrah",
        25,
        undefined,
        null
      )
      expect(screen.getByRole("radio", { name: "Boss" })).toBeChecked()
      // Back to the search for the next boss.
      expect(
        screen.getByRole("combobox", { name: "Search bosses" })
      ).toBeInTheDocument()
    })

    it("closes with Done", async () => {
      const { onOpenChange } = renderDrawer()

      fireEvent.click(screen.getByRole("button", { name: "Done" }))

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it("keeps the form and shows an error when the server rejects the goal", async () => {
      mockedAddGoal.mockResolvedValue({ success: false, error: "Nope" })
      renderDrawer()

      fireEvent.click(screen.getByRole("radio", { name: "Other" }))
      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "Task" },
      })
      submit()

      await waitFor(() => expect(mockedAddGoal).toHaveBeenCalled())
      expect(screen.getByLabelText("Description")).toHaveValue("Task")
      expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
    })
  })

  describe("submitting", () => {
    it("submits with Enter in a field when the form is valid", async () => {
      mockedAddGoal.mockResolvedValue({ success: true, goal: {} })
      renderDrawer()
      fireEvent.click(screen.getByRole("radio", { name: "Other" }))
      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "Task" },
      })

      fireEvent.submit(screen.getByLabelText("Description").closest("form")!)

      await waitFor(() => expect(mockedAddGoal).toHaveBeenCalledTimes(1))
    })

    it("does not submit an invalid form and says why", () => {
      renderDrawer()
      fireEvent.click(screen.getByRole("radio", { name: "Other" }))
      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "Task" },
      })
      fireEvent.change(screen.getByLabelText("Target"), {
        target: { value: "0" },
      })

      fireEvent.submit(screen.getByLabelText("Description").closest("form")!)

      expect(mockedAddGoal).not.toHaveBeenCalled()
      const button = screen.getByRole("button", { name: /^add goal$/i })
      expect(button).toBeDisabled()
      expect(button).toHaveAccessibleDescription(/greater than 0/i)
    })

    it("explains why Add is disabled for each type", () => {
      renderDrawer()
      expect(
        screen.getByText("Select at least one item to add.")
      ).toBeInTheDocument()

      expect(screen.getByRole("button", { name: "Add goals" })).toBeDisabled()

      fireEvent.click(screen.getByRole("radio", { name: "XP / Kills" }))
      expect(screen.getByText("Select a skill to add.")).toBeInTheDocument()

      fireEvent.click(screen.getByRole("radio", { name: "Boss" }))
      expect(screen.getByText("Select a boss to add.")).toBeInTheDocument()

      fireEvent.click(screen.getByRole("radio", { name: "Activity" }))
      expect(screen.getByText("Select an activity to add.")).toBeInTheDocument()

      fireEvent.click(screen.getByRole("radio", { name: "Other" }))
      expect(
        screen.getByText("Enter a description to add this goal.")
      ).toBeInTheDocument()
    })
  })

  describe("item quantities", () => {
    it("blocks Add for an invalid quantity and names the item and the problem", async () => {
      renderDrawer()
      await pickItem("whip", "Abyssal whip")
      await pickItem("tentacle", "Abyssal tentacle")

      fireEvent.change(quantityInput("Abyssal tentacle"), {
        target: { value: "0" },
      })

      const button = screen.getByRole("button", { name: "Add 2 goals" })
      expect(button).toBeDisabled()
      expect(button).toHaveAccessibleDescription(
        /Quantity for Abyssal tentacle: .*greater than 0/i
      )
      fireEvent.submit(searchField().closest("form")!)
      expect(mockedCreateGoals).not.toHaveBeenCalled()
    })

    it("enables Add again once the quantity is fixed", async () => {
      renderDrawer()
      await pickItem("whip", "Abyssal whip")
      fireEvent.change(quantityInput("Abyssal whip"), { target: { value: "" } })
      expect(screen.getByRole("button", { name: "Add 1 goal" })).toBeDisabled()

      fireEvent.change(quantityInput("Abyssal whip"), {
        target: { value: "2k" },
      })

      expect(screen.getByRole("button", { name: "Add 1 goal" })).toBeEnabled()
    })

    it("says how many goals Add will create", async () => {
      renderDrawer()
      expect(screen.getByRole("button", { name: "Add goals" })).toBeDisabled()

      await pickItem("whip", "Abyssal whip")
      expect(screen.getByRole("button", { name: "Add 1 goal" })).toBeEnabled()

      await pickItem("tentacle", "Abyssal tentacle")
      expect(screen.getByRole("button", { name: "Add 2 goals" })).toBeEnabled()
    })
  })

  describe("How should these count?", () => {
    const heading = () => screen.getByText("How should these count?")
    const queryHeading = () => screen.queryByText("How should these count?")
    const option = (name: string) => screen.getByRole("radio", { name })
    const atLeastField = () =>
      screen.getByRole("textbox", { name: "At least" }) as HTMLInputElement
    const addButton = (name: string | RegExp) =>
      screen.getByRole("button", { name })

    /** Selects whip, tentacle and dagger (p): three items. */
    async function pickThree() {
      await pickItem("whip", "Abyssal whip")
      await pickItem("tentacle", "Abyssal tentacle")
      await pickItem("dragon dagger", "Dragon dagger (p)")
    }

    /** The options passed to the first createGoals call. */
    const createOptions = () => mockedCreateGoals.mock.calls[0]![2]

    it("is hidden with no or one selected item and shown from two", async () => {
      renderDrawer()
      expect(queryHeading()).not.toBeInTheDocument()

      await pickItem("whip", "Abyssal whip")
      expect(queryHeading()).not.toBeInTheDocument()
      expect(
        screen.queryByRole("radiogroup", { name: "How should these count?" })
      ).not.toBeInTheDocument()

      await pickItem("tentacle", "Abyssal tentacle")
      expect(heading()).toBeInTheDocument()
      const group = screen.getByRole("radiogroup", {
        name: "How should these count?",
      })
      expect(
        within(group)
          .getAllByRole("radio")
          .map((radio) => radio.textContent)
      ).toEqual([
        "Separate goals",
        "All of these",
        "Any one of these",
        "At least N of these",
      ])
    })

    it("hides again when the selection drops back to one item", async () => {
      renderDrawer()
      await pickItem("whip", "Abyssal whip")
      await pickItem("tentacle", "Abyssal tentacle")
      expect(heading()).toBeInTheDocument()

      fireEvent.click(
        screen.getByRole("button", { name: "Remove Abyssal tentacle" })
      )

      expect(queryHeading()).not.toBeInTheDocument()
      expect(addButton("Add 1 goal")).toBeEnabled()
    })

    it("preselects separate goals, so the common case costs no extra click", async () => {
      renderDrawer({ parentGroupId: "g1" })
      await pickThree()

      expect(option("Separate goals")).toBeChecked()
      expect(option("All of these")).not.toBeChecked()
      expect(addButton("Add 3 goals")).toBeEnabled()
      submit()

      await waitFor(() => expect(mockedCreateGoals).toHaveBeenCalledTimes(1))
      expect(createOptions()).toEqual({ parentGroupId: "g1" })
      expect(createOptions()).not.toHaveProperty("group")
    })

    it("has touch targets of at least 44px on coarse pointers", async () => {
      renderDrawer()
      await pickThree()

      for (const radio of screen.getAllByRole("radio", {
        name: /Separate goals|All of these|Any one of these|At least N of these/,
      })) {
        expect(radio.className).toContain("pointer-coarse:min-h-11")
      }
    })

    it("moves the choice with the arrow keys", async () => {
      renderDrawer()
      await pickThree()
      const separate = option("Separate goals")
      act(() => separate.focus())

      fireEvent.keyDown(separate, { key: "ArrowRight" })

      await waitFor(() => expect(option("All of these")).toBeChecked())
    })

    it("adds all of them as an AND group", async () => {
      mockedCreateGoals.mockResolvedValue({
        success: true,
        goals: [{}, {}, {}],
      })
      renderDrawer()
      await pickThree()

      fireEvent.click(option("All of these"))
      expect(addButton("Add group: all 3")).toBeEnabled()
      fireEvent.click(addButton("Add group: all 3"))

      await waitFor(() => expect(mockedCreateGoals).toHaveBeenCalledTimes(1))
      expect(mockedCreateGoals).toHaveBeenCalledWith(
        "t1",
        [
          expect.objectContaining({ itemName: "Abyssal whip", targetValue: 1 }),
          expect.objectContaining({
            itemName: "Abyssal tentacle",
            targetValue: 1,
          }),
          expect.objectContaining({
            itemName: "Dragon dagger#(p)",
            targetValue: 1,
          }),
        ],
        { parentGroupId: null, group: { operator: "AND" } }
      )
    })

    it("adds any one of them as an OR group that needs 1", async () => {
      mockedCreateGoals.mockResolvedValue({
        success: true,
        goals: [{}, {}, {}],
      })
      renderDrawer()
      await pickThree()

      fireEvent.click(option("Any one of these"))
      fireEvent.click(addButton("Add group: any 1 of 3"))

      await waitFor(() => expect(mockedCreateGoals).toHaveBeenCalledTimes(1))
      expect(createOptions()).toEqual({
        parentGroupId: null,
        group: { operator: "OR", minRequiredGoals: 1 },
      })
    })

    it("adds at least N of them as an OR group that needs N", async () => {
      mockedCreateGoals.mockResolvedValue({
        success: true,
        goals: [{}, {}, {}],
      })
      renderDrawer()
      await pickThree()

      fireEvent.click(option("At least N of these"))
      expect(atLeastField()).toHaveValue("2")
      expect(addButton("Add group: any 2 of 3")).toBeEnabled()
      fireEvent.change(atLeastField(), { target: { value: "3" } })
      expect(addButton("Add group: any 3 of 3")).toBeEnabled()
      fireEvent.change(atLeastField(), { target: { value: "2" } })
      fireEvent.click(addButton("Add group: any 2 of 3"))

      await waitFor(() => expect(mockedCreateGoals).toHaveBeenCalledTimes(1))
      expect(createOptions()).toEqual({
        parentGroupId: null,
        group: { operator: "OR", minRequiredGoals: 2 },
      })
    })

    it("keeps each item's own quantity inside a group", async () => {
      mockedCreateGoals.mockResolvedValue({
        success: true,
        goals: [{}, {}, {}],
      })
      renderDrawer()
      await pickThree()
      fireEvent.change(quantityInput("Abyssal whip"), {
        target: { value: "2" },
      })
      fireEvent.change(quantityInput("Abyssal tentacle"), {
        target: { value: "500k" },
      })

      fireEvent.click(option("At least N of these"))
      fireEvent.click(addButton("Add group: any 2 of 3"))

      await waitFor(() => expect(mockedCreateGoals).toHaveBeenCalledTimes(1))
      const [, inputs, options] = mockedCreateGoals.mock.calls[0]!
      expect(inputs.map((i: { targetValue: number }) => i.targetValue)).toEqual(
        [2, 500_000, 1]
      )
      expect(options.group).toEqual({ operator: "OR", minRequiredGoals: 2 })
    })

    it("nests the group inside the parent group the drawer was opened for", async () => {
      mockedCreateGoals.mockResolvedValue({
        success: true,
        goals: [{}, {}, {}],
      })
      renderDrawer({ parentGroupId: "g1" })
      await pickThree()

      fireEvent.click(option("All of these"))
      fireEvent.click(addButton("Add group: all 3"))

      await waitFor(() => expect(mockedCreateGoals).toHaveBeenCalledTimes(1))
      expect(createOptions()).toEqual({
        parentGroupId: "g1",
        group: { operator: "AND" },
      })
    })

    describe("number for at least N", () => {
      async function openAtLeast() {
        renderDrawer()
        await pickThree()
        fireEvent.click(option("At least N of these"))
      }

      it.each([["0"], ["4"], [""], ["abc"], ["1.5"]])(
        "shows an inline error and blocks Add for %j",
        async (value) => {
          await openAtLeast()

          fireEvent.change(atLeastField(), { target: { value } })

          expect(screen.getByRole("alert")).toHaveTextContent(
            "Enter a number from 1 to 3"
          )
          expect(atLeastField()).toHaveAttribute("aria-invalid", "true")
          const button = addButton("Add group")
          expect(button).toBeDisabled()
          expect(button).toHaveAccessibleDescription(
            /At least N of these: Enter a number from 1 to 3/
          )
          fireEvent.submit(atLeastField().closest("form")!)
          expect(mockedCreateGoals).not.toHaveBeenCalled()
        }
      )

      it("enables Add again once N is fixed", async () => {
        await openAtLeast()
        fireEvent.change(atLeastField(), { target: { value: "9" } })
        expect(addButton("Add group")).toBeDisabled()

        fireEvent.change(atLeastField(), { target: { value: "1" } })

        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
        expect(atLeastField()).toHaveAttribute("aria-invalid", "false")
        expect(addButton("Add group: any 1 of 3")).toBeEnabled()
      })

      it("only checks N while at least N is the choice", async () => {
        await openAtLeast()
        fireEvent.change(atLeastField(), { target: { value: "9" } })
        expect(addButton("Add group")).toBeDisabled()

        fireEvent.click(option("All of these"))

        expect(addButton("Add group: all 3")).toBeEnabled()
      })

      it("lowers N when items are removed so it stays valid", async () => {
        await openAtLeast()
        fireEvent.change(atLeastField(), { target: { value: "3" } })
        expect(screen.getByText("of 3 items")).toBeInTheDocument()

        fireEvent.click(
          screen.getByRole("button", { name: "Remove Dragon dagger (p)" })
        )

        expect(atLeastField()).toHaveValue("2")
        expect(screen.getByText("of 2 items")).toBeInTheDocument()
        expect(addButton("Add group: any 2 of 2")).toBeEnabled()
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      })

      it("keeps N when items are added", async () => {
        await openAtLeast()
        fireEvent.change(atLeastField(), { target: { value: "3" } })
        fireEvent.click(
          screen.getByRole("button", { name: "Remove Abyssal whip" })
        )
        expect(atLeastField()).toHaveValue("2")

        await pickItem("whip", "Abyssal whip")

        expect(atLeastField()).toHaveValue("2")
        expect(addButton("Add group: any 2 of 3")).toBeEnabled()
      })

      it("does not drift while the first items are being picked", async () => {
        renderDrawer()
        await pickItem("whip", "Abyssal whip")
        await pickItem("tentacle", "Abyssal tentacle")

        fireEvent.click(option("At least N of these"))

        expect(atLeastField()).toHaveValue("2")
      })
    })

    describe("preview", () => {
      const preview = (text: string) => screen.getByText(text)

      it("says what each choice means in plain language", async () => {
        renderDrawer()
        await pickThree()
        const names = "Abyssal whip, Abyssal tentacle, Dragon dagger (p)"

        expect(
          preview(`Each item is its own goal; the tile needs all of: ${names}`)
        ).toBeInTheDocument()

        fireEvent.click(option("All of these"))
        expect(preview(`Tile needs all of: ${names}`)).toBeInTheDocument()

        fireEvent.click(option("Any one of these"))
        expect(preview(`Tile needs any 1 of: ${names}`)).toBeInTheDocument()

        fireEvent.click(option("At least N of these"))
        expect(preview(`Tile needs any 2 of: ${names}`)).toBeInTheDocument()
        fireEvent.change(atLeastField(), { target: { value: "3" } })
        expect(preview(`Tile needs any 3 of: ${names}`)).toBeInTheDocument()
      })

      it("shows a quantity above one", async () => {
        renderDrawer()
        await pickThree()
        fireEvent.change(quantityInput("Abyssal whip"), {
          target: { value: "100" },
        })

        fireEvent.click(option("All of these"))

        expect(
          preview(
            "Tile needs all of: Abyssal whip x100, Abyssal tentacle, Dragon dagger (p)"
          )
        ).toBeInTheDocument()
      })

      it("talks about the new group when adding into a group", async () => {
        renderDrawer({ parentGroupId: "g1" })
        await pickThree()

        fireEvent.click(option("All of these"))

        expect(
          preview(
            "The new group needs all of: Abyssal whip, Abyssal tentacle, Dragon dagger (p)"
          )
        ).toBeInTheDocument()
      })

      it("counts instead of lists more than three items", async () => {
        renderDrawer()
        await pickThree()
        mockedSearch.mockResolvedValue({
          success: true,
          items: [{ ...ABYSSAL_WHIP, id: 1, name: "Extra item" }],
        })
        await pickItem("extra", "Extra item")

        fireEvent.click(option("All of these"))

        expect(preview("Tile needs all of: 4 items")).toBeInTheDocument()
      })
    })

    describe("after adding", () => {
      it("says what was added as a group and resets to separate goals", async () => {
        mockedCreateGoals.mockResolvedValue({
          success: true,
          goals: [{}, {}, {}],
        })
        renderDrawer()
        await pickThree()
        fireEvent.click(option("Any one of these"))
        fireEvent.click(addButton("Add group: any 1 of 3"))

        await waitFor(() =>
          expect(
            screen.getByText(
              "Group: any 1 of 3 (Abyssal whip x1, Abyssal tentacle x1, Dragon dagger (p) x1)"
            )
          ).toBeInTheDocument()
        )
        // The selection is empty and the choice is hidden...
        expect(queryHeading()).not.toBeInTheDocument()
        expect(addButton("Add goals")).toBeDisabled()

        // ...and the next batch starts from separate goals again.
        await pickItem("whip", "Abyssal whip")
        await pickItem("tentacle", "Abyssal tentacle")
        expect(option("Separate goals")).toBeChecked()
        expect(addButton("Add 2 goals")).toBeEnabled()
      })

      it("resets N as well", async () => {
        mockedCreateGoals.mockResolvedValue({
          success: true,
          goals: [{}, {}, {}],
        })
        renderDrawer()
        await pickThree()
        fireEvent.click(option("At least N of these"))
        fireEvent.change(atLeastField(), { target: { value: "3" } })
        fireEvent.click(addButton("Add group: any 3 of 3"))
        await waitFor(() => expect(mockedCreateGoals).toHaveBeenCalled())
        await waitFor(() => expect(queryHeading()).not.toBeInTheDocument())

        await pickItem("whip", "Abyssal whip")
        await pickItem("tentacle", "Abyssal tentacle")
        fireEvent.click(option("At least N of these"))

        expect(atLeastField()).toHaveValue("2")
      })

      it("lists separate goals one by one, as before", async () => {
        mockedCreateGoals.mockResolvedValue({ success: true, goals: [{}, {}] })
        renderDrawer()
        await pickItem("whip", "Abyssal whip")
        await pickItem("tentacle", "Abyssal tentacle")
        submit()

        await waitFor(() =>
          expect(screen.getByText("Abyssal whip x1")).toBeInTheDocument()
        )
        expect(screen.getByText("Abyssal tentacle x1")).toBeInTheDocument()
        expect(screen.queryByText(/^Group:/)).not.toBeInTheDocument()
      })

      it("keeps the selection and the choice when the server rejects the group, and shows its error", async () => {
        mockedCreateGoals.mockResolvedValue({
          success: false,
          error: "Goal 2: Nope",
        })
        renderDrawer()
        await pickThree()
        fireEvent.change(quantityInput("Abyssal whip"), {
          target: { value: "3" },
        })
        fireEvent.click(option("At least N of these"))
        fireEvent.change(atLeastField(), { target: { value: "3" } })
        fireEvent.click(addButton("Add group: any 3 of 3"))

        await waitFor(() =>
          expect(mockedToast).toHaveBeenCalledWith(
            expect.objectContaining({
              description: "Goal 2: Nope",
              variant: "destructive",
            })
          )
        )
        await waitFor(() =>
          expect(addButton("Add group: any 3 of 3")).toBeEnabled()
        )
        expect(screen.getByText("Selected (3)")).toBeInTheDocument()
        expect(quantityInput("Abyssal whip")).toHaveValue("3")
        expect(option("At least N of these")).toBeChecked()
        expect(atLeastField()).toHaveValue("3")
        expect(screen.queryByText(/^Group:/)).not.toBeInTheDocument()
      })
    })
  })

  describe("Paste a list", () => {
    const pasteButton = () =>
      screen.getByRole("button", { name: "Paste a list" })
    const pasteBox = () =>
      screen.getByRole("textbox", { name: "One item per line" })

    beforeEach(() => {
      mockedResolve.mockImplementation(async (entries) => ({
        success: true,
        results: entries.map(({ name, quantity }) => {
          const item = [ABYSSAL_WHIP, ABYSSAL_TENTACLE, DRAGON_DAGGER_P].find(
            (candidate) =>
              candidate.name.replace("#", " ").toLowerCase() ===
              name.toLowerCase()
          )
          return item
            ? { input: name, quantity, status: "matched" as const, item }
            : { input: name, quantity, status: "unmatched" as const }
        }),
      }))
    })

    it("adds a reviewed list to the selection, then groups it like any selection", async () => {
      mockedCreateGoals.mockResolvedValue({ success: true, goals: [{}, {}] })
      renderDrawer()

      fireEvent.click(pasteButton())
      fireEvent.change(pasteBox(), {
        target: {
          value: "3x Abyssal whip\nAbyssal tentacle x500k\nDragon dagger (p)",
        },
      })
      fireEvent.click(screen.getByRole("button", { name: "Review list" }))
      fireEvent.click(
        await screen.findByRole("button", { name: "Add 3 items to selection" })
      )

      // Pasting creates nothing; the items are in the selection with their quantities.
      expect(mockedCreateGoals).not.toHaveBeenCalled()
      expect(screen.getByText("Selected (3)")).toBeInTheDocument()
      expect(quantityInput("Abyssal whip")).toHaveValue("3")
      expect(quantityInput("Abyssal tentacle")).toHaveValue("500000")
      expect(
        screen.getByRole("radio", { name: "Separate goals" })
      ).toBeChecked()

      fireEvent.click(
        screen.getByRole("radio", { name: "At least N of these" })
      )
      fireEvent.click(
        screen.getByRole("button", { name: "Add group: any 2 of 3" })
      )

      await waitFor(() => expect(mockedCreateGoals).toHaveBeenCalledTimes(1))
      const [, inputs, options] = mockedCreateGoals.mock.calls[0]!
      expect(inputs.map((i: { targetValue: number }) => i.targetValue)).toEqual(
        [3, 500_000, 1]
      )
      expect(options).toEqual({
        parentGroupId: null,
        group: { operator: "OR", minRequiredGoals: 2 },
      })
    })

    it("does not close the drawer on Escape inside the paste panel, but steps back", async () => {
      const { onOpenChange } = renderDrawer()
      fireEvent.click(pasteButton())
      fireEvent.change(pasteBox(), { target: { value: "Abyssal whip" } })

      // First the text is cleared, then the panel closes; the drawer stays open.
      fireEvent.keyDown(pasteBox(), { key: "Escape" })
      expect(pasteBox()).toHaveValue("")
      fireEvent.keyDown(pasteBox(), { key: "Escape" })

      expect(
        screen.queryByRole("textbox", { name: "One item per line" })
      ).not.toBeInTheDocument()
      expect(onOpenChange).not.toHaveBeenCalled()
    })

    it("does not add goals when Enter is pressed in a pasted quantity", async () => {
      renderDrawer()
      await pickItem("tentacle", "Abyssal tentacle")
      fireEvent.click(pasteButton())
      fireEvent.change(pasteBox(), { target: { value: "Abyssal whip" } })
      fireEvent.click(screen.getByRole("button", { name: "Review list" }))
      const quantity = await screen.findByRole("textbox", {
        name: "Pasted quantity of Abyssal whip",
      })

      // false means preventDefault was called, so the form is not submitted.
      expect(fireEvent.keyDown(quantity, { key: "Enter" })).toBe(false)
      expect(mockedCreateGoals).not.toHaveBeenCalled()
    })

    it("still closes the drawer with Escape elsewhere", () => {
      const { onOpenChange } = renderDrawer()
      fireEvent.click(pasteButton())

      fireEvent.keyDown(screen.getByRole("radio", { name: "Item" }), {
        key: "Escape",
      })

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe("Escape in a search field", () => {
    it("clears the text first and only closes the drawer when the field is empty", async () => {
      const { onOpenChange } = renderDrawer()
      fireEvent.change(searchField(), { target: { value: "wh" } })

      fireEvent.keyDown(searchField(), { key: "Escape" })
      expect(searchField()).toHaveValue("")
      expect(onOpenChange).not.toHaveBeenCalled()

      fireEvent.keyDown(searchField(), { key: "Escape" })
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it("closes the drawer from a field without search text, such as the description", () => {
      const { onOpenChange } = renderDrawer()
      fireEvent.click(screen.getByRole("radio", { name: "Other" }))
      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "Task" },
      })

      fireEvent.keyDown(screen.getByLabelText("Description"), {
        key: "Escape",
      })

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe("XP / Kills form", () => {
    beforeEach(() => {
      renderDrawer()
      fireEvent.click(screen.getByRole("radio", { name: "XP / Kills" }))
    })

    it("offers skill presets that fill the target, including Level 99", () => {
      const presets = screen.getByRole("group", { name: "XP to gain presets" })
      expect(
        within(presets)
          .getAllByRole("button")
          .map((b) => b.textContent)
      ).toEqual(["100K", "500K", "1M", "5M", "Level 99 (13,034,431 XP)"])

      fireEvent.click(within(presets).getByRole("button", { name: "500K" }))
      expect(screen.getByLabelText("XP to gain")).toHaveValue("500000")
      expect(screen.getByText("= 500,000 XP")).toBeInTheDocument()
      expect(
        within(presets).getByRole("button", { name: "500K" })
      ).toHaveAttribute("aria-pressed", "true")

      fireEvent.click(
        within(presets).getByRole("button", { name: /level 99/i })
      )
      expect(screen.getByLabelText("XP to gain")).toHaveValue("13034431")
    })

    it("shows a Track switch and the skill icon grid by default", () => {
      const track = screen.getByRole("radiogroup", { name: "Track" })
      expect(
        within(track)
          .getAllByRole("radio")
          .map((r) => r.textContent)
      ).toEqual(["Skill", "Boss", "Activity"])
      expect(within(track).getByRole("radio", { name: "Skill" })).toBeChecked()
      expect(skillRadios().length).toBeGreaterThan(20)
      expect(
        screen.queryByRole("combobox", { name: /^Search/ })
      ).not.toBeInTheDocument()
    })

    it("switches labels, presets and the picker for bosses and activities", async () => {
      fireEvent.click(screen.getByRole("radio", { name: "Boss" }))

      expect(screen.getByLabelText("Kills")).toBeInTheDocument()
      expect(
        within(screen.getByRole("group", { name: "Kills presets" }))
          .getAllByRole("button")
          .map((b) => b.textContent)
      ).toEqual(["5", "10", "25", "50", "100"])
      expect(screen.getByText(/Counts kills by the team/)).toBeInTheDocument()
      // The boss list replaces the skill grid and is ready for typing.
      expect(
        screen.queryByRole("radiogroup", { name: "Skill" })
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole("combobox", { name: "Search bosses" })
      ).toHaveFocus()

      fireEvent.click(screen.getByRole("radio", { name: "Activity" }))
      expect(screen.getByLabelText("Score")).toBeInTheDocument()
      expect(
        screen.queryByRole("group", { name: /presets/ })
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole("combobox", { name: "Search activities" })
      ).toHaveFocus()
    })

    it("forgets the picked skill when the type changes", () => {
      fireEvent.click(screen.getByRole("radio", { name: "Woodcutting" }))
      expect(screen.getByRole("radio", { name: "Woodcutting" })).toBeChecked()

      fireEvent.click(screen.getByRole("radio", { name: "Boss" }))
      fireEvent.click(screen.getByRole("radio", { name: "Skill" }))

      expect(
        skillRadios().filter((r) => r.getAttribute("aria-checked") === "true")
      ).toHaveLength(0)
      expect(screen.getByText("Select a skill to add.")).toBeInTheDocument()
    })

    it("keeps focus on the Track switch when it is changed with the arrow keys", async () => {
      const skill = screen.getByRole("radio", { name: "Skill" })
      act(() => skill.focus())

      fireEvent.keyDown(skill, { key: "ArrowRight" })

      await waitFor(() =>
        expect(screen.getByRole("radio", { name: "Boss" })).toBeChecked()
      )
      expect(screen.getByRole("radio", { name: "Boss" })).toHaveFocus()
      expect(
        screen.getByRole("combobox", { name: "Search bosses" })
      ).not.toHaveFocus()
    })

    it("says what is missing until a skill is picked", () => {
      expect(screen.getByText("Select a skill to add.")).toBeInTheDocument()

      fireEvent.click(screen.getByRole("radio", { name: "Fishing" }))
      expect(screen.getByText("XP to gain: Enter a number")).toBeInTheDocument()
    })

    it("explains what the target counts", () => {
      expect(
        screen.getByText(
          /Counts XP gained by the team during the event window \(via Wise Old Man\)/
        )
      ).toBeInTheDocument()
    })

    it("shows no Wise Old Man notice when a competition is linked", () => {
      expect(screen.queryByText(/won.t sync/)).not.toBeInTheDocument()
    })
  })

  describe("Wise Old Man notice", () => {
    it("warns, without blocking, when no competition is linked", () => {
      renderDrawer({ womLinked: false })
      fireEvent.click(screen.getByRole("radio", { name: "XP / Kills" }))

      expect(
        screen.getByText(
          /XP and kill progress won.t sync until a Wise Old Man competition is linked/
        )
      ).toBeInTheDocument()
      // Not a blocker: the add button is limited only by the missing skill.
      expect(screen.getByText("Select a skill to add.")).toBeInTheDocument()
    })

    it("closes the drawer and opens the tracker settings from the link", () => {
      const onOpenTrackerSettings = jest.fn()
      const { onOpenChange } = renderDrawer({
        womLinked: false,
        onOpenTrackerSettings,
      })
      fireEvent.click(screen.getByRole("radio", { name: "XP / Kills" }))

      fireEvent.click(
        screen.getByRole("button", { name: "Open tracker settings" })
      )

      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(onOpenTrackerSettings).toHaveBeenCalledTimes(1)
    })

    it("is not shown for item goals", () => {
      renderDrawer({ womLinked: false })

      expect(screen.queryByText(/won.t sync/)).not.toBeInTheDocument()
    })
  })
})
