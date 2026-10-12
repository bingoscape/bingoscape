import { fireEvent, render, screen, within } from "@testing-library/react"
import { BingoGridLayout } from "@/components/bingo-grid-layout"
import { toMarkSets, type BattleshipMarkSets } from "@/lib/battleship-marks"
import type { Tile } from "@/types/model"

const TEAM = "team-a"

function tile(
  index: number,
  overrides: Partial<Tile> & { completed?: boolean } = {}
): Tile {
  const { completed = false, ...rest } = overrides
  return {
    id: `tile-${index}`,
    bingoId: "b1",
    index,
    title: `Objective ${index + 1}`,
    description: "",
    headerImage: null,
    weight: 10,
    isHidden: false,
    isBlind: false,
    tier: 0,
    goals: [],
    goalGroups: [],
    teamTileSubmissions: completed
      ? [
          {
            id: `tts-${index}`,
            teamId: TEAM,
            status: "completed",
            submissions: [],
          },
        ]
      : [],
    ...rest,
  } as unknown as Tile
}

function marks(ids: {
  hit?: string[]
  miss?: string[]
  sunk?: string[]
}): BattleshipMarkSets {
  return toMarkSets({
    hitTileIds: ids.hit ?? [],
    missTileIds: ids.miss ?? [],
    sunkTileIds: ids.sunk ?? [],
  })
}

function renderGrid(
  tiles: Tile[],
  props: Partial<React.ComponentProps<typeof BingoGridLayout>> = {}
) {
  const onTileClick = jest.fn()
  const view = render(
    <BingoGridLayout
      tiles={tiles}
      columns={2}
      rows={Math.ceil(tiles.length / 2)}
      userRole="participant"
      currentTeamId={TEAM}
      onTileClick={onTileClick}
      onTogglePlaceholder={jest.fn()}
      isLocked
      highlightedTiles={[]}
      {...props}
    />
  )
  return { ...view, onTileClick }
}

const cell = (name: RegExp | string) => screen.getByRole("gridcell", { name })

describe("battleship markers on the Board", () => {
  const tiles = [
    tile(0, { completed: true }),
    tile(1, { completed: true }),
    tile(2, { completed: true }),
    tile(3),
  ]

  it("renders a marker with a distinct shape and text alternative per state", () => {
    renderGrid(tiles, {
      marks: marks({
        hit: ["tile-0", "tile-2"],
        miss: ["tile-1"],
        sunk: ["tile-2"],
      }),
    })

    const hit = within(cell(/Objective 1/)).getByRole("img", { name: "Hit" })
    const miss = within(cell(/Objective 2/)).getByRole("img", { name: "Miss" })
    const sunk = within(cell(/Objective 3/)).getByRole("img", { name: "Sunk" })

    expect(hit).toHaveAttribute("data-mark", "hit")
    expect(miss).toHaveAttribute("data-mark", "miss")
    expect(sunk).toHaveAttribute("data-mark", "sunk")

    // Shapes differ: X for a hit, hollow dot for a miss, ship for sunk.
    expect(hit.querySelector("svg.lucide-x")).toBeInTheDocument()
    expect(miss.querySelector("svg")).not.toBeInTheDocument()
    expect(miss.querySelector(".rounded-full.border-2")).toBeInTheDocument()
    expect(sunk.querySelector("svg.lucide-ship")).toBeInTheDocument()

    // Bottom-left, away from the XP number (top-left) and the check (bottom-right).
    expect(hit).toHaveClass("absolute", "bottom-[4%]", "left-[4%]", "osrs-mark")
    expect(sunk).toHaveClass("ring-osrs-yellow", "bg-destructive")
    expect(miss).toHaveClass("bg-secondary", "text-muted-foreground")
    expect(hit).toHaveClass("bg-danger")
  })

  it("lets a sunk ship win over its hit Tiles and keeps the completed check", () => {
    renderGrid(tiles, { marks: marks({ hit: ["tile-2"], sunk: ["tile-2"] }) })

    const sunkCell = cell(/Objective 3/)
    expect(sunkCell.querySelectorAll("[data-mark]")).toHaveLength(1)
    expect(
      within(sunkCell).getByRole("img", { name: "Sunk" })
    ).toBeInTheDocument()
    expect(sunkCell.querySelector('[title="Completed"]')).toBeInTheDocument()
  })

  it("rings hit and sunk Tiles and dims missed ones with saturate-50", () => {
    renderGrid(tiles, {
      marks: marks({ hit: ["tile-0"], miss: ["tile-1"], sunk: ["tile-2"] }),
    })
    expect(
      cell(/Objective 1/).querySelector('[data-result-ring="hit"]')
    ).toBeInTheDocument()
    expect(
      cell(/Objective 3/).querySelector('[data-result-ring="sunk"]')
    ).toBeInTheDocument()
    expect(cell(/Objective 2/)).toHaveClass("saturate-50")
    expect(
      cell(/Objective 2/).querySelector("[data-result-ring]")
    ).not.toBeInTheDocument()
    expect(cell(/Objective 4/)).not.toHaveClass("saturate-50")
    expect(
      cell(/Objective 4/).querySelector("[data-result-ring]")
    ).not.toBeInTheDocument()
  })

  it("keeps the selection ring on a selected hit Tile", () => {
    renderGrid(tiles, {
      marks: marks({ hit: ["tile-0"] }),
      selectedTileId: "tile-0",
    })
    expect(cell(/Objective 1/)).toHaveClass("ring-osrs-yellow")
    expect(
      cell(/Objective 1/).querySelector("[data-result-ring]")
    ).not.toBeInTheDocument()
    expect(
      within(cell(/Objective 1/)).getByRole("img", { name: "Hit" })
    ).toBeInTheDocument()
  })

  it("extends the accessible name with the result", () => {
    renderGrid(tiles, {
      marks: marks({ hit: ["tile-0"], miss: ["tile-1"], sunk: ["tile-2"] }),
    })
    expect(
      screen.getByRole("gridcell", {
        name: "Row 1, column 1: Objective 1, 10 XP, completed, hit",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("gridcell", {
        name: "Row 1, column 2: Objective 2, 10 XP, completed, miss",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("gridcell", {
        name: "Row 2, column 1: Objective 3, 10 XP, completed, sunk",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("gridcell", {
        name: "Row 2, column 2: Objective 4, 10 XP, not started",
      })
    ).toBeInTheDocument()
  })

  it("shows no markers and keeps the plain names on a board without marks", () => {
    const { container } = renderGrid(tiles)
    expect(container.querySelector("[data-mark]")).not.toBeInTheDocument()
    expect(
      screen.getByRole("gridcell", {
        name: "Row 1, column 1: Objective 1, 10 XP, completed",
      })
    ).toBeInTheDocument()
  })

  it("shows no markers for empty mark sets (viewer on no team)", () => {
    const { container } = renderGrid(tiles, { marks: marks({}) })
    expect(container.querySelector("[data-mark]")).not.toBeInTheDocument()
  })
})

describe("blind Tiles on the Board", () => {
  const blind = (index: number) =>
    tile(index, {
      title: `Tile ${index + 1}`,
      weight: 0,
      isBlind: true,
    })

  it("renders a neutral slot with its number and an explanatory name", () => {
    const { container } = renderGrid([blind(0), blind(1), blind(2), blind(3)])
    const seven = screen.getByRole("gridcell", {
      name: "Row 1, column 1: Tile 1, objective hidden until the event starts",
    })
    expect(seven).toHaveTextContent("Tile 1")
    expect(seven).toHaveClass("osrs-slot")
    expect(seven).toHaveAttribute("aria-disabled", "true")
    expect(seven.querySelector("img")).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/XP|completed|pending/)
  })

  it("never carries markers, even if the sets mention it", () => {
    const { container } = renderGrid([blind(0), blind(1)], {
      marks: marks({ hit: ["tile-0"], miss: ["tile-1"], sunk: ["tile-0"] }),
    })
    expect(container.querySelector("[data-mark]")).not.toBeInTheDocument()
    expect(
      container.querySelector("[data-result-ring]")
    ).not.toBeInTheDocument()
  })

  it("cannot be opened by click, Enter or Space", () => {
    const { onTileClick } = renderGrid([blind(0), blind(1)])
    const first = cell(/Tile 1,/)
    fireEvent.click(first)
    fireEvent.keyDown(first, { key: "Enter" })
    fireEvent.keyDown(first, { key: " " })
    expect(onTileClick).not.toHaveBeenCalled()
  })

  it("stays in the roving focus order and does not trap focus", () => {
    renderGrid([blind(0), blind(1), blind(2), blind(3)])
    const cells = screen.getAllByRole("gridcell")
    expect(cells.map((c) => c.getAttribute("tabindex"))).toEqual([
      "0",
      "-1",
      "-1",
      "-1",
    ])

    cells[0]?.focus()
    fireEvent.keyDown(cells[0]!, { key: "ArrowRight" })
    expect(cells[1]).toHaveFocus()
    fireEvent.keyDown(cells[1]!, { key: "ArrowDown" })
    expect(cells[3]).toHaveFocus()
    fireEvent.keyDown(cells[3]!, { key: "ArrowLeft" })
    expect(cells[2]).toHaveFocus()
    fireEvent.keyDown(cells[2]!, { key: "Home" })
    expect(cells[2]).toHaveFocus()
  })

  it("keeps a hidden Tile skipped while blind Tiles around it stay focusable", () => {
    renderGrid([
      blind(0),
      tile(1, { title: "Tile 2", isHidden: true, isBlind: true }),
      blind(2),
      blind(3),
    ])
    const cells = screen.getAllByRole("gridcell")
    expect(cells).toHaveLength(3)
    cells[0]?.focus()
    fireEvent.keyDown(cells[0]!, { key: "ArrowRight" })
    // The hidden cell in column 2 is skipped; the arrows continue at the next
    // focusable cell, which is a blind one.
    expect(cells[1]).toHaveFocus()
  })

  it("is not mixed up with a normal Tile next to it", () => {
    const { onTileClick } = renderGrid([blind(0), tile(1, { completed: true })])
    fireEvent.click(cell(/Objective 2/))
    expect(onTileClick).toHaveBeenCalledTimes(1)
  })
})
