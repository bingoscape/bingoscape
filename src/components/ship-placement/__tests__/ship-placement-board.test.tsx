import { fireEvent, render, screen } from "@testing-library/react"

import {
  ShipPlacementBoard,
  type PlacementTile,
} from "@/components/ship-placement/ship-placement-board"
import type { PlacedShip } from "@/lib/ship-placement-state"

/**
 * 3x3 board, blind titles ("Tile N"). Index 4 (the middle) is hidden. The
 * tiles are passed in a shuffled order on purpose: the board must lay them out
 * by their index, not by their position in the array.
 */
const tile = (index: number, isHidden = false): PlacementTile => ({
  id: `t${index}`,
  index,
  title: `Tile ${index + 1}`,
  isHidden,
  isBlind: true,
})
const tiles = [8, 2, 0, 4, 6, 1, 3, 7, 5].map((i) => tile(i, i === 4))

function renderBoard(
  props: Partial<React.ComponentProps<typeof ShipPlacementBoard>> = {}
) {
  const onActivate = jest.fn()
  const onEscape = jest.fn()
  render(
    <ShipPlacementBoard
      tiles={tiles}
      rows={3}
      columns={3}
      ships={[]}
      current={null}
      selectedShipId={null}
      locked={false}
      onActivate={onActivate}
      onEscape={onEscape}
      {...props}
    />
  )
  return { onActivate, onEscape }
}

const cell = (name: string | RegExp) => screen.getByRole("gridcell", { name })

describe("ShipPlacementBoard", () => {
  it("is a grid of rows and cells with positional names", () => {
    renderBoard()
    expect(
      screen.getByRole("grid", {
        name: "Ship placement board, 3 rows by 3 columns",
      })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("row")).toHaveLength(3)
    expect(screen.getAllByRole("gridcell")).toHaveLength(9)
  })

  it("lays cells out by tile index, keeping the hidden cell in place", () => {
    renderBoard()
    const names = screen
      .getAllByRole("gridcell")
      .map((c) => c.getAttribute("aria-label"))
    expect(names).toEqual([
      "Row 1, column 1, Tile 1, empty",
      "Row 1, column 2, Tile 2, empty",
      "Row 1, column 3, Tile 3, empty",
      "Row 2, column 1, Tile 4, empty",
      "Row 2, column 2, hidden tile, cannot hold a ship",
      "Row 2, column 3, Tile 6, empty",
      "Row 3, column 1, Tile 7, empty",
      "Row 3, column 2, Tile 8, empty",
      "Row 3, column 3, Tile 9, empty",
    ])
  })

  it("names ships by their length, and shows the length as a numeral", () => {
    const ships: PlacedShip[] = [
      { id: "ship-0", length: 3, tileIds: ["t6", "t7", "t8"] },
    ]
    renderBoard({ ships })
    const placed = cell("Row 3, column 2, Tile 8, ship of length 3")
    expect(placed).toHaveTextContent("3")
    expect(
      cell("Row 3, column 1, Tile 7, ship of length 3")
    ).toBeInTheDocument()
  })

  it("marks the selected ship and the ship being built", () => {
    renderBoard({
      ships: [{ id: "ship-0", length: 2, tileIds: ["t0", "t1"] }],
      selectedShipId: "ship-0",
      current: { length: 3, tileIds: ["t6"] },
    })
    expect(cell(/Tile 1, ship of length 2, selected/)).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(cell(/Tile 7, ship of length 3, being placed/)).toBeInTheDocument()
    expect(cell(/Tile 3, empty/)).toHaveAttribute("aria-selected", "false")
  })

  it("activates a tile on click and on Enter or Space", () => {
    const { onActivate } = renderBoard()
    fireEvent.click(cell(/Tile 2, empty/))
    fireEvent.keyDown(cell(/Tile 3, empty/), { key: "Enter" })
    fireEvent.keyDown(cell(/Tile 6, empty/), { key: " " })
    expect(onActivate.mock.calls.map((c) => c[0])).toEqual(["t1", "t2", "t5"])
  })

  it("does not activate hidden tiles", () => {
    const { onActivate } = renderBoard()
    const hidden = cell(/hidden tile/)
    expect(hidden).toHaveAttribute("aria-disabled", "true")
    expect(hidden).not.toHaveAttribute("tabindex")
    fireEvent.click(hidden)
    fireEvent.keyDown(hidden, { key: "Enter" })
    expect(onActivate).not.toHaveBeenCalled()
  })

  it("has a single tab stop that moves with the arrow keys and skips hidden tiles", () => {
    renderBoard()
    const stops = () =>
      screen
        .getAllByRole("gridcell")
        .filter((c) => c.getAttribute("tabindex") === "0")
    expect(stops()).toHaveLength(1)
    expect(stops()[0]).toBe(cell(/Tile 1, empty/))

    cell(/Tile 1, empty/).focus()
    fireEvent.keyDown(cell(/Tile 1, empty/), { key: "ArrowRight" })
    expect(cell(/Tile 2, empty/)).toHaveFocus()
    expect(stops()[0]).toBe(cell(/Tile 2, empty/))

    // Down from Tile 2 would land on the hidden middle tile: it is skipped.
    fireEvent.keyDown(cell(/Tile 2, empty/), { key: "ArrowDown" })
    expect(cell(/Tile 8, empty/)).toHaveFocus()

    fireEvent.keyDown(cell(/Tile 8, empty/), { key: "ArrowLeft" })
    expect(cell(/Tile 7, empty/)).toHaveFocus()
    fireEvent.keyDown(cell(/Tile 7, empty/), { key: "ArrowUp" })
    expect(cell(/Tile 4, empty/)).toHaveFocus()
    fireEvent.keyDown(cell(/Tile 4, empty/), { key: "End" })
    expect(cell(/Tile 6, empty/)).toHaveFocus()
    fireEvent.keyDown(cell(/Tile 6, empty/), { key: "Home" })
    expect(cell(/Tile 4, empty/)).toHaveFocus()
  })

  it("reports Escape", () => {
    const { onEscape } = renderBoard()
    cell(/Tile 1, empty/).focus()
    fireEvent.keyDown(cell(/Tile 1, empty/), { key: "Escape" })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it("shows ships but ignores clicks and keys while locked", () => {
    const { onActivate } = renderBoard({
      locked: true,
      ships: [{ id: "ship-0", length: 2, tileIds: ["t0", "t1"] }],
    })
    expect(cell(/Tile 1, ship of length 2/)).toBeInTheDocument()
    const empty = cell(/Tile 3, empty/)
    expect(empty).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(empty)
    fireEvent.keyDown(empty, { key: "Enter" })
    expect(onActivate).not.toHaveBeenCalled()
  })

  it("keeps an empty cell for a missing tile instead of shifting the others", () => {
    renderBoard({ tiles: tiles.filter((t) => t.index !== 1) })
    expect(
      screen.getByRole("gridcell", { name: /Row 1, column 3, Tile 3/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("gridcell", { name: /Row 1, column 2/ })
    ).not.toBeInTheDocument()
  })
})
