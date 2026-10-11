import { useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MetricCombobox } from "@/components/goals/metric-combobox"
import "./dom-polyfills"

function Harness({
  metricType = "boss",
  initial = "",
  autoFocus,
  onValueChange,
}: {
  metricType?: "boss" | "activity"
  initial?: string
  autoFocus?: boolean
  onValueChange?: (metric: string) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <MetricCombobox
      metricType={metricType}
      value={value}
      autoFocus={autoFocus}
      onValueChange={(metric) => {
        setValue(metric)
        onValueChange?.(metric)
      }}
    />
  )
}

const search = (name = "Search bosses") =>
  screen.getByRole("combobox", { name })

describe("MetricCombobox", () => {
  it("lists the bosses inline with a search field, no popover needed", () => {
    render(<Harness />)

    expect(search()).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Zulrah" })).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Abyssal Sire" })
    ).toBeInTheDocument()
    expect(screen.getByText("Boss", { selector: "p" })).toBeInTheDocument()
  })

  it("lists activities when asked for them", () => {
    render(<Harness metricType="activity" />)

    expect(search("Search activities")).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Clue Scrolls (All)" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Zulrah" })).not.toBeInTheDocument()
  })

  it("filters the list as the user types", async () => {
    render(<Harness />)

    fireEvent.change(search(), { target: { value: "zulrah" } })

    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: "Abyssal Sire" })
      ).not.toBeInTheDocument()
    )
    expect(screen.getByRole("option", { name: "Zulrah" })).toBeInTheDocument()
  })

  it("matches on the display name, which has spaces where the id has underscores", async () => {
    render(<Harness />)

    fireEvent.change(search(), { target: { value: "dagannoth rex" } })

    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: "Zulrah" })
      ).not.toBeInTheDocument()
    )
    expect(
      screen.getByRole("option", { name: "Dagannoth Rex" })
    ).toBeInTheDocument()
  })

  it("says so when nothing matches", async () => {
    render(<Harness />)

    fireEvent.change(search(), { target: { value: "qqqqqq" } })

    expect(await screen.findByText("No boss found.")).toBeInTheDocument()
  })

  it("selects a boss on click and collapses to the choice with a Change button", async () => {
    const onValueChange = jest.fn()
    render(<Harness onValueChange={onValueChange} />)

    fireEvent.click(screen.getByRole("option", { name: "Zulrah" }))

    expect(onValueChange).toHaveBeenCalledWith("zulrah")
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.getByText("Zulrah", { selector: "p" })).toBeInTheDocument()
    const change = screen.getByRole("button", { name: "Change boss: Zulrah" })
    // Focus must not be lost when the list disappears.
    await waitFor(() => expect(change).toHaveFocus())
  })

  it("selects the highlighted boss with Enter", async () => {
    const onValueChange = jest.fn()
    render(<Harness onValueChange={onValueChange} />)

    fireEvent.change(search(), { target: { value: "zulrah" } })
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Zulrah" })).toHaveAttribute(
        "aria-selected",
        "true"
      )
    )
    fireEvent.keyDown(search(), { key: "Enter" })

    expect(onValueChange).toHaveBeenCalledWith("zulrah")
  })

  it("moves the highlight with the arrow keys", async () => {
    const onValueChange = jest.fn()
    render(<Harness onValueChange={onValueChange} />)

    const options = screen.getAllByRole("option")
    await waitFor(() =>
      expect(options[0]).toHaveAttribute("aria-selected", "true")
    )
    fireEvent.keyDown(search(), { key: "ArrowDown" })
    await waitFor(() =>
      expect(options[1]).toHaveAttribute("aria-selected", "true")
    )
    fireEvent.keyDown(search(), { key: "Enter" })

    expect(onValueChange).toHaveBeenCalledWith(
      options[1]!.getAttribute("data-value")
    )
  })

  it("starts collapsed on the current choice", () => {
    render(<Harness initial="vorkath" />)

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.getByText("Vorkath", { selector: "p" })).toBeInTheDocument()
  })

  it("reopens the search from Change, with the search focused and the current boss marked", async () => {
    render(<Harness initial="vorkath" />)

    fireEvent.click(screen.getByRole("button", { name: "Change boss: Vorkath" }))

    expect(search()).toHaveFocus()
    expect(
      screen.getByRole("option", { name: /^Vorkath\s*Selected$/ })
    ).toBeInTheDocument()
  })

  it("changes to another boss", async () => {
    const onValueChange = jest.fn()
    render(<Harness initial="vorkath" onValueChange={onValueChange} />)

    fireEvent.click(screen.getByRole("button", { name: "Change boss: Vorkath" }))
    fireEvent.click(screen.getByRole("option", { name: "Zulrah" }))

    expect(onValueChange).toHaveBeenCalledWith("zulrah")
    expect(screen.getByText("Zulrah", { selector: "p" })).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Change boss: Zulrah" })
      ).toHaveFocus()
    )
  })

  it("keeps the current boss when the change is cancelled", async () => {
    const onValueChange = jest.fn()
    render(<Harness initial="vorkath" onValueChange={onValueChange} />)

    fireEvent.click(screen.getByRole("button", { name: "Change boss: Vorkath" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onValueChange).not.toHaveBeenCalled()
    expect(screen.getByText("Vorkath", { selector: "p" })).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Change boss: Vorkath" })
      ).toHaveFocus()
    )
  })

  it("does not offer Cancel before anything was chosen", () => {
    render(<Harness />)

    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument()
  })

  it("focuses the search on mount when asked to", () => {
    render(<Harness autoFocus />)

    expect(search()).toHaveFocus()
  })

  it("does not take focus by default", () => {
    render(<Harness />)

    expect(search()).not.toHaveFocus()
  })

  it("shows a stand-in glyph when the wiki has no icon for a boss", () => {
    const { container } = render(<Harness />)
    const option = screen.getByRole("option", { name: "Zulrah" })
    expect(option.querySelector("img")).toBeInTheDocument()

    fireEvent.error(option.querySelector("img")!)

    expect(option.querySelector("img")).not.toBeInTheDocument()
    expect(option.querySelector("svg")).toBeInTheDocument()
    // The other rows keep their icons.
    expect(container.querySelectorAll("[cmdk-item] img").length).toBeGreaterThan(10)
  })

  it("clears the typed text with Escape and marks the field so the drawer lets it", () => {
    render(<Harness />)
    fireEvent.change(search(), { target: { value: "zul" } })

    expect(search()).toHaveAttribute("data-escape-clears")
    fireEvent.keyDown(search(), { key: "Escape" })

    expect(search()).toHaveValue("")
  })
})
