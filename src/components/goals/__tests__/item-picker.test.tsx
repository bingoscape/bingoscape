import { useState } from "react"
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { ItemPicker } from "@/components/goals/item-picker"
import type { SelectedItem } from "@/components/goals/types"
import { searchOsrsItems } from "@/app/actions/osrs-items"
import "./dom-polyfills"
import {
  ABYSSAL_TENTACLE,
  ABYSSAL_WHIP,
  DRAGON_DAGGER_P,
  searchFixtureItems,
} from "./item-fixtures"

jest.mock("@/app/actions/osrs-items", () => ({ searchOsrsItems: jest.fn() }))

const mockedSearch = searchOsrsItems as jest.MockedFunction<
  typeof searchOsrsItems
>

function Harness({
  autoFocus,
  onChange,
  initial = [],
}: {
  autoFocus?: boolean
  onChange?: (value: SelectedItem[]) => void
  initial?: SelectedItem[]
}) {
  const [value, setValue] = useState<SelectedItem[]>(initial)
  return (
    <ItemPicker
      value={value}
      autoFocus={autoFocus}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

const searchField = () =>
  screen.getByRole("combobox", { name: "Search items" }) as HTMLInputElement

/** Types a query and waits for the debounced search to show its results. */
async function search(query: string) {
  fireEvent.change(searchField(), { target: { value: query } })
  return screen.findAllByRole("option", {}, { timeout: 2000 })
}

const quantityInput = (itemName: string) =>
  screen.getByRole("textbox", {
    name: `Quantity of ${itemName}`,
  }) as HTMLInputElement

describe("ItemPicker", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedSearch.mockImplementation(async (query) => searchFixtureItems(query))
  })

  describe("searching", () => {
    it("shows a friendly hint instead of results below two characters", async () => {
      render(<Harness />)

      expect(screen.getByText(/Type at least 2 characters/)).toBeInTheDocument()

      fireEvent.change(searchField(), { target: { value: "a" } })
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400))
      })

      expect(mockedSearch).not.toHaveBeenCalled()
      expect(screen.queryByRole("option")).not.toBeInTheDocument()
      expect(screen.getByText(/Type at least 2 characters/)).toBeInTheDocument()
    })

    it("searches once for a burst of typing, asking for 30 results", async () => {
      render(<Harness />)

      fireEvent.change(searchField(), { target: { value: "ab" } })
      fireEvent.change(searchField(), { target: { value: "abyss" } })
      fireEvent.change(searchField(), { target: { value: "abyssal" } })
      await search("abyssal")

      expect(mockedSearch).toHaveBeenCalledTimes(1)
      expect(mockedSearch).toHaveBeenCalledWith("abyssal", 30)
    })

    it("shows the icon and name of every result, with no item id", async () => {
      const { container } = render(<Harness />)
      await search("abyssal")

      const options = screen.getAllByRole("option")
      expect(options.map((o) => o.textContent)).toEqual([
        "Abyssal whip",
        "Abyssal tentacle",
      ])
      expect(container.querySelectorAll("[cmdk-item] img")).toHaveLength(2)
      expect(screen.queryByText(/ID:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/4151/)).not.toBeInTheDocument()
    })

    it("names variants the way players read them", async () => {
      render(<Harness />)
      await search("dragon dagger")

      expect(
        screen.getByRole("option", { name: "Dragon dagger (p)" })
      ).toBeInTheDocument()
      expect(screen.queryByText(/#/)).not.toBeInTheDocument()
    })

    it("counts the matches", async () => {
      render(<Harness />)
      await search("abyssal")

      expect(screen.getByRole("status")).toHaveTextContent("2 matches")
    })

    it("says when the results were cut off at the limit", async () => {
      const many = Array.from({ length: 30 }, (_, index) => ({
        ...ABYSSAL_WHIP,
        id: 9000 + index,
        name: `Test item ${index}`,
      }))
      mockedSearch.mockResolvedValue({ success: true, items: many })
      render(<Harness />)
      await search("test")

      expect(screen.getAllByRole("option")).toHaveLength(30)
      expect(screen.getByRole("status")).toHaveTextContent(/first 30 matches/i)
    })

    it("says when nothing matches", async () => {
      mockedSearch.mockResolvedValue({ success: true, items: [] })
      render(<Harness />)

      fireEvent.change(searchField(), { target: { value: "zzzz" } })

      expect(await screen.findByText(/No items found/)).toBeInTheDocument()
    })

    it("says when the search failed", async () => {
      mockedSearch.mockResolvedValue({ success: false, error: "Nope" })
      render(<Harness />)

      fireEvent.change(searchField(), { target: { value: "whip" } })

      expect(await screen.findByText(/The search failed/)).toBeInTheDocument()
    })

    it("shows that it is searching until the results arrive", async () => {
      let resolve!: (value: Awaited<ReturnType<typeof searchOsrsItems>>) => void
      mockedSearch.mockReturnValue(
        new Promise<Awaited<ReturnType<typeof searchOsrsItems>>>((r) => {
          resolve = r
        })
      )
      render(<Harness />)

      fireEvent.change(searchField(), { target: { value: "whip" } })
      expect(screen.getByRole("status")).toHaveTextContent("Searching...")

      await waitFor(() => expect(mockedSearch).toHaveBeenCalled())
      await act(async () => {
        resolve(searchFixtureItems("whip"))
      })
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("1 match")
      )
    })

    it("clears the typed text with Escape and marks the field so the drawer lets it", async () => {
      render(<Harness />)
      fireEvent.change(searchField(), { target: { value: "whip" } })

      expect(searchField()).toHaveAttribute("data-escape-clears")
      fireEvent.keyDown(searchField(), { key: "Escape" })

      expect(searchField()).toHaveValue("")
    })

    it("focuses the search on mount when asked to", () => {
      render(<Harness autoFocus />)

      expect(searchField()).toHaveFocus()
    })

    it("does not take focus by default", () => {
      render(<Harness />)

      expect(searchField()).not.toHaveFocus()
    })
  })

  describe("selecting", () => {
    it("adds a clicked result to the Selected list with a quantity of 1", async () => {
      const onChange = jest.fn()
      render(<Harness onChange={onChange} />)
      await search("whip")

      fireEvent.click(screen.getByRole("option", { name: "Abyssal whip" }))

      expect(
        screen.getByRole("heading", { name: "Selected (1)" })
      ).toBeInTheDocument()
      expect(quantityInput("Abyssal whip")).toHaveValue("1")
      expect(onChange).toHaveBeenLastCalledWith([
        { item: ABYSSAL_WHIP, quantity: "1" },
      ])
    })

    it("marks a selected result as added", async () => {
      render(<Harness />)
      await search("abyssal")

      fireEvent.click(screen.getByRole("option", { name: "Abyssal whip" }))

      expect(
        screen.getByRole("option", { name: /^Abyssal whip\s*Added$/ })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("option", { name: "Abyssal tentacle" })
      ).toBeInTheDocument()
    })

    it("removes an already selected item when its result is chosen again", async () => {
      render(<Harness />)
      await search("whip")

      fireEvent.click(screen.getByRole("option", { name: "Abyssal whip" }))
      fireEvent.click(screen.getByRole("option", { name: /^Abyssal whip/ }))

      expect(
        screen.queryByRole("heading", { name: /Selected/ })
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole("option", { name: "Abyssal whip" })
      ).toBeInTheDocument()
    })

    it("keeps several items, in the order they were picked", async () => {
      render(<Harness />)
      await search("abyssal")

      fireEvent.click(screen.getByRole("option", { name: "Abyssal tentacle" }))
      fireEvent.click(screen.getByRole("option", { name: "Abyssal whip" }))

      expect(
        screen.getByRole("heading", { name: "Selected (2)" })
      ).toBeInTheDocument()
      const rows = screen.getAllByRole("listitem")
      expect(rows[0]).toHaveTextContent("Abyssal tentacle")
      expect(rows[1]).toHaveTextContent("Abyssal whip")
    })

    it("recognises an item with several ids as already selected", async () => {
      const onChange = jest.fn()
      render(
        <Harness
          onChange={onChange}
          initial={[{ item: DRAGON_DAGGER_P, quantity: "3" }]}
        />
      )
      await search("dragon dagger")

      const option = screen.getByRole("option", {
        name: /^Dragon dagger \(p\)\s*Added$/,
      })
      expect(screen.getAllByRole("listitem")).toHaveLength(1)

      // Choosing it again removes it instead of adding a second copy.
      fireEvent.click(option)
      expect(onChange).toHaveBeenLastCalledWith([])
    })

    it("keeps the results and puts focus back in the search so another can be picked", async () => {
      render(<Harness />)
      await search("abyssal")
      const other = document.createElement("button")
      document.body.appendChild(other)
      other.focus()

      fireEvent.click(screen.getByRole("option", { name: "Abyssal whip" }))

      expect(searchField()).toHaveFocus()
      expect(screen.getAllByRole("option")).toHaveLength(2)
      other.remove()
    })

    it("announces what was added and removed", async () => {
      const { container } = render(<Harness />)
      await search("whip")
      const live = () => container.querySelector('[aria-live="polite"]')

      fireEvent.click(screen.getByRole("option", { name: "Abyssal whip" }))
      expect(live()).toHaveTextContent("Abyssal whip added. 1 item selected.")

      fireEvent.click(
        screen.getByRole("button", { name: "Remove Abyssal whip" })
      )
      expect(live()).toHaveTextContent(
        "Abyssal whip removed. 0 items selected."
      )
    })
  })

  describe("keyboard", () => {
    const other = () => {
      const button = document.createElement("button")
      document.body.appendChild(button)
      button.focus()
      return button
    }

    it("names the highlighted result as the active descendant of the search field", async () => {
      render(<Harness />)
      await search("abyssal")

      const listbox = screen.getByRole("listbox")
      expect(searchField()).toHaveAttribute("aria-controls", listbox.id)
      await waitFor(() =>
        expect(searchField()).toHaveAttribute(
          "aria-activedescendant",
          screen.getByRole("option", { name: /^Abyssal whip/ }).id
        )
      )
    })

    it("selects the highlighted result with Enter and returns focus to the search", async () => {
      render(<Harness />)
      await search("abyssal")
      await waitFor(() =>
        expect(
          screen.getByRole("option", { name: "Abyssal whip" })
        ).toHaveAttribute("aria-selected", "true")
      )
      const stray = other()

      fireEvent.keyDown(searchField(), { key: "Enter" })

      expect(quantityInput("Abyssal whip")).toHaveValue("1")
      expect(searchField()).toHaveFocus()
      stray.remove()
    })

    it("moves through the results with the arrow keys and selects the one it lands on", async () => {
      render(<Harness />)
      await search("abyssal")
      await waitFor(() =>
        expect(
          screen.getByRole("option", { name: "Abyssal whip" })
        ).toHaveAttribute("aria-selected", "true")
      )

      fireEvent.keyDown(searchField(), { key: "ArrowDown" })
      await waitFor(() =>
        expect(
          screen.getByRole("option", { name: "Abyssal tentacle" })
        ).toHaveAttribute("aria-selected", "true")
      )
      fireEvent.keyDown(searchField(), { key: "Enter" })

      expect(quantityInput("Abyssal tentacle")).toHaveValue("1")
      expect(
        screen.queryByRole("textbox", { name: "Quantity of Abyssal whip" })
      ).not.toBeInTheDocument()
    })

    it("highlights the first result of a new search, so Enter works after typing", async () => {
      render(<Harness />)
      await search("abyssal")
      fireEvent.keyDown(searchField(), { key: "ArrowDown" })

      await search("dragon")
      await waitFor(() =>
        expect(
          screen.getByRole("option", { name: "Dragon dagger (p)" })
        ).toHaveAttribute("aria-selected", "true")
      )
      fireEvent.keyDown(searchField(), { key: "Enter" })

      expect(quantityInput("Dragon dagger (p)")).toHaveValue("1")
    })

    it("lets several items be added in a row without leaving the keyboard", async () => {
      render(<Harness />)
      await search("abyssal")
      await waitFor(() =>
        expect(
          screen.getByRole("option", { name: "Abyssal whip" })
        ).toHaveAttribute("aria-selected", "true")
      )

      fireEvent.keyDown(searchField(), { key: "Enter" })
      fireEvent.keyDown(searchField(), { key: "ArrowDown" })
      await waitFor(() =>
        expect(
          screen.getByRole("option", { name: "Abyssal tentacle" })
        ).toHaveAttribute("aria-selected", "true")
      )
      fireEvent.keyDown(searchField(), { key: "Enter" })

      expect(
        screen.getByRole("heading", { name: "Selected (2)" })
      ).toBeInTheDocument()
    })

    it("keeps Enter in the search from submitting a surrounding form", () => {
      render(<Harness />)

      // false: the event was cancelled, so the browser will not submit the form.
      expect(fireEvent.keyDown(searchField(), { key: "Enter" })).toBe(false)
    })

    it("ignores Enter while the results on screen belong to an older query", async () => {
      render(<Harness />)
      await search("whip")

      // The next search never answers, so the old results stay on screen.
      mockedSearch.mockReturnValue(new Promise<never>(() => undefined))
      fireEvent.change(searchField(), { target: { value: "dragon" } })
      expect(screen.getByRole("status")).toHaveTextContent("Searching...")
      fireEvent.keyDown(searchField(), { key: "Enter" })

      expect(
        screen.queryByRole("heading", { name: /Selected/ })
      ).not.toBeInTheDocument()
    })
  })

  describe("quantities", () => {
    async function withWhip(onChange?: (value: SelectedItem[]) => void) {
      render(<Harness onChange={onChange} />)
      await search("whip")
      fireEvent.click(screen.getByRole("option", { name: "Abyssal whip" }))
    }

    it("edits a quantity as typed text and previews shorthand", async () => {
      const onChange = jest.fn()
      await withWhip(onChange)

      fireEvent.change(quantityInput("Abyssal whip"), {
        target: { value: "500k" },
      })

      expect(quantityInput("Abyssal whip")).toHaveValue("500k")
      expect(screen.getByText("= 500,000")).toBeInTheDocument()
      expect(onChange).toHaveBeenLastCalledWith([
        { item: ABYSSAL_WHIP, quantity: "500k" },
      ])
    })

    it("gives every item its own quantity", async () => {
      const onChange = jest.fn()
      render(<Harness onChange={onChange} />)
      await search("abyssal")
      fireEvent.click(screen.getByRole("option", { name: "Abyssal whip" }))
      fireEvent.click(screen.getByRole("option", { name: /^Abyssal tentacle/ }))

      fireEvent.change(quantityInput("Abyssal whip"), {
        target: { value: "2" },
      })
      fireEvent.change(quantityInput("Abyssal tentacle"), {
        target: { value: "7" },
      })

      expect(onChange).toHaveBeenLastCalledWith([
        { item: ABYSSAL_WHIP, quantity: "2" },
        { item: ABYSSAL_TENTACLE, quantity: "7" },
      ])
    })

    it("steps the quantity up and down with the buttons", async () => {
      await withWhip()
      const increase = screen.getByRole("button", {
        name: "Increase quantity of Abyssal whip",
      })
      const decrease = screen.getByRole("button", {
        name: "Decrease quantity of Abyssal whip",
      })

      fireEvent.click(increase)
      fireEvent.click(increase)
      expect(quantityInput("Abyssal whip")).toHaveValue("3")

      fireEvent.click(decrease)
      expect(quantityInput("Abyssal whip")).toHaveValue("2")
    })

    it("does not step below 1 and says the minus button is unavailable", async () => {
      await withWhip()
      const decrease = screen.getByRole("button", {
        name: "Decrease quantity of Abyssal whip",
      })

      expect(decrease).toHaveAttribute("aria-disabled", "true")
      fireEvent.click(decrease)

      expect(quantityInput("Abyssal whip")).toHaveValue("1")
    })

    it("steps from a shorthand value", async () => {
      await withWhip()
      fireEvent.change(quantityInput("Abyssal whip"), {
        target: { value: "2k" },
      })

      fireEvent.click(
        screen.getByRole("button", {
          name: "Increase quantity of Abyssal whip",
        })
      )

      expect(quantityInput("Abyssal whip")).toHaveValue("2001")
    })

    it("shows an inline error for an invalid quantity once the field is left", async () => {
      await withWhip()

      fireEvent.change(quantityInput("Abyssal whip"), {
        target: { value: "0" },
      })
      fireEvent.blur(quantityInput("Abyssal whip"))

      expect(screen.getByRole("alert")).toHaveTextContent(/greater than 0/)
      expect(quantityInput("Abyssal whip")).toHaveAttribute(
        "aria-invalid",
        "true"
      )
    })

    it("names the quantity field for screen readers without a visible label", async () => {
      await withWhip()

      const input = quantityInput("Abyssal whip")
      expect(input).toHaveAttribute("inputmode", "numeric")
      expect(screen.getByText("Quantity of Abyssal whip")).toHaveClass(
        "sr-only"
      )
    })
  })

  describe("removing", () => {
    it("removes one item and returns focus to the search", async () => {
      render(<Harness />)
      await search("abyssal")
      fireEvent.click(screen.getByRole("option", { name: "Abyssal whip" }))
      fireEvent.click(screen.getByRole("option", { name: /^Abyssal tentacle/ }))
      const stray = document.createElement("button")
      document.body.appendChild(stray)
      stray.focus()

      fireEvent.click(
        screen.getByRole("button", { name: "Remove Abyssal whip" })
      )

      expect(
        screen.queryByRole("textbox", { name: "Quantity of Abyssal whip" })
      ).not.toBeInTheDocument()
      expect(quantityInput("Abyssal tentacle")).toBeInTheDocument()
      expect(
        screen.getByRole("heading", { name: "Selected (1)" })
      ).toBeInTheDocument()
      expect(searchField()).toHaveFocus()
      stray.remove()
    })

    it("clears everything with Clear all", async () => {
      const onChange = jest.fn()
      render(<Harness onChange={onChange} />)
      await search("abyssal")
      fireEvent.click(screen.getByRole("option", { name: "Abyssal whip" }))
      fireEvent.click(screen.getByRole("option", { name: /^Abyssal tentacle/ }))
      const stray = document.createElement("button")
      document.body.appendChild(stray)
      stray.focus()

      fireEvent.click(screen.getByRole("button", { name: "Clear all" }))

      expect(onChange).toHaveBeenLastCalledWith([])
      expect(
        screen.queryByRole("heading", { name: /Selected/ })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "Clear all" })
      ).not.toBeInTheDocument()
      expect(searchField()).toHaveFocus()
      stray.remove()
    })

    it("shows the count and Clear all only while something is selected", async () => {
      render(<Harness />)

      expect(
        screen.queryByRole("heading", { name: /Selected/ })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "Clear all" })
      ).not.toBeInTheDocument()

      await search("whip")
      fireEvent.click(screen.getByRole("option", { name: "Abyssal whip" }))

      expect(
        screen.getByRole("heading", { name: "Selected (1)" })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "Clear all" })
      ).toBeInTheDocument()
    })
  })

  describe("selected rows", () => {
    it("shows each picked item with its name, a remove button and quantity controls", () => {
      render(
        <Harness
          initial={[
            { item: ABYSSAL_WHIP, quantity: "4" },
            { item: DRAGON_DAGGER_P, quantity: "1" },
          ]}
        />
      )

      const rows = screen.getAllByRole("listitem")
      expect(rows).toHaveLength(2)
      const first = within(rows[0]!)
      expect(first.getByText("Abyssal whip")).toBeInTheDocument()
      expect(first.getByRole("textbox")).toHaveValue("4")
      expect(
        first.getByRole("button", { name: "Remove Abyssal whip" })
      ).toBeInTheDocument()
      expect(
        within(rows[1]!).getByRole("button", {
          name: "Remove Dragon dagger (p)",
        })
      ).toBeInTheDocument()
    })
  })
})
