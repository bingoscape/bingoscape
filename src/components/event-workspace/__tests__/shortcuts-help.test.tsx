import { fireEvent, render, screen } from "@testing-library/react"
import {
  ShortcutsHelp,
  getShortcuts,
} from "@/components/event-workspace/shortcuts-help"

describe("getShortcuts", () => {
  const labels = (hasMultipleBoards: boolean, canCollapsePanel: boolean) =>
    getShortcuts({ hasMultipleBoards, canCollapsePanel }).map((s) => s.label)

  it("always lists navigation, closing and the help shortcut", () => {
    expect(labels(false, false)).toEqual([
      "Move between Tiles",
      "First / last Tile in the row",
      "Open the focused Tile",
      "Close the Tile",
      "Show this list",
    ])
  })

  it("adds Board switching only with several Boards", () => {
    expect(labels(true, false)).toContain("Previous / next Board")
    expect(labels(false, false)).not.toContain("Previous / next Board")
  })

  it("adds the collapse shortcut only when the panel can collapse", () => {
    expect(labels(false, true)).toContain("Collapse the side panel")
    expect(labels(false, false)).not.toContain("Collapse the side panel")
  })
})

describe("ShortcutsHelp", () => {
  const props = { hasMultipleBoards: true, canCollapsePanel: true }

  it("opens from the button", () => {
    render(<ShortcutsHelp {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }))
    expect(
      screen.getByRole("heading", { name: "Keyboard shortcuts" })
    ).toBeInTheDocument()
  })

  it("toggles with Ctrl+/", () => {
    render(<ShortcutsHelp {...props} />)
    fireEvent.keyDown(window, { key: "/", ctrlKey: true })
    expect(screen.getByText("Previous / next Board")).toBeInTheDocument()
  })

  it("ignores Ctrl+/ while typing in a field", () => {
    render(
      <>
        <input aria-label="note" />
        <ShortcutsHelp {...props} />
      </>
    )
    fireEvent.keyDown(screen.getByLabelText("note"), {
      key: "/",
      ctrlKey: true,
    })
    expect(screen.queryByText("Previous / next Board")).not.toBeInTheDocument()
  })
})
