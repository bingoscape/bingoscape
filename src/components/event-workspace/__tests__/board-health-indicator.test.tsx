import { fireEvent, render, screen } from "@testing-library/react"
import { BoardHealthIndicator } from "@/components/event-workspace/board-health-indicator"
import type { Tile } from "@/types/model"

const makeTile = (
  index: number,
  goalCount: number,
  overrides: Partial<Tile> = {}
): Tile =>
  ({
    id: `t${index}`,
    index,
    title: `Tile ${index + 1}`,
    isHidden: false,
    goals: Array.from({ length: goalCount }, (_, i) => ({
      id: `g${index}-${i}`,
    })),
    ...overrides,
  }) as unknown as Tile

describe("BoardHealthIndicator", () => {
  const setup = (tiles: Tile[], selectedTileId: string | null = null) => {
    const onSelectTile = jest.fn()
    const utils = render(
      <BoardHealthIndicator
        tiles={tiles}
        selectedTileId={selectedTileId}
        onSelectTile={onSelectTile}
      />
    )
    return { onSelectTile, ...utils }
  }

  const indicator = () =>
    screen.getByRole("button", { name: /have no goals|has no goals/ })

  it("renders no button when every tile has goals", () => {
    setup([makeTile(0, 1), makeTile(1, 2)])
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("keeps an empty live region in the page when there is nothing to report", () => {
    setup([makeTile(0, 1)])
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.getByRole("status").textContent).toBe("")
  })

  it("uses the singular for one tile", () => {
    setup([makeTile(0, 1), makeTile(1, 0)])
    expect(indicator()).toHaveTextContent("1 tile has no goals")
  })

  it("uses the plural for several tiles", () => {
    setup([makeTile(0, 0), makeTile(1, 0), makeTile(2, 3)])
    expect(indicator()).toHaveTextContent("2 tiles have no goals")
  })

  it("does not count hidden tiles", () => {
    setup([makeTile(0, 0, { isHidden: true }), makeTile(1, 0), makeTile(2, 1)])
    expect(indicator()).toHaveTextContent("1 tile has no goals")
  })

  it("is a real button that says what pressing it does", () => {
    setup([makeTile(0, 0)])
    const button = indicator()
    expect(button.tagName).toBe("BUTTON")
    expect(button).toHaveAttribute("type", "button")
    expect(button).toHaveAccessibleName(
      "1 tile has no goals. Select the next one."
    )
  })

  it("has a 44px target on coarse pointers", () => {
    setup([makeTile(0, 0)])
    expect(indicator()).toHaveClass("pointer-coarse:min-h-11")
  })

  it("selects the first tile without goals when nothing is selected", () => {
    const { onSelectTile } = setup([
      makeTile(0, 1),
      makeTile(1, 0),
      makeTile(2, 0),
    ])
    fireEvent.click(indicator())
    expect(onSelectTile).toHaveBeenCalledTimes(1)
    expect(onSelectTile).toHaveBeenCalledWith("t1")
  })

  it("moves past a selected tile that has no goals", () => {
    const { onSelectTile } = setup(
      [makeTile(0, 1), makeTile(1, 0), makeTile(2, 0)],
      "t1"
    )
    fireEvent.click(indicator())
    expect(onSelectTile).toHaveBeenCalledWith("t2")
  })

  it("wraps around after the last tile without goals", () => {
    const { onSelectTile } = setup(
      [makeTile(0, 0), makeTile(1, 1), makeTile(2, 0)],
      "t2"
    )
    fireEvent.click(indicator())
    expect(onSelectTile).toHaveBeenCalledWith("t0")
  })

  it("announces the tile it selected, politely", () => {
    setup([makeTile(0, 1), makeTile(1, 0), makeTile(2, 0)])
    fireEvent.click(indicator())
    const region = screen.getByRole("status")
    expect(region).toHaveAttribute("aria-live", "polite")
    expect(region).toHaveTextContent(
      "Selected Tile 2, tile 1 of 2 without goals."
    )
  })

  it("mentions wrapping in the announcement", () => {
    setup([makeTile(0, 0), makeTile(1, 0)], "t1")
    fireEvent.click(indicator())
    expect(screen.getByRole("status")).toHaveTextContent(
      "Selected Tile 1, tile 1 of 2 without goals, back at the start of the board."
    )
  })

  it("says so, without selecting anything, when the selected tile is the only one", () => {
    const { onSelectTile } = setup([makeTile(0, 1), makeTile(1, 0)], "t1")
    fireEvent.click(indicator())
    expect(onSelectTile).not.toHaveBeenCalled()
    expect(screen.getByRole("status")).toHaveTextContent(
      "Tile 2 is the only tile without goals."
    )
  })

  it("continues from the last jump after the selection was cleared", () => {
    const tiles = [makeTile(0, 0), makeTile(1, 0), makeTile(2, 0)]
    const onSelectTile = jest.fn()
    const { rerender } = render(
      <BoardHealthIndicator
        tiles={tiles}
        selectedTileId={null}
        onSelectTile={onSelectTile}
      />
    )
    fireEvent.click(indicator())
    expect(onSelectTile).toHaveBeenLastCalledWith("t0")

    // The Tile panel was closed (a drawer on phones), so nothing is selected.
    rerender(
      <BoardHealthIndicator
        tiles={tiles}
        selectedTileId={null}
        onSelectTile={onSelectTile}
      />
    )
    fireEvent.click(indicator())
    expect(onSelectTile).toHaveBeenLastCalledWith("t1")
  })

  it("prefers the current selection over the last jump", () => {
    const tiles = [makeTile(0, 0), makeTile(1, 0), makeTile(2, 0)]
    const onSelectTile = jest.fn()
    const { rerender } = render(
      <BoardHealthIndicator
        tiles={tiles}
        selectedTileId={null}
        onSelectTile={onSelectTile}
      />
    )
    fireEvent.click(indicator())
    expect(onSelectTile).toHaveBeenLastCalledWith("t0")

    // The organiser clicked another Tile by hand.
    rerender(
      <BoardHealthIndicator
        tiles={tiles}
        selectedTileId="t1"
        onSelectTile={onSelectTile}
      />
    )
    fireEvent.click(indicator())
    expect(onSelectTile).toHaveBeenLastCalledWith("t2")
  })

  it("reselects the only tile without goals after the panel was closed", () => {
    const tiles = [makeTile(0, 1), makeTile(1, 0)]
    const onSelectTile = jest.fn()
    render(
      <BoardHealthIndicator
        tiles={tiles}
        selectedTileId={null}
        onSelectTile={onSelectTile}
      />
    )
    fireEvent.click(indicator())
    fireEvent.click(indicator())
    expect(onSelectTile).toHaveBeenCalledTimes(2)
    expect(onSelectTile).toHaveBeenLastCalledWith("t1")
  })

  it("leaves focus on the button so it can be pressed again", () => {
    setup([makeTile(0, 0), makeTile(1, 0)])
    const button = indicator()
    button.focus()
    fireEvent.click(button)
    expect(button).toHaveFocus()
  })

  it("updates the count when the tiles change", () => {
    const onSelectTile = jest.fn()
    const { rerender } = render(
      <BoardHealthIndicator
        tiles={[makeTile(0, 0), makeTile(1, 0)]}
        selectedTileId={null}
        onSelectTile={onSelectTile}
      />
    )
    expect(indicator()).toHaveTextContent("2 tiles have no goals")

    rerender(
      <BoardHealthIndicator
        tiles={[makeTile(0, 1), makeTile(1, 0)]}
        selectedTileId={null}
        onSelectTile={onSelectTile}
      />
    )
    expect(indicator()).toHaveTextContent("1 tile has no goals")

    rerender(
      <BoardHealthIndicator
        tiles={[makeTile(0, 1), makeTile(1, 1)]}
        selectedTileId={null}
        onSelectTile={onSelectTile}
      />
    )
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
