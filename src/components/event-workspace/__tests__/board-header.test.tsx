import { fireEvent, render, screen, within } from "@testing-library/react"
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

describe("BoardHeader: battleship", () => {
  const battleshipBingo = {
    ...bingo,
    bingoType: "battleship",
  } as unknown as Bingo
  const teams = [
    { id: "t1", name: "Team 1" },
    { id: "t2", name: "Team 2" },
  ] as unknown as React.ComponentProps<typeof BoardHeader>["teams"]
  const info = (
    overrides: Partial<{
      started: boolean
      ledTeamId: string | null
      ownShips: { length: number; tileIds: string[] }[]
    }> = {}
  ) => ({
    bingoId: "b1",
    rules: [{ length: 2, count: 1 }],
    started: false,
    ledTeamId: null,
    marks: { hitTileIds: [], missTileIds: [], sunkTileIds: [] },
    ownShips: [],
    ...overrides,
  })
  const placeShips = () => screen.queryByRole("link", { name: "Place ships" })
  const note = () => screen.queryByText(/team leaders place their ships/)

  function renderBattleship(
    props: Partial<React.ComponentProps<typeof BoardHeader>>
  ) {
    return renderHeader({
      bingos: [battleshipBingo],
      activeBingo: battleshipBingo,
      teams,
      ...props,
    })
  }

  it("links a team leader to the placement page of their own team", () => {
    renderBattleship({
      isManagement: false,
      effectiveTeamId: "t2",
      battleship: info({ ledTeamId: "t1" }),
    })
    expect(placeShips()).toHaveAttribute(
      "href",
      "/events/e1/bingos/b1/ships?teamId=t1"
    )
    expect(note()).not.toBeInTheDocument()
  })

  it("links a manager to the team they are looking at", () => {
    renderBattleship({
      isManagement: true,
      effectiveTeamId: "t2",
      battleship: info(),
    })
    expect(placeShips()).toHaveAttribute(
      "href",
      "/events/e1/bingos/b1/ships?teamId=t2"
    )
  })

  it("explains instead of linking for everybody else", () => {
    renderBattleship({
      isManagement: false,
      battleship: info({ ledTeamId: null }),
    })
    expect(placeShips()).not.toBeInTheDocument()
    expect(note()).toBeInTheDocument()
  })

  it("shows neither the link nor the note once the event has started", () => {
    renderBattleship({
      isManagement: true,
      effectiveTeamId: "t1",
      battleship: info({ started: true, ledTeamId: "t1" }),
    })
    expect(placeShips()).not.toBeInTheDocument()
    expect(note()).not.toBeInTheDocument()
  })

  it("does not show the link on other boards or in the read-only view", () => {
    renderHeader({
      isManagement: true,
      teams,
      effectiveTeamId: "t1",
      battleship: info(),
    })
    expect(placeShips()).not.toBeInTheDocument()

    renderBattleship({
      isManagement: false,
      readOnly: true,
      battleship: info({ ledTeamId: "t1" }),
    })
    expect(placeShips()).not.toBeInTheDocument()
  })

  it("has a 44px target on coarse pointers", () => {
    renderBattleship({
      isManagement: true,
      effectiveTeamId: "t1",
      battleship: info(),
    })
    expect(placeShips()).toHaveClass("pointer-coarse:min-h-11")
  })

  describe("legend", () => {
    const legend = () =>
      screen.queryByRole("list", { name: "Battleship legend" })

    it("lists Hit, Miss and Sunk with the marker glyphs once the event has started", () => {
      renderBattleship({
        isManagement: false,
        effectiveTeamId: "t1",
        battleship: info({ started: true, ledTeamId: "t1" }),
      })
      const items = within(legend()!).getAllByRole("listitem")
      expect(items.map((item) => item.textContent)).toEqual([
        "Hit",
        "Miss",
        "Sunk",
      ])
      expect(
        items.map((item) =>
          item.querySelector("[data-mark]")?.getAttribute("data-mark")
        )
      ).toEqual(["hit", "miss", "sunk"])
      expect(
        screen.getByText(/You learn whether you hit when a tile is approved/)
      ).toBeInTheDocument()
    })

    it("keeps the blind-board note and no legend before the start", () => {
      renderBattleship({
        isManagement: false,
        battleship: info({ started: false, ledTeamId: null }),
      })
      expect(note()).toBeInTheDocument()
      expect(legend()).not.toBeInTheDocument()
    })

    it("has no legend on other boards or in the read-only view", () => {
      renderHeader({
        teams,
        battleship: info({ started: true }),
      })
      expect(legend()).not.toBeInTheDocument()

      renderBattleship({
        readOnly: true,
        battleship: info({ started: true }),
      })
      expect(legend()).not.toBeInTheDocument()
    })
  })
  describe("My ships toggle", () => {
    const fleet = [
      { length: 3, tileIds: ["a", "b", "c"] },
      { length: 2, tileIds: ["d", "e"] },
      { length: 2, tileIds: ["f", "g"] },
    ]
    const own = { id: "t1", name: "Team 1" }
    const toggle = () => screen.queryByRole("button", { name: "My ships" })
    const legendEntry = () => screen.queryByText("Your ship")

    function renderOwn(
      props: Partial<React.ComponentProps<typeof BoardHeader>> = {},
      ownShips = fleet
    ) {
      const onShowOwnShipsChange = jest.fn()
      renderBattleship({
        isManagement: false,
        ownTeam: own,
        effectiveTeamId: "t1",
        battleship: info({ started: true, ownShips }),
        showOwnShips: false,
        onShowOwnShipsChange,
        ...props,
      })
      return { onShowOwnShipsChange }
    }

    it("is an off, labelled toggle button for a team member viewing their team", () => {
      renderOwn()
      expect(toggle()).toHaveAttribute("aria-pressed", "false")
      expect(toggle()).toBeEnabled()
      expect(toggle()).toHaveClass("pointer-coarse:min-h-11")
      expect(toggle()!.querySelector("svg.lucide-ship")).toBeInTheDocument()
      expect(legendEntry()).not.toBeInTheDocument()
    })

    it("reports the new state when pressed", () => {
      const { onShowOwnShipsChange } = renderOwn()
      fireEvent.click(toggle()!)
      expect(onShowOwnShipsChange).toHaveBeenCalledWith(true)
    })

    it("adds a legend entry with the fleet summary while on", () => {
      renderOwn({ showOwnShips: true })
      expect(toggle()).toHaveAttribute("aria-pressed", "true")
      const legend = screen.getByRole("list", { name: "Battleship legend" })
      const entry = within(legend).getByText("Your ship").closest("li")!
      expect(entry).toHaveTextContent("Your fleet: 3 ships, 7 tiles")
      expect(entry.querySelector("[data-own-ship-glyph]")).toBeInTheDocument()
      expect(within(legend).getAllByRole("listitem")).toHaveLength(4)
    })

    it("uses singular wording for a one-ship fleet", () => {
      renderOwn({ showOwnShips: true }, [{ length: 1, tileIds: ["a"] }])
      expect(screen.getByText("Your fleet: 1 ship, 1 tile")).toBeInTheDocument()
    })

    it("is disabled and explained when the team has no ships placed", () => {
      renderOwn({ showOwnShips: true }, [])
      expect(toggle()).toBeDisabled()
      expect(toggle()).toHaveAttribute("aria-pressed", "false")
      expect(toggle()).toHaveAccessibleDescription(
        "Your team has no ships placed"
      )
      expect(legendEntry()).not.toBeInTheDocument()
    })

    it("is hidden before the event starts", () => {
      renderOwn({ battleship: info({ started: false, ownShips: fleet }) })
      expect(toggle()).not.toBeInTheDocument()
    })

    it("is hidden while a manager looks at another team", () => {
      renderOwn({ isManagement: true, effectiveTeamId: "t2" })
      expect(toggle()).not.toBeInTheDocument()
      expect(legendEntry()).not.toBeInTheDocument()
    })

    it("is hidden for people on no team", () => {
      renderOwn({ isManagement: true, ownTeam: null, effectiveTeamId: "t2" })
      expect(toggle()).not.toBeInTheDocument()
    })

    it("is hidden on other boards and in the read-only view", () => {
      renderHeader({
        teams,
        ownTeam: own,
        effectiveTeamId: "t1",
        battleship: info({ started: true, ownShips: fleet }),
        onShowOwnShipsChange: jest.fn(),
      })
      expect(toggle()).not.toBeInTheDocument()

      renderOwn({ readOnly: true })
      expect(toggle()).not.toBeInTheDocument()
    })
  })

  describe("View fleets link", () => {
    const viewFleets = () => screen.queryByRole("link", { name: "View fleets" })

    it("links managers to the read-only fleet page of the team on screen after the start", () => {
      renderBattleship({
        isManagement: true,
        effectiveTeamId: "t2",
        battleship: info({ started: true }),
      })
      expect(viewFleets()).toHaveAttribute(
        "href",
        "/events/e1/bingos/b1/ships?teamId=t2"
      )
      expect(viewFleets()).toHaveClass("pointer-coarse:min-h-11")
      expect(placeShips()).not.toBeInTheDocument()
    })

    it("works for a manager on no team and on screen with no team selected", () => {
      renderBattleship({
        isManagement: true,
        ownTeam: null,
        effectiveTeamId: undefined,
        battleship: info({ started: true }),
      })
      expect(viewFleets()).toHaveAttribute(
        "href",
        "/events/e1/bingos/b1/ships"
      )
    })

    it("leaves out a team that is not part of the event", () => {
      renderBattleship({
        isManagement: true,
        effectiveTeamId: "gone",
        battleship: info({ started: true }),
      })
      expect(viewFleets()).toHaveAttribute(
        "href",
        "/events/e1/bingos/b1/ships"
      )
    })

    it("is hidden for people who are not managers", () => {
      renderBattleship({
        isManagement: false,
        effectiveTeamId: "t1",
        battleship: info({ started: true, ledTeamId: "t1" }),
      })
      expect(viewFleets()).not.toBeInTheDocument()
    })

    it("is hidden before the event starts", () => {
      renderBattleship({
        isManagement: true,
        effectiveTeamId: "t1",
        battleship: info({ started: false }),
      })
      expect(viewFleets()).not.toBeInTheDocument()
    })

    it("is hidden in the read-only view and on other boards", () => {
      renderBattleship({
        isManagement: true,
        readOnly: true,
        battleship: info({ started: true }),
      })
      expect(viewFleets()).not.toBeInTheDocument()

      renderHeader({
        isManagement: true,
        teams,
        battleship: info({ started: true }),
      })
      expect(viewFleets()).not.toBeInTheDocument()
    })
  })
})
