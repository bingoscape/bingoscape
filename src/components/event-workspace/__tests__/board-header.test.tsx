import { fireEvent, render, screen } from "@testing-library/react"
import { BoardHeader } from "@/components/event-workspace/board-header"
import type { Bingo, Tile } from "@/types/model"

// The header's modals and menus are not what these tests are about.
jest.mock("@/components/bingo-import-export-modal", () => ({
  BingoImportExportModal: () => null,
}))
jest.mock("@/components/bingo-info-modal", () => ({
  BingoInfoModal: () => null,
}))
jest.mock("@/components/delete-bingo-button", () => ({
  DeleteBingoButton: () => null,
}))
jest.mock("@/components/edit-bingo-modal", () => ({
  EditBingoModal: () => null,
}))
jest.mock("@/components/quick-submission-button", () => ({
  QuickSubmissionButton: () => null,
}))
jest.mock("@/components/team-selector", () => ({ TeamSelector: () => null }))
jest.mock("@/components/tracker-settings-modal", () => ({
  TrackerSettingsModal: () => null,
}))
jest.mock("@/components/event-workspace/shortcuts-help", () => ({
  ShortcutsHelp: () => null,
}))

const bingo = {
  id: "b1",
  title: "Summer bingo",
  locked: false,
  visible: true,
  womCompetitionId: null,
  womVerificationCode: null,
} as unknown as Bingo

const tile = (index: number, goalCount: number): Tile =>
  ({
    id: `t${index}`,
    index,
    title: `Tile ${index + 1}`,
    isHidden: false,
    goals: Array.from({ length: goalCount }, (_, i) => ({
      id: `g${index}-${i}`,
    })),
  }) as unknown as Tile

function renderHeader(
  props: Partial<React.ComponentProps<typeof BoardHeader>> = {}
) {
  const defaults: React.ComponentProps<typeof BoardHeader> = {
    eventId: "e1",
    bingos: [bingo],
    activeBingo: bingo,
    onSelectBoard: jest.fn(),
    stats: {
      total: 0,
      completed: 0,
      pending: 0,
      needsReview: 0,
      remaining: 0,
      xpEarned: 0,
      xpTotal: 0,
      percent: 0,
    },
    teams: [],
    isManagement: true,
    ownTeam: null,
    effectiveTeamId: undefined,
    onTeamChange: jest.fn(),
    pendingSubmissionCount: 0,
    editLayout: false,
    onToggleEditLayout: jest.fn(),
    onQuickSubmit: jest.fn(),
    isUpcoming: false,
    trackerOpen: false,
    onTrackerOpenChange: jest.fn(),
    filters: {
      context: { teamId: undefined, isManagement: true },
      active: null,
      counts: { attention: 0, incomplete: 0, hidden: 0 },
      onChange: jest.fn(),
    },
    ...props,
  }
  return render(<BoardHeader {...defaults} />)
}

const hint = () => screen.queryByRole("button", { name: /no goals/ })
const setUpGoals = () => screen.queryByRole("button", { name: "Set up goals" })

describe("BoardHeader: goal health", () => {
  it("shows the hint when goal health is provided and tiles lack goals", () => {
    renderHeader({
      goalHealth: {
        tiles: [tile(0, 0), tile(1, 2)],
        selectedTileId: null,
        onSelectTile: jest.fn(),
      },
    })
    expect(hint()).toHaveTextContent("1 tile has no goals")
  })

  it("shows nothing for people who are not given goal health (readers)", () => {
    renderHeader({ isManagement: false })
    expect(hint()).not.toBeInTheDocument()
  })

  it("hides the hint when every tile has goals", () => {
    renderHeader({
      goalHealth: {
        tiles: [tile(0, 1), tile(1, 2)],
        selectedTileId: null,
        onSelectTile: jest.fn(),
      },
    })
    expect(hint()).not.toBeInTheDocument()
  })

  it("selects the next tile without goals when pressed", () => {
    const onSelectTile = jest.fn()
    renderHeader({
      goalHealth: {
        tiles: [tile(0, 1), tile(1, 0), tile(2, 0)],
        selectedTileId: "t1",
        onSelectTile,
      },
    })
    fireEvent.click(hint()!)
    expect(onSelectTile).toHaveBeenCalledWith("t2")
  })
})

describe("BoardHeader: set up goals", () => {
  it("offers the goal setup view when a handler is given, and opens it", () => {
    const onSetUpGoals = jest.fn()
    renderHeader({ onSetUpGoals })
    fireEvent.click(setUpGoals()!)
    expect(onSetUpGoals).toHaveBeenCalledTimes(1)
  })

  it("does not offer it without a handler", () => {
    renderHeader()
    expect(setUpGoals()).not.toBeInTheDocument()
  })

  it("has a 44px target on coarse pointers", () => {
    renderHeader({ onSetUpGoals: jest.fn() })
    expect(setUpGoals()).toHaveClass("pointer-coarse:min-h-11")
  })
})
