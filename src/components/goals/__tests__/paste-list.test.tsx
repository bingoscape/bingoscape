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
import { resolveOsrsItemNames, searchOsrsItems } from "@/app/actions/osrs-items"
import type { OsrsItem } from "@/types/osrs-items"
import "./dom-polyfills"
import {
  ABYSSAL_TENTACLE,
  ABYSSAL_WHIP,
  DRAGON_DAGGER_P,
  searchFixtureItems,
} from "./item-fixtures"

jest.mock("@/app/actions/osrs-items", () => ({
  searchOsrsItems: jest.fn(),
  resolveOsrsItemNames: jest.fn(),
}))

const mockedSearch = searchOsrsItems as jest.MockedFunction<
  typeof searchOsrsItems
>
const mockedResolve = resolveOsrsItemNames as jest.MockedFunction<
  typeof resolveOsrsItemNames
>

const DRAGON_DAGGER_PP: OsrsItem = {
  id: [1233, 5698],
  name: "Dragon dagger#(p+)",
  baseName: "Dragon dagger",
  variant: "(p+)",
  imageUrl: "/dagger-pp.png",
}

type ResolveResult = Awaited<ReturnType<typeof resolveOsrsItemNames>>

/**
 * Stands in for the server: whip and tentacle match, "dragon dagger" fits two
 * variants, anything else is not found.
 */
function fakeResolve(
  entries: Parameters<typeof resolveOsrsItemNames>[0]
): ResolveResult {
  return {
    success: true,
    results: entries.map(({ name, quantity }) => {
      const key = name.trim().toLowerCase()
      if (key === "abyssal whip") {
        return {
          input: name,
          quantity,
          status: "matched" as const,
          item: ABYSSAL_WHIP,
        }
      }
      if (key === "abyssal tentacle") {
        return {
          input: name,
          quantity,
          status: "matched" as const,
          item: ABYSSAL_TENTACLE,
        }
      }
      if (key === "dragon dagger") {
        return {
          input: name,
          quantity,
          status: "ambiguous" as const,
          candidates: [DRAGON_DAGGER_P, DRAGON_DAGGER_PP],
        }
      }
      return { input: name, quantity, status: "unmatched" as const }
    }),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function Harness({
  initial = [],
  onChange,
  onSubmit,
}: {
  initial?: SelectedItem[]
  onChange?: (value: SelectedItem[]) => void
  onSubmit?: () => void
}) {
  const [value, setValue] = useState<SelectedItem[]>(initial)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit?.()
      }}
    >
      <ItemPicker
        value={value}
        onChange={(next) => {
          setValue(next)
          onChange?.(next)
        }}
      />
    </form>
  )
}

const pasteButton = () => screen.getByRole("button", { name: "Paste a list" })
const pasteBox = () =>
  screen.getByRole("textbox", { name: "One item per line" })
const searchField = () =>
  screen.getByRole("combobox", { name: "Search items" }) as HTMLInputElement
const reviewButton = () => screen.getByRole("button", { name: "Review list" })
const quantity = (name: string) =>
  screen.getByRole("textbox", {
    name: `Pasted quantity of ${name}`,
  }) as HTMLInputElement
const selectedQuantity = (name: string) =>
  screen.getByRole("textbox", {
    name: `Quantity of ${name}`,
  }) as HTMLInputElement
const confirmButton = (count: number) =>
  screen.getByRole("button", {
    name: `Add ${count} ${count === 1 ? "item" : "items"} to selection`,
  })

/** Opens the panel, pastes the text and waits for the review. */
async function reviewList(text: string) {
  fireEvent.click(pasteButton())
  fireEvent.change(pasteBox(), { target: { value: text } })
  fireEvent.click(reviewButton())
  await screen.findByRole("list", { name: "Pasted items" })
}

const MIXED = "3x Abyssal whip\nDragon dagger\nAbysal whip"

describe("Paste a list", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedSearch.mockImplementation(async (query) => searchFixtureItems(query))
    mockedResolve.mockImplementation(async (entries) => fakeResolve(entries))
  })

  describe("opening", () => {
    it("reveals a labelled text box that has focus, and hides it again on Cancel", () => {
      render(<Harness />)
      expect(pasteButton()).toHaveAttribute("aria-expanded", "false")
      expect(
        screen.queryByRole("textbox", { name: "One item per line" })
      ).not.toBeInTheDocument()

      fireEvent.click(pasteButton())

      expect(pasteBox()).toHaveFocus()
      expect(pasteButton()).toHaveAttribute("aria-expanded", "true")
      expect(
        screen.getByText(/3x Dragon bones, Dragon bones x3/)
      ).toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

      expect(
        screen.queryByRole("textbox", { name: "One item per line" })
      ).not.toBeInTheDocument()
      expect(pasteButton()).toHaveFocus()
    })

    it("closes with the Paste a list button too", () => {
      render(<Harness />)
      fireEvent.click(pasteButton())
      fireEvent.click(pasteButton())

      expect(
        screen.queryByRole("textbox", { name: "One item per line" })
      ).not.toBeInTheDocument()
    })

    it("keeps the item search next to it", () => {
      render(<Harness />)
      fireEvent.click(pasteButton())

      expect(searchField()).toBeInTheDocument()
    })

    it("cannot review an empty list", () => {
      render(<Harness />)
      fireEvent.click(pasteButton())

      expect(reviewButton()).toBeDisabled()
      fireEvent.change(pasteBox(), { target: { value: "  \n - \n" } })
      expect(reviewButton()).toBeDisabled()
    })
  })

  describe("typing and pasting", () => {
    it("counts the items found as the text changes", () => {
      render(<Harness />)
      fireEvent.click(pasteButton())

      fireEvent.change(pasteBox(), { target: { value: "Abyssal whip" } })
      expect(screen.getByText("1 item found")).toBeInTheDocument()

      fireEvent.change(pasteBox(), {
        target: {
          value: "Abyssal whip\n\n3x Abyssal tentacle\n- Dragon bones",
        },
      })
      expect(screen.getByText("3 items found")).toBeInTheDocument()
      expect(reviewButton()).toBeEnabled()
    })

    it("says how many entries were ignored beyond the limit", () => {
      render(<Harness />)
      fireEvent.click(pasteButton())

      fireEvent.change(pasteBox(), {
        target: {
          value: Array.from({ length: 105 }, (_, i) => `Item ${i}`).join("\n"),
        },
      })

      expect(
        screen.getByText(/100 items found, 5 ignored \(up to 100 items/)
      ).toBeInTheDocument()
    })

    it("sends the parsed names and quantities, with the other readings where there are any", async () => {
      render(<Harness />)
      await reviewList("3x Abyssal whip\nAmulet of glory(4)\nAbyssal tentacle")

      expect(mockedResolve).toHaveBeenCalledTimes(1)
      expect(mockedResolve).toHaveBeenCalledWith([
        { name: "Abyssal whip", quantity: 3 },
        {
          name: "Amulet of glory",
          quantity: 4,
          alternatives: [{ name: "Amulet of glory(4)", quantity: 1 }],
        },
        { name: "Abyssal tentacle", quantity: 1 },
      ])
    })
  })

  describe("resolving", () => {
    it("shows progress, disables the controls and announces the result", async () => {
      const pending = deferred<ResolveResult>()
      mockedResolve.mockReturnValueOnce(pending.promise)
      render(<Harness />)
      fireEvent.click(pasteButton())
      fireEvent.change(pasteBox(), { target: { value: MIXED } })

      fireEvent.click(reviewButton())

      expect(screen.getByText("Matching 3 items...")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Matching..." })).toBeDisabled()
      expect(pasteBox()).toBeDisabled()
      // The progress text is in a polite live region.
      expect(
        screen.getByText("Matching 3 items...").closest("[role=status]")
      ).toHaveAttribute("aria-live", "polite")

      await act(async () => {
        pending.resolve(
          fakeResolve([
            { name: "Abyssal whip", quantity: 3 },
            { name: "Dragon dagger", quantity: 1 },
            { name: "Abysal whip", quantity: 1 },
          ])
        )
      })

      const summary = await screen.findByText(
        "1 matched, 1 needs a choice, 1 not found"
      )
      expect(summary.closest("[role=status]")).toHaveAttribute(
        "aria-live",
        "polite"
      )
      expect(screen.queryByText("Matching 3 items...")).not.toBeInTheDocument()
    })

    it("calls the action only once even if Review is clicked again while waiting", async () => {
      mockedResolve.mockReturnValueOnce(deferred<ResolveResult>().promise)
      render(<Harness />)
      fireEvent.click(pasteButton())
      fireEvent.change(pasteBox(), { target: { value: MIXED } })

      fireEvent.click(reviewButton())
      fireEvent.click(screen.getByRole("button", { name: "Matching..." }))

      expect(mockedResolve).toHaveBeenCalledTimes(1)
    })

    it("goes back to the text with a friendly error when the action throws", async () => {
      const error = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined)
      mockedResolve.mockRejectedValueOnce(new Error("offline"))
      render(<Harness />)
      fireEvent.click(pasteButton())
      fireEvent.change(pasteBox(), { target: { value: MIXED } })

      fireEvent.click(reviewButton())

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /could not match your list/i
      )
      // The text is still there, ready for another try.
      expect(pasteBox()).toHaveValue(MIXED)
      expect(reviewButton()).toBeEnabled()
      error.mockRestore()
    })

    it("shows the server's error when it reports a failure", async () => {
      mockedResolve.mockResolvedValueOnce({
        success: false,
        results: [],
        error: "You can add at most 100 items at once",
      })
      render(<Harness />)
      fireEvent.click(pasteButton())
      fireEvent.change(pasteBox(), { target: { value: MIXED } })

      fireEvent.click(reviewButton())

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "You can add at most 100 items at once"
      )
      expect(pasteBox()).toHaveValue(MIXED)
    })

    it("treats a reply of the wrong length as a failure", async () => {
      mockedResolve.mockResolvedValueOnce({ success: true, results: [] })
      render(<Harness />)
      fireEvent.click(pasteButton())
      fireEvent.change(pasteBox(), { target: { value: MIXED } })

      fireEvent.click(reviewButton())

      expect(await screen.findByRole("alert")).toBeInTheDocument()
      expect(pasteBox()).toBeInTheDocument()
    })

    it("ignores a reply that arrives after the review was left", async () => {
      const pending = deferred<ResolveResult>()
      mockedResolve.mockReturnValueOnce(pending.promise)
      render(<Harness />)
      fireEvent.click(pasteButton())
      fireEvent.change(pasteBox(), { target: { value: MIXED } })
      fireEvent.click(reviewButton())

      fireEvent.keyDown(screen.getByRole("heading", { name: "Paste a list" }), {
        key: "Escape",
      })
      await act(async () => {
        pending.resolve(fakeResolve([{ name: "Abyssal whip", quantity: 1 }]))
      })

      expect(pasteBox()).toHaveValue(MIXED)
      expect(
        screen.queryByRole("list", { name: "Pasted items" })
      ).not.toBeInTheDocument()
    })
  })

  describe("review", () => {
    it("summarises matched, ambiguous and unmatched lines", async () => {
      render(<Harness />)
      await reviewList(MIXED)

      expect(
        screen.getByText("1 matched, 1 needs a choice, 1 not found")
      ).toBeInTheDocument()
      expect(screen.getAllByRole("listitem")).toHaveLength(3)
    })

    it("shows a matched line with its icon, name, original text and editable quantity", async () => {
      const { container } = render(<Harness />)
      await reviewList("3x Abyssal whip")

      const list = screen.getByRole("list", { name: "Pasted items" })
      const row = within(list).getByRole("listitem")
      expect(within(row).getByText("Abyssal whip")).toBeInTheDocument()
      expect(
        within(row).getByText("from “3x Abyssal whip”")
      ).toBeInTheDocument()
      expect(row.querySelector("img")).not.toBeNull()
      expect(quantity("Abyssal whip")).toHaveValue("3")
      expect(container.querySelector("select")).toBeNull()
    })

    it("leaves out the original text when it is just the name", async () => {
      render(<Harness />)
      await reviewList("Abyssal whip")

      expect(screen.queryByText(/^from /)).not.toBeInTheDocument()
    })

    it("lets the quantity be typed, shorthand included, and stepped", async () => {
      render(<Harness />)
      await reviewList("Abyssal whip")

      fireEvent.change(quantity("Abyssal whip"), { target: { value: "2k" } })
      expect(quantity("Abyssal whip")).toHaveValue("2k")
      fireEvent.change(quantity("Abyssal whip"), { target: { value: "5" } })
      fireEvent.click(
        screen.getByRole("button", {
          name: "Increase pasted quantity of Abyssal whip",
        })
      )
      expect(quantity("Abyssal whip")).toHaveValue("6")
    })

    it("blocks confirming an invalid quantity and names the item", async () => {
      render(<Harness />)
      await reviewList("Abyssal whip\nAbyssal tentacle")

      fireEvent.change(quantity("Abyssal tentacle"), { target: { value: "0" } })

      expect(confirmButton(2)).toBeDisabled()
      expect(confirmButton(2)).toHaveAccessibleDescription(
        /Quantity for Abyssal tentacle: .*greater than 0/i
      )
      fireEvent.change(quantity("Abyssal tentacle"), { target: { value: "4" } })
      expect(confirmButton(2)).toBeEnabled()
    })

    it("does not submit the surrounding form when Enter is pressed in a quantity", async () => {
      const onSubmit = jest.fn()
      render(<Harness onSubmit={onSubmit} />)
      await reviewList("Abyssal whip")

      const notPrevented = fireEvent.keyDown(quantity("Abyssal whip"), {
        key: "Enter",
      })

      expect(notPrevented).toBe(false)
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it("has a scrollable list that is bounded in height", async () => {
      render(<Harness />)
      await reviewList(MIXED)

      expect(
        screen.getByRole("list", { name: "Pasted items" }).className
      ).toMatch(/max-h-\[min\(22rem,45dvh\)\].*overflow-y-auto/)
    })

    it("puts the confirm button above the list so it needs no scrolling", async () => {
      render(<Harness />)
      await reviewList("Abyssal whip")

      const list = screen.getByRole("list", { name: "Pasted items" })
      expect(
        confirmButton(1).compareDocumentPosition(list) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    })

    describe("ambiguous lines", () => {
      it("offers the candidates in a labelled choice that starts on Choose one", async () => {
        render(<Harness />)
        await reviewList("Dragon dagger")

        const choice = screen.getByRole("combobox", {
          name: "Choose an item for “Dragon dagger”",
        })
        expect(choice).toHaveValue("")
        expect(
          within(choice)
            .getAllByRole("option")
            .map((option) => option.textContent)
        ).toEqual(["Choose one...", "Dragon dagger (p)", "Dragon dagger (p+)"])
        expect(
          screen.getByText(/Choose one: this fits several items/)
        ).toBeInTheDocument()
      })

      it("blocks confirming until a choice is made, and says why", async () => {
        render(<Harness />)
        await reviewList("Dragon dagger\nAbyssal whip")

        const confirm = confirmButton(1)
        expect(confirm).toBeDisabled()
        expect(confirm).toHaveAccessibleDescription(
          "Choose an item for 1 line, or remove it."
        )

        fireEvent.change(
          screen.getByRole("combobox", {
            name: "Choose an item for “Dragon dagger”",
          }),
          { target: { value: "1233-Dragon dagger#(p+)" } }
        )

        expect(screen.getByText("2 matched")).toBeInTheDocument()
        expect(confirmButton(2)).toBeEnabled()
        // The row now reads like a matched one, and the choice can still change.
        expect(quantity("Dragon dagger (p+)")).toHaveValue("1")
        expect(
          screen.getByRole("combobox", {
            name: "Choose an item for “Dragon dagger”",
          })
        ).toHaveValue("1233-Dragon dagger#(p+)")
      })

      it("counts several lines that need a choice", async () => {
        render(<Harness />)
        await reviewList("Dragon dagger\nDragon dagger\nAbyssal whip")

        expect(
          screen.getByText("1 matched, 2 need a choice")
        ).toBeInTheDocument()
        expect(confirmButton(1)).toHaveAccessibleDescription(
          "Choose an item for 2 lines, or remove them."
        )
      })

      it("unblocks when the line is removed instead", async () => {
        render(<Harness />)
        await reviewList("Dragon dagger\nAbyssal whip")

        fireEvent.click(
          screen.getByRole("button", {
            name: "Remove Dragon dagger from the list",
          })
        )

        expect(confirmButton(1)).toBeEnabled()
        expect(screen.getByText("1 matched")).toBeInTheDocument()
      })

      it("keeps the quantity of the line through the choice", async () => {
        render(<Harness />)
        await reviewList("3x Dragon dagger")

        fireEvent.change(
          screen.getByRole("combobox", {
            name: "Choose an item for “Dragon dagger”",
          }),
          { target: { value: "1231-Dragon dagger#(p)" } }
        )

        expect(quantity("Dragon dagger (p)")).toHaveValue("3")
      })

      it("tells apart candidates that read the same by their id", async () => {
        mockedResolve.mockResolvedValueOnce({
          success: true,
          results: [
            {
              input: "Black mask",
              quantity: 1,
              status: "ambiguous",
              candidates: [
                { ...ABYSSAL_WHIP, id: 11, name: "Black mask" },
                { ...ABYSSAL_WHIP, id: 22, name: "Black mask" },
              ],
            },
          ],
        })
        render(<Harness />)
        await reviewList("Black mask")

        const choice = screen.getByRole("combobox", {
          name: "Choose an item for “Black mask”",
        })
        expect(
          within(choice)
            .getAllByRole("option")
            .map((option) => option.textContent)
        ).toEqual(["Choose one...", "Black mask (id 11)", "Black mask (id 22)"])
      })
    })

    describe("lines that were not found", () => {
      it("flags the original text and offers Search instead and Remove", async () => {
        render(<Harness />)
        await reviewList("Abysal whip")

        expect(screen.getByText("“Abysal whip”")).toBeInTheDocument()
        expect(screen.getByText("Not found")).toBeInTheDocument()
        expect(
          screen.getByRole("button", { name: "Search instead" })
        ).toBeInTheDocument()
        expect(
          screen.getByRole("button", {
            name: "Remove “Abysal whip” from the list",
          })
        ).toBeInTheDocument()
      })

      it("does not block the others, and says they are skipped", async () => {
        render(<Harness />)
        await reviewList("Abyssal whip\nAbysal whip\nNonsense")

        expect(confirmButton(1)).toBeEnabled()
        expect(
          screen.getByText("2 lines not found will be skipped.")
        ).toBeInTheDocument()
      })

      it("Search instead fills the item search with the text and focuses it, keeping the review", async () => {
        render(<Harness />)
        await reviewList("Abyssal whip\nAbysal whip")

        fireEvent.click(screen.getByRole("button", { name: "Search instead" }))

        expect(searchField()).toHaveValue("Abysal whip")
        expect(searchField()).toHaveFocus()
        expect(
          screen.getByRole("list", { name: "Pasted items" })
        ).toBeInTheDocument()
        await waitFor(() =>
          expect(mockedSearch).toHaveBeenCalledWith("Abysal whip", 30)
        )
      })

      it("searches for the text without a quantity", async () => {
        render(<Harness />)
        await reviewList("Abysal whip, 5")

        fireEvent.click(screen.getByRole("button", { name: "Search instead" }))

        expect(searchField()).toHaveValue("Abysal whip")
      })

      it("removes the line with Remove", async () => {
        render(<Harness />)
        await reviewList("Abyssal whip\nAbysal whip")

        fireEvent.click(
          screen.getByRole("button", {
            name: "Remove “Abysal whip” from the list",
          })
        )

        expect(screen.queryByText("“Abysal whip”")).not.toBeInTheDocument()
        expect(screen.getByText("1 matched")).toBeInTheDocument()
      })
    })

    describe("removing lines", () => {
      it("removes a matched line with its button", async () => {
        render(<Harness />)
        await reviewList("Abyssal whip\nAbyssal tentacle")

        fireEvent.click(
          screen.getByRole("button", {
            name: "Remove Abyssal whip from the list",
          })
        )

        expect(screen.getAllByRole("listitem")).toHaveLength(1)
        expect(screen.getByText("1 matched")).toBeInTheDocument()
        expect(confirmButton(1)).toBeEnabled()
        // Keyboard focus stays in the panel instead of falling to the page.
        expect(
          screen.getByRole("heading", { name: "Review your list" })
        ).toHaveFocus()
      })

      it("cannot confirm once every line is removed", async () => {
        render(<Harness />)
        await reviewList("Abyssal whip")

        fireEvent.click(
          screen.getByRole("button", {
            name: "Remove Abyssal whip from the list",
          })
        )

        expect(screen.getByText("Nothing left in the list")).toBeInTheDocument()
        expect(confirmButton(0)).toBeDisabled()
        expect(confirmButton(0)).toHaveAccessibleDescription(
          "There is nothing to add yet."
        )
      })
    })

    describe("leaving the review", () => {
      it("Edit list returns to the text, which is kept", async () => {
        render(<Harness />)
        await reviewList(MIXED)

        fireEvent.click(screen.getByRole("button", { name: "Edit list" }))

        expect(pasteBox()).toHaveValue(MIXED)
        expect(pasteBox()).toHaveFocus()
        expect(
          screen.queryByRole("list", { name: "Pasted items" })
        ).not.toBeInTheDocument()
      })

      it("Cancel drops the list without touching the selection", async () => {
        const onChange = jest.fn()
        render(<Harness onChange={onChange} />)
        await reviewList(MIXED)

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

        expect(
          screen.queryByRole("list", { name: "Pasted items" })
        ).not.toBeInTheDocument()
        expect(onChange).not.toHaveBeenCalled()
        expect(screen.queryByText(/^Selected \(/)).not.toBeInTheDocument()
      })

      it("steps back with Escape: review, then text, then closed", async () => {
        render(<Harness />)
        await reviewList("Abyssal whip")

        fireEvent.keyDown(quantity("Abyssal whip"), { key: "Escape" })
        expect(pasteBox()).toHaveValue("Abyssal whip")

        fireEvent.keyDown(pasteBox(), { key: "Escape" })
        expect(pasteBox()).toHaveValue("")

        fireEvent.keyDown(pasteBox(), { key: "Escape" })
        expect(
          screen.queryByRole("textbox", { name: "One item per line" })
        ).not.toBeInTheDocument()
      })

      it("starts over with a fresh list when opened again", async () => {
        render(<Harness />)
        await reviewList(MIXED)
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

        fireEvent.click(pasteButton())

        expect(pasteBox()).toHaveValue("")
      })
    })
  })

  describe("confirming", () => {
    it("moves the resolved lines into the selection with their quantities and creates nothing", async () => {
      const onChange = jest.fn()
      render(<Harness onChange={onChange} />)
      await reviewList(
        "3x Abyssal whip\nDragon dagger\nAbysal whip\nAbyssal tentacle x2k"
      )
      fireEvent.change(
        screen.getByRole("combobox", {
          name: "Choose an item for “Dragon dagger”",
        }),
        { target: { value: "1231-Dragon dagger#(p)" } }
      )

      fireEvent.click(confirmButton(3))

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith([
        { item: ABYSSAL_WHIP, quantity: "3" },
        { item: DRAGON_DAGGER_P, quantity: "1" },
        { item: ABYSSAL_TENTACLE, quantity: "2000" },
      ])
      expect(screen.getByText("Selected (3)")).toBeInTheDocument()
      expect(selectedQuantity("Abyssal whip")).toHaveValue("3")
      expect(selectedQuantity("Abyssal tentacle")).toHaveValue("2000")
      expect(selectedQuantity("Dragon dagger (p)")).toHaveValue("1")
      // The unmatched line is skipped.
      expect(screen.queryByText(/Abysal whip/)).not.toBeInTheDocument()
    })

    it("closes the panel, focuses the search and announces what was added", async () => {
      render(<Harness />)
      await reviewList("Abyssal whip\nAbyssal tentacle")

      fireEvent.click(confirmButton(2))

      expect(
        screen.queryByRole("textbox", { name: "One item per line" })
      ).not.toBeInTheDocument()
      expect(searchField()).toHaveFocus()
      expect(
        screen.getByText("2 items added from your list. 2 items selected.")
      ).toBeInTheDocument()
    })

    it("sums the quantity of an item that is already selected", async () => {
      const onChange = jest.fn()
      render(
        <Harness
          onChange={onChange}
          initial={[
            { item: ABYSSAL_WHIP, quantity: "2" },
            { item: ABYSSAL_TENTACLE, quantity: "1" },
          ]}
        />
      )
      await reviewList("3x Abyssal whip")

      fireEvent.click(confirmButton(1))

      expect(onChange).toHaveBeenCalledWith([
        { item: ABYSSAL_WHIP, quantity: "5" },
        { item: ABYSSAL_TENTACLE, quantity: "1" },
      ])
      expect(screen.getByText("Selected (2)")).toBeInTheDocument()
      expect(selectedQuantity("Abyssal whip")).toHaveValue("5")
    })

    it("sums an item listed on two lines into one selected row", async () => {
      render(<Harness />)
      await reviewList("2x Abyssal whip\nAbyssal whip x3")

      fireEvent.click(confirmButton(2))

      expect(screen.getByText("Selected (1)")).toBeInTheDocument()
      expect(selectedQuantity("Abyssal whip")).toHaveValue("5")
    })

    it("uses the quantity as edited in the review", async () => {
      render(<Harness />)
      await reviewList("Abyssal whip")
      fireEvent.change(quantity("Abyssal whip"), { target: { value: "1k" } })

      fireEvent.click(confirmButton(1))

      expect(selectedQuantity("Abyssal whip")).toHaveValue("1000")
    })
  })
})
