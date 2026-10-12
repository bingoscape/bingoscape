import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import {
  QuickAddBar,
  resetQuickAddMemory,
} from "@/components/goals/quick-add-bar"
import type { AddGoalResult } from "@/components/goals/use-pending-goals"
import { searchOsrsItems } from "@/app/actions/osrs-items"
import "./dom-polyfills"
import { searchFixtureItems } from "./item-fixtures"

jest.mock("@/app/actions/osrs-items", () => ({ searchOsrsItems: jest.fn() }))

const mockedSearch = searchOsrsItems as jest.MockedFunction<
  typeof searchOsrsItems
>

type SearchResult = Awaited<ReturnType<typeof searchOsrsItems>>

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const SUCCESS: AddGoalResult = { success: true }

function renderBar(
  props: Partial<React.ComponentProps<typeof QuickAddBar>> = {}
) {
  const onAdd = jest.fn<Promise<AddGoalResult>, [unknown]>(async () => SUCCESS)
  const onOpenTrackerSettings = jest.fn()
  const utils = render(
    <QuickAddBar
      onAdd={onAdd}
      womLinked
      onOpenTrackerSettings={onOpenTrackerSettings}
      {...props}
    />
  )
  return { onAdd, onOpenTrackerSettings, ...utils }
}

const typeRadio = (name: string) =>
  within(screen.getByRole("radiogroup", { name: "Goal type" })).getByRole(
    "radio",
    { name }
  )
const searchField = () =>
  screen.getByRole("combobox", { name: "Search items" }) as HTMLInputElement
const quantityField = () =>
  screen.getByRole("textbox", { name: "Quantity" }) as HTMLInputElement

/** Types a query and waits for the debounced search to show the top result as highlighted. */
async function search(query: string, topResult = "Abyssal whip") {
  fireEvent.change(searchField(), { target: { value: query } })
  await screen.findByRole("option", { name: topResult }, { timeout: 2000 })
  await waitFor(() =>
    expect(screen.getByRole("option", { name: topResult })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  )
}

// The add is announced from a promise callback, so each action that can add is
// wrapped in an async act: React then sees the announcement as part of it.
const pressEnter = (element: HTMLElement) =>
  act(async () => {
    fireEvent.keyDown(element, { key: "Enter" })
  })

const clickButton = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name }))
  })

const submitForm = (form: HTMLElement) =>
  act(async () => {
    fireEvent.submit(form)
  })

const whipInput = {
  type: "item",
  itemId: 4151,
  itemName: "Abyssal whip",
  baseName: "Abyssal whip",
  imageUrl: "/whip.png",
  targetValue: 1,
  exactVariant: null,
}

describe("QuickAddBar", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetQuickAddMemory()
    mockedSearch.mockImplementation(async (query) => searchFixtureItems(query))
  })

  describe("structure", () => {
    it("is a labelled search landmark with the three goal types, Item first and selected", () => {
      renderBar()

      expect(
        screen.getByRole("search", { name: "Add a goal" })
      ).toBeInTheDocument()
      const group = screen.getByRole("radiogroup", { name: "Goal type" })
      expect(
        within(group)
          .getAllByRole("radio")
          .map((radio) => radio.textContent)
      ).toEqual(["Item", "XP / Kills", "Other"])
      expect(typeRadio("Item")).toBeChecked()
    })

    it("has a polite live region for announcements", () => {
      const { container } = renderBar()

      expect(
        container.querySelector('[aria-live="polite"]')
      ).toBeInTheDocument()
    })
  })

  describe("focus on mount", () => {
    const originalMatchMedia = window.matchMedia
    afterEach(() => {
      window.matchMedia = originalMatchMedia
    })

    it("does not take focus by default", () => {
      renderBar()

      expect(searchField()).not.toHaveFocus()
    })

    it("focuses the item search when asked to", () => {
      renderBar({ focusOnMount: true })

      expect(searchField()).toHaveFocus()
    })

    it("focuses the main field of the remembered type", () => {
      window.localStorage.setItem("bingoscape:goals:quick-add-type", "generic")
      renderBar({ focusOnMount: true })

      expect(screen.getByLabelText("Description")).toHaveFocus()
    })

    it("leaves a touch device alone, where focus would open the keyboard", () => {
      window.matchMedia = jest.fn().mockReturnValue({ matches: true })
      renderBar({ focusOnMount: true })

      expect(searchField()).not.toHaveFocus()
    })

    it("does not pull focus away from a user who is moving through the page with the keyboard", () => {
      const tab = document.createElement("button")
      document.body.appendChild(tab)
      tab.focus()
      const matches = jest
        .spyOn(tab, "matches")
        .mockImplementation((selector) => selector === ":focus-visible")

      renderBar({ focusOnMount: true })

      expect(tab).toHaveFocus()
      matches.mockRestore()
      tab.remove()
    })

    it("takes focus from a control that was focused with the mouse", () => {
      const tab = document.createElement("button")
      document.body.appendChild(tab)
      tab.focus()
      jest.spyOn(tab, "matches").mockReturnValue(false)

      renderBar({ focusOnMount: true })

      expect(searchField()).toHaveFocus()
      tab.remove()
    })
  })

  describe("switching and remembering the type", () => {
    it("shows the form of the chosen type", () => {
      renderBar()

      fireEvent.click(typeRadio("XP / Kills"))
      expect(
        screen.getByRole("radiogroup", { name: "Skill" })
      ).toBeInTheDocument()
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()

      fireEvent.click(typeRadio("Other"))
      expect(screen.getByLabelText("Description")).toBeInTheDocument()
      expect(
        screen.queryByRole("radiogroup", { name: "Skill" })
      ).not.toBeInTheDocument()

      fireEvent.click(typeRadio("Item"))
      expect(searchField()).toBeInTheDocument()
    })

    it("moves focus to the main field of the new type after a click", () => {
      renderBar()

      fireEvent.click(typeRadio("Other"))

      expect(screen.getByLabelText("Description")).toHaveFocus()
    })

    it("leaves focus on the type switch while arrow keys change the type", async () => {
      renderBar()
      const item = typeRadio("Item")
      act(() => item.focus())

      fireEvent.keyDown(item, { key: "ArrowRight" })

      await waitFor(() => expect(typeRadio("XP / Kills")).toBeChecked())
      expect(typeRadio("XP / Kills")).toHaveFocus()
    })

    it("remembers the last used type for the next time the bar appears", () => {
      const first = renderBar()
      fireEvent.click(typeRadio("Other"))
      expect(
        window.localStorage.getItem("bingoscape:goals:quick-add-type")
      ).toBe("generic")
      first.unmount()

      renderBar()

      expect(typeRadio("Other")).toBeChecked()
      expect(screen.getByLabelText("Description")).toBeInTheDocument()
    })

    it("remembers skill, boss or activity too", () => {
      const first = renderBar()
      fireEvent.click(typeRadio("XP / Kills"))
      fireEvent.click(screen.getByRole("radio", { name: "Boss" }))
      first.unmount()

      renderBar()

      expect(typeRadio("XP / Kills")).toBeChecked()
      expect(screen.getByRole("radio", { name: "Boss" })).toBeChecked()
      expect(
        screen.getByRole("combobox", { name: "Search bosses" })
      ).toBeInTheDocument()
    })

    it("starts on Item when nothing was remembered or the stored value is junk", () => {
      window.localStorage.setItem("bingoscape:goals:quick-add-type", "banana")
      renderBar()

      expect(typeRadio("Item")).toBeChecked()
    })
  })

  describe("Item", () => {
    it("shows nothing but the field until two characters are typed", () => {
      renderBar()

      expect(screen.queryByRole("status")).not.toBeInTheDocument()
      expect(screen.queryByRole("option")).not.toBeInTheDocument()
    })

    it("adds the top result with Enter, clears the search and keeps focus in it", async () => {
      const { onAdd } = renderBar()
      searchField().focus()
      await search("abyssal")

      await pressEnter(searchField())

      expect(onAdd).toHaveBeenCalledTimes(1)
      expect(onAdd).toHaveBeenCalledWith(whipInput)
      expect(searchField()).toHaveValue("")
      expect(searchField()).toHaveFocus()
      expect(screen.queryByRole("option")).not.toBeInTheDocument()
    })

    it("announces what was added", async () => {
      renderBar()
      await search("abyssal")

      await pressEnter(searchField())

      expect(
        await screen.findByText("Added Abyssal whip x1")
      ).toBeInTheDocument()
    })

    it("lets items be added back to back without touching anything else", async () => {
      const { onAdd } = renderBar()
      searchField().focus()

      await search("abyssal")
      await pressEnter(searchField())
      await search("dragon dagger", "Dragon dagger (p)")
      await pressEnter(searchField())

      expect(onAdd).toHaveBeenCalledTimes(2)
      expect(onAdd).toHaveBeenNthCalledWith(1, whipInput)
      expect(onAdd).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          itemId: 1231,
          itemName: "Dragon dagger#(p)",
          baseName: "Dragon dagger",
          exactVariant: "(p)",
        })
      )
      expect(searchField()).toHaveFocus()
    })

    it("adds the result the arrow keys moved to", async () => {
      const { onAdd } = renderBar()
      await search("abyssal")

      fireEvent.keyDown(searchField(), { key: "ArrowDown" })
      await waitFor(() =>
        expect(
          screen.getByRole("option", { name: "Abyssal tentacle" })
        ).toHaveAttribute("aria-selected", "true")
      )
      await pressEnter(searchField())

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: 12006, itemName: "Abyssal tentacle" })
      )
    })

    it("highlights the top result of a new search again, so Enter works after typing", async () => {
      const { onAdd } = renderBar()
      await search("abyssal")
      fireEvent.keyDown(searchField(), { key: "ArrowDown" })

      await search("dragon", "Dragon dagger (p)")
      await pressEnter(searchField())

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ itemName: "Dragon dagger#(p)" })
      )
    })

    it("adds a clicked result", async () => {
      const { onAdd } = renderBar()
      await search("abyssal")

      fireEvent.click(screen.getByRole("option", { name: "Abyssal tentacle" }))

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ itemName: "Abyssal tentacle" })
      )
      expect(searchField()).toHaveFocus()
    })

    it("adds the highlighted result with the Add button", async () => {
      const { onAdd } = renderBar()
      await search("abyssal")

      await clickButton("Add item")

      expect(onAdd).toHaveBeenCalledWith(whipInput)
    })

    it("adds the highlighted result when the form is submitted, as Enter in the quantity field does", async () => {
      const { onAdd } = renderBar()
      await search("abyssal")

      await submitForm(quantityField().closest("form")!)

      expect(onAdd).toHaveBeenCalledWith(whipInput)
    })

    it("does not let keys typed in the quantity field move the result highlight", async () => {
      renderBar()
      await search("abyssal")

      fireEvent.keyDown(quantityField(), { key: "ArrowDown" })

      expect(
        screen.getByRole("option", { name: "Abyssal whip" })
      ).toHaveAttribute("aria-selected", "true")
    })

    it("asks for more text when Add is pressed with nothing searched, and adds nothing", async () => {
      const { onAdd } = renderBar()

      await clickButton("Add item")

      expect(onAdd).not.toHaveBeenCalled()
      expect(screen.getByRole("status")).toHaveTextContent(
        /Type at least 2 characters/
      )
      expect(searchField()).toHaveFocus()
    })

    it("adds nothing for a search without results", async () => {
      const { onAdd } = renderBar()
      fireEvent.change(searchField(), { target: { value: "zzzz" } })
      expect(await screen.findByText(/No items found/)).toBeInTheDocument()

      await pressEnter(searchField())
      await clickButton("Add item")

      expect(onAdd).not.toHaveBeenCalled()
    })

    it("clears the text with Escape", async () => {
      renderBar()
      await search("abyssal")

      fireEvent.keyDown(searchField(), { key: "Escape" })

      expect(searchField()).toHaveValue("")
    })

    it("exposes the results as a listbox the field controls, with the highlight as active descendant", async () => {
      renderBar()
      await search("abyssal")

      const listbox = screen.getByRole("listbox")
      expect(searchField()).toHaveAttribute("aria-controls", listbox.id)
      expect(searchField()).toHaveAttribute(
        "aria-activedescendant",
        screen.getByRole("option", { name: "Abyssal whip" }).id
      )
    })

    describe("quantity", () => {
      it("starts at 1 and applies to the added item", async () => {
        const { onAdd } = renderBar()
        expect(quantityField()).toHaveValue("1")
        fireEvent.change(quantityField(), { target: { value: "3" } })
        await search("abyssal")

        await pressEnter(searchField())

        expect(onAdd).toHaveBeenCalledWith({ ...whipInput, targetValue: 3 })
      })

      it("understands shorthand and thousands separators", async () => {
        const { onAdd } = renderBar()
        fireEvent.change(quantityField(), { target: { value: "2k" } })
        await search("abyssal")
        await pressEnter(searchField())
        fireEvent.change(quantityField(), { target: { value: "1,500" } })
        await search("abyssal")
        await pressEnter(searchField())

        expect(onAdd).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ targetValue: 2000 })
        )
        expect(onAdd).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ targetValue: 1500 })
        )
      })

      it("goes back to 1 after an add, so the next item is not added many times by accident", async () => {
        renderBar()
        fireEvent.change(quantityField(), { target: { value: "25" } })
        await search("abyssal")

        await pressEnter(searchField())

        expect(quantityField()).toHaveValue("1")
      })

      it.each([
        ["", "Enter a number"],
        ["abc", "Enter a whole number"],
        ["1.5", "Target value must be a whole number"],
        ["0", "Target value must be greater than 0"],
        ["-2", "Target value must be greater than 0"],
        ["3b", "Target value cannot exceed"],
      ])(
        "blocks the add for a quantity of %p, shows why, and moves focus to the field",
        async (value, message) => {
          const { onAdd } = renderBar()
          await search("abyssal")
          fireEvent.change(quantityField(), { target: { value } })

          await pressEnter(searchField())

          expect(onAdd).not.toHaveBeenCalled()
          expect(screen.getByRole("alert")).toHaveTextContent(message)
          expect(quantityField()).toHaveAttribute("aria-invalid", "true")
          expect(quantityField()).toHaveAccessibleDescription(
            new RegExp(message)
          )
          expect(quantityField()).toHaveFocus()
          // Never snapped back to 1, and the search is still there.
          expect(quantityField()).toHaveValue(value)
          expect(searchField()).toHaveValue("abyssal")
        }
      )

      it("adds once the quantity is fixed, and the error goes away", async () => {
        const { onAdd } = renderBar()
        await search("abyssal")
        fireEvent.change(quantityField(), { target: { value: "" } })
        await pressEnter(searchField())
        expect(screen.getByRole("alert")).toBeInTheDocument()

        fireEvent.change(quantityField(), { target: { value: "2" } })
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
        await clickButton("Add item")

        expect(onAdd).toHaveBeenCalledWith({ ...whipInput, targetValue: 2 })
      })
    })

    describe("Enter while the search is still running", () => {
      it("adds the top match as soon as the results arrive", async () => {
        const answer = deferred<SearchResult>()
        mockedSearch.mockReturnValue(answer.promise)
        const { onAdd } = renderBar()
        fireEvent.change(searchField(), { target: { value: "abyssal" } })

        await pressEnter(searchField())
        expect(onAdd).not.toHaveBeenCalled()
        expect(screen.getByRole("status")).toHaveTextContent(
          "Searching, then adding the top match..."
        )

        await waitFor(() => expect(mockedSearch).toHaveBeenCalled())
        await act(async () => {
          answer.resolve(searchFixtureItems("abyssal"))
        })

        await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1))
        expect(onAdd).toHaveBeenCalledWith(whipInput)
        expect(searchField()).toHaveValue("")
      })

      it("does not pick a result of the previous query", async () => {
        const { onAdd } = renderBar()
        await search("abyssal")
        mockedSearch.mockReturnValue(new Promise<never>(() => undefined))
        fireEvent.change(searchField(), { target: { value: "dragon" } })

        await pressEnter(searchField())

        expect(onAdd).not.toHaveBeenCalled()
      })

      it("forgets the Enter when the text changes before the results arrive", async () => {
        const answer = deferred<SearchResult>()
        mockedSearch.mockReturnValue(answer.promise)
        const { onAdd } = renderBar()
        fireEvent.change(searchField(), { target: { value: "abyssal" } })
        await pressEnter(searchField())

        mockedSearch.mockImplementation(async (query) =>
          searchFixtureItems(query)
        )
        fireEvent.change(searchField(), { target: { value: "dragon" } })
        await screen.findByRole(
          "option",
          { name: "Dragon dagger (p)" },
          { timeout: 2000 }
        )
        await act(async () => {
          answer.resolve(searchFixtureItems("abyssal"))
        })

        expect(onAdd).not.toHaveBeenCalled()
      })

      it("adds nothing when the search finds nothing", async () => {
        const answer = deferred<SearchResult>()
        mockedSearch.mockReturnValue(answer.promise)
        const { onAdd } = renderBar()
        fireEvent.change(searchField(), { target: { value: "zzzz" } })
        await pressEnter(searchField())

        await waitFor(() => expect(mockedSearch).toHaveBeenCalled())
        await act(async () => {
          answer.resolve(searchFixtureItems("zzzz"))
        })

        expect(await screen.findByText(/No items found/)).toBeInTheDocument()
        expect(onAdd).not.toHaveBeenCalled()
      })

      it("is also what the Add button does", async () => {
        const answer = deferred<SearchResult>()
        mockedSearch.mockReturnValue(answer.promise)
        const { onAdd } = renderBar()
        fireEvent.change(searchField(), { target: { value: "abyssal" } })

        await clickButton("Add item")
        await waitFor(() => expect(mockedSearch).toHaveBeenCalled())
        await act(async () => {
          answer.resolve(searchFixtureItems("abyssal"))
        })

        await waitFor(() => expect(onAdd).toHaveBeenCalledWith(whipInput))
      })
    })

    describe("when the server refuses", () => {
      it("puts the typed search and quantity back", async () => {
        const { onAdd } = renderBar()
        onAdd.mockResolvedValue({ success: false, error: "Nope" })
        fireEvent.change(quantityField(), { target: { value: "4" } })
        await search("abyssal")

        await pressEnter(searchField())

        await waitFor(() => expect(searchField()).toHaveValue("abyssal"))
        expect(quantityField()).toHaveValue("4")
        expect(screen.queryByText(/^Added/)).not.toBeInTheDocument()
      })

      it("keeps what the user already typed for the next item", async () => {
        const answer = deferred<AddGoalResult>()
        const { onAdd } = renderBar()
        onAdd.mockReturnValue(answer.promise)
        await search("abyssal")
        await pressEnter(searchField())
        fireEvent.change(searchField(), { target: { value: "dragon" } })

        await act(async () => {
          answer.resolve({ success: false, error: "Nope" })
        })

        expect(searchField()).toHaveValue("dragon")
      })
    })
  })

  describe("XP / Kills", () => {
    const skill = (name: string) =>
      within(screen.getByRole("radiogroup", { name: "Skill" })).getByRole(
        "radio",
        { name }
      )
    const targetField = (label = "XP to gain") =>
      screen.getByLabelText(label) as HTMLInputElement

    beforeEach(() => {
      window.localStorage.setItem("bingoscape:goals:quick-add-type", "metric")
    })

    it("offers the skills in one scrolling strip and picks one with a single click", () => {
      renderBar()
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()

      fireEvent.click(skill("Attack"))

      expect(skill("Attack")).toBeChecked()
    })

    it("moves focus to the target after a skill is picked", () => {
      renderBar()

      fireEvent.click(skill("Attack"))

      expect(targetField()).toHaveFocus()
    })

    it("keeps focus on the skills while arrow keys move through them", async () => {
      renderBar()
      act(() => skill("Overall").focus())

      fireEvent.keyDown(skill("Overall"), { key: "ArrowRight" })

      await waitFor(() => expect(skill("Attack")).toBeChecked())
      expect(skill("Attack")).toHaveFocus()
      expect(targetField()).not.toHaveFocus()
    })

    it("adds with the form's submit, which Enter in the target field triggers, and resets", async () => {
      const { onAdd } = renderBar()
      fireEvent.click(skill("Attack"))
      fireEvent.change(targetField(), { target: { value: "5m" } })

      await submitForm(targetField().closest("form")!)

      expect(onAdd).toHaveBeenCalledTimes(1)
      expect(onAdd).toHaveBeenCalledWith({
        type: "metric",
        metricType: "skill",
        metricName: "attack",
        targetValue: 5_000_000,
      })
      expect(
        await screen.findByText("Added Attack: 5,000,000 XP")
      ).toBeInTheDocument()
      expect(skill("Attack")).not.toBeChecked()
      expect(targetField()).toHaveValue("")
    })

    it("adds with the Add button", async () => {
      const { onAdd } = renderBar()
      fireEvent.click(skill("Mining"))
      fireEvent.change(targetField(), { target: { value: "500000" } })

      await clickButton("Add skill goal")

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ metricName: "mining", targetValue: 500_000 })
      )
    })

    it("does not add without a skill and says which one is missing", async () => {
      const { onAdd } = renderBar()
      fireEvent.change(targetField(), { target: { value: "1m" } })

      await clickButton("Add skill goal")

      expect(onAdd).not.toHaveBeenCalled()
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Select a skill first."
      )
    })

    it("clears that message once a skill is picked", async () => {
      renderBar()
      await clickButton("Add skill goal")
      expect(screen.getByRole("alert")).toBeInTheDocument()

      fireEvent.click(skill("Attack"))

      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    it.each([
      ["", "Enter a number"],
      ["lots", "Enter a whole number"],
      ["0", "Target value must be greater than 0"],
    ])(
      "blocks a target of %p, shows the reason on the field and focuses it",
      async (value, message) => {
        const { onAdd } = renderBar()
        fireEvent.click(skill("Attack"))
        fireEvent.change(targetField(), { target: { value } })

        await submitForm(targetField().closest("form")!)

        expect(onAdd).not.toHaveBeenCalled()
        expect(screen.getByRole("alert")).toHaveTextContent(message)
        expect(targetField()).toHaveAttribute("aria-invalid", "true")
        expect(targetField()).toHaveFocus()
        expect(targetField()).toHaveValue(value)
        expect(skill("Attack")).toBeChecked()
      }
    )

    it("shows the unit label of what is tracked", () => {
      renderBar()
      expect(screen.getByText("XP to gain")).toBeInTheDocument()

      fireEvent.click(screen.getByRole("radio", { name: "Boss" }))
      expect(screen.getByText("Kills")).toBeInTheDocument()

      fireEvent.click(screen.getByRole("radio", { name: "Activity" }))
      expect(screen.getByText("Score")).toBeInTheDocument()
    })

    it("offers short preset chips that fill the target", () => {
      renderBar()
      const presets = screen.getByRole("group", { name: "XP to gain presets" })

      expect(
        within(presets)
          .getAllByRole("button")
          .map((chip) => chip.textContent)
      ).toEqual(["100K", "500K", "1M", "5M", "Level 99"])

      fireEvent.click(within(presets).getByRole("button", { name: "1M" }))
      expect(targetField()).toHaveValue("1000000")
      expect(
        within(presets).getByRole("button", { name: "1M" })
      ).toHaveAttribute("aria-pressed", "true")

      fireEvent.click(within(presets).getByRole("button", { name: "Level 99" }))
      expect(targetField()).toHaveValue("13034431")
    })

    it("offers kill presets for bosses and none for activities", () => {
      renderBar()
      fireEvent.click(screen.getByRole("radio", { name: "Boss" }))
      expect(
        within(screen.getByRole("group", { name: "Kills presets" }))
          .getAllByRole("button")
          .map((chip) => chip.textContent)
      ).toEqual(["5", "10", "25", "50", "100"])

      fireEvent.click(screen.getByRole("radio", { name: "Activity" }))
      expect(
        screen.queryByRole("group", { name: /presets/ })
      ).not.toBeInTheDocument()
    })

    it("adds a boss from the searchable list and focuses the target after the pick", async () => {
      const { onAdd } = renderBar()
      fireEvent.click(screen.getByRole("radio", { name: "Boss" }))
      fireEvent.change(
        screen.getByRole("combobox", { name: "Search bosses" }),
        { target: { value: "zulrah" } }
      )

      fireEvent.click(await screen.findByRole("option", { name: "Zulrah" }))
      expect(targetField("Kills")).toHaveFocus()
      fireEvent.change(targetField("Kills"), { target: { value: "50" } })
      await submitForm(targetField("Kills").closest("form")!)

      expect(onAdd).toHaveBeenCalledWith({
        type: "metric",
        metricType: "boss",
        metricName: "zulrah",
        targetValue: 50,
      })
      expect(
        await screen.findByText("Added Zulrah: 50 kills")
      ).toBeInTheDocument()
    })

    it("asks for a boss, not a skill, when none is chosen", async () => {
      renderBar()
      fireEvent.click(screen.getByRole("radio", { name: "Boss" }))

      await clickButton("Add boss goal")

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Select a boss first."
      )
    })

    it("asks for an activity with the right article", async () => {
      renderBar()
      fireEvent.click(screen.getByRole("radio", { name: "Activity" }))

      await clickButton("Add activity goal")

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Select an activity first."
      )
    })

    it("puts the skill and target back when the server refuses", async () => {
      const { onAdd } = renderBar()
      onAdd.mockResolvedValue({ success: false, error: "Nope" })
      fireEvent.click(skill("Attack"))
      fireEvent.change(targetField(), { target: { value: "5m" } })

      await submitForm(targetField().closest("form")!)

      await waitFor(() => expect(skill("Attack")).toBeChecked())
      expect(targetField()).toHaveValue("5m")
    })

    describe("Wise Old Man notice", () => {
      it("warns, without blocking, when the Board has no linked competition", async () => {
        const { onAdd } = renderBar({ womLinked: false })

        expect(screen.getByRole("note")).toHaveTextContent(
          /won't sync until a Wise Old Man competition is linked/
        )
        fireEvent.click(skill("Attack"))
        fireEvent.change(targetField(), { target: { value: "1m" } })
        await submitForm(targetField().closest("form")!)
        expect(onAdd).toHaveBeenCalledTimes(1)
      })

      it("links to the tracker settings", () => {
        const { onOpenTrackerSettings } = renderBar({ womLinked: false })

        fireEvent.click(
          screen.getByRole("button", { name: "Open tracker settings" })
        )

        expect(onOpenTrackerSettings).toHaveBeenCalledTimes(1)
      })

      it("is hidden when a competition is linked", () => {
        renderBar({ womLinked: true })

        expect(screen.queryByRole("note")).not.toBeInTheDocument()
      })

      it("is not shown for items or tasks", () => {
        renderBar({ womLinked: false })

        fireEvent.click(typeRadio("Item"))
        expect(screen.queryByRole("note")).not.toBeInTheDocument()

        fireEvent.click(typeRadio("Other"))
        expect(screen.queryByRole("note")).not.toBeInTheDocument()
      })
    })
  })

  describe("Other", () => {
    const description = () =>
      screen.getByLabelText("Description") as HTMLInputElement
    const target = () => screen.getByLabelText("Target") as HTMLInputElement

    beforeEach(() => {
      window.localStorage.setItem("bingoscape:goals:quick-add-type", "generic")
    })

    it("starts with a target of 1", () => {
      renderBar()

      expect(target()).toHaveValue("1")
    })

    it("adds a task with the form's submit, then clears the fields and refocuses the description", async () => {
      const { onAdd } = renderBar()
      fireEvent.change(description(), {
        target: { value: "  Complete a raid " },
      })
      fireEvent.change(target(), { target: { value: "2" } })

      await submitForm(description().closest("form")!)

      expect(onAdd).toHaveBeenCalledWith({
        type: "generic",
        description: "Complete a raid",
        targetValue: 2,
      })
      expect(
        await screen.findByText("Added Complete a raid x2")
      ).toBeInTheDocument()
      expect(description()).toHaveValue("")
      expect(target()).toHaveValue("1")
      expect(description()).toHaveFocus()
    })

    it("adds with the Add button", async () => {
      const { onAdd } = renderBar()
      fireEvent.change(description(), { target: { value: "Get a pet" } })

      await clickButton("Add goal")

      expect(onAdd).toHaveBeenCalledWith({
        type: "generic",
        description: "Get a pet",
        targetValue: 1,
      })
    })

    it("blocks an empty description and says so", async () => {
      const { onAdd } = renderBar()
      fireEvent.change(description(), { target: { value: "   " } })

      await clickButton("Add goal")

      expect(onAdd).not.toHaveBeenCalled()
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Description cannot be empty"
      )
      expect(description()).toHaveAttribute("aria-invalid", "true")
      expect(description()).toHaveFocus()
    })

    it("blocks a bad target without snapping it back to 1", async () => {
      const { onAdd } = renderBar()
      fireEvent.change(description(), { target: { value: "Get a pet" } })
      fireEvent.change(target(), { target: { value: "" } })

      await clickButton("Add goal")

      expect(onAdd).not.toHaveBeenCalled()
      expect(screen.getByRole("alert")).toHaveTextContent("Enter a number")
      expect(target()).toHaveValue("")
      expect(target()).toHaveFocus()
    })

    it("puts the text back when the server refuses", async () => {
      const { onAdd } = renderBar()
      onAdd.mockResolvedValue({ success: false, error: "Nope" })
      fireEvent.change(description(), { target: { value: "Get a pet" } })
      fireEvent.change(target(), { target: { value: "3" } })

      await clickButton("Add goal")

      await waitFor(() => expect(description()).toHaveValue("Get a pet"))
      expect(target()).toHaveValue("3")
    })
  })

  describe("touch targets", () => {
    it("asks for 44px controls on coarse pointers", () => {
      renderBar()

      expect(typeRadio("Item").className).toContain("pointer-coarse:min-h-11")
      expect(searchField().className).toContain("pointer-coarse:h-11")
      expect(quantityField().className).toContain("pointer-coarse:h-11")
      expect(
        screen.getByRole("button", { name: "Add item" }).className
      ).toContain("pointer-coarse:min-h-11")
    })
  })
})
