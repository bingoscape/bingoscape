import { render, screen } from "@testing-library/react"
import { TilePanel } from "@/components/event-workspace/tile-panel"
import type { TileWorkspace } from "@/components/event-workspace/use-tile-workspace"
import type { BattleshipMark } from "@/lib/battleship-marks"
import type { Bingo, Team, Tile } from "@/types/model"

// The tabs are not what these tests are about.
jest.mock("@/components/tile-details-tab", () => ({
  TileDetailsTab: () => null,
}))
jest.mock("@/components/submissions-tab", () => ({
  SubmissionsTab: () => null,
}))
jest.mock("@/components/goals-tab", () => ({ GoalsTab: () => null }))
jest.mock("@/components/full-size-image-dialog", () => ({
  FullSizeImageDialog: () => null,
}))

beforeAll(() => {
  // jsdom has no ResizeObserver; the scrollable tab list uses one.
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const bingo = { id: "b1", locked: false, bingoType: "battleship" } as Bingo

function tile(completed: boolean): Tile {
  return {
    id: "tile-1",
    title: "Objective 1",
    weight: 10,
    isHidden: false,
    teamTileSubmissions: completed
      ? [{ teamId: "t1", status: "completed", submissions: [] }]
      : [],
  } as unknown as Tile
}

function renderPanel(
  completed: boolean,
  battleshipMark: BattleshipMark | null,
  currentTeamId: string | null = "t1"
) {
  return render(
    <TilePanel
      tile={tile(completed)}
      bingo={bingo}
      workspace={{ editedTile: {} } as unknown as TileWorkspace}
      userRole="participant"
      teams={[] as Team[]}
      currentTeamId={currentTeamId ?? undefined}
      eventId="e1"
      gameType="osrs"
      isProgressionBingo={false}
      battleshipMark={battleshipMark}
      subTab="details"
      onSubTabChange={jest.fn()}
      onSelectTile={jest.fn()}
    />
  )
}

describe("TilePanel battleship result", () => {
  it.each([
    ["hit", "Hit"],
    ["miss", "Miss"],
    ["sunk", "Ship sunk"],
  ] as const)("shows %s as %s with its glyph", (mark, text) => {
    const { container } = renderPanel(true, mark)
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(container.querySelector(`[data-mark="${mark}"]`)).toBeInTheDocument()
  })

  it("shows nothing for a Tile that is not completed", () => {
    const { container } = renderPanel(false, "hit")
    expect(container.querySelector("[data-mark]")).not.toBeInTheDocument()
  })

  it("shows nothing without a result or without a viewed Team", () => {
    const first = renderPanel(true, null)
    expect(first.container.querySelector("[data-mark]")).not.toBeInTheDocument()
    first.unmount()
    const second = renderPanel(true, "hit", null)
    expect(
      second.container.querySelector("[data-mark]")
    ).not.toBeInTheDocument()
  })
})
