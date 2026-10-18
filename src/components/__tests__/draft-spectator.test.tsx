import { render, screen, within } from "@testing-library/react"

import { BalancePanel } from "@/components/draft/balance-panel"
import { DraftRoom } from "@/components/draft/draft-room"
import { DraftAnalyticsPanel } from "@/components/draft/recap/draft-analytics-panel"
import { FinalRosters } from "@/components/draft/recap/final-rosters"
import { PickHistoryTable } from "@/components/draft/recap/pick-history-table"
import { FakeEventSource } from "@/hooks/__tests__/fake-event-source"
import { analyseDraft } from "@/lib/draft/analytics"
import { replayDraft } from "@/lib/draft/reducer"
import {
  PLAYERS,
  created,
  pickEvent,
  snapshotOf,
  started,
} from "@/lib/draft/__tests__/draft-fixtures"
import type { DraftLogEvent } from "@/lib/draft/types"

jest.mock("@/app/actions/draft", () => ({
  applyDraft: jest.fn(),
  cancelDraft: jest.fn(),
  forcePick: jest.fn(),
  makePick: jest.fn(),
  pauseDraft: jest.fn(),
  resumeDraft: jest.fn(),
  startDraft: jest.fn(),
  undoPick: jest.fn(),
}))
jest.mock("@/hooks/use-toast", () => ({ toast: jest.fn() }))

const fetchMock = jest.fn()

beforeEach(() => {
  FakeEventSource.install()
  global.fetch = fetchMock as unknown as typeof fetch
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({
    ok: true,
    status: 304,
    headers: { get: () => null },
  })
})
afterEach(() => {
  FakeEventSource.uninstall()
})

const completed: DraftLogEvent = {
  seq: 7,
  type: "completed",
  actorUserId: null,
  at: "2026-01-01T00:00:00.000Z",
  payload: {},
}
const allPicks = [1, 2, 3, 4].map((n) => pickEvent(n))
const playersById = new Map(PLAYERS.map((p) => [p.userId, p]))

function renderRoom(events: DraftLogEvent[], viewerId: string) {
  return render(
    <DraftRoom
      eventId="event-1"
      snapshot={snapshotOf(events)}
      viewerUserId={viewerId}
      canManage={false}
      canPick={false}
    />
  )
}

describe("the room for a member who only watches", () => {
  it("marks the viewer's own row in the pool with You, and nobody else's", () => {
    // p3 (Dave) is in the pool and the viewer.
    renderRoom([created, started], "p3")
    const pool = screen.getByRole("list", { name: "Available players" })
    const rows = within(pool).getAllByRole("listitem")
    expect(rows).toHaveLength(4)
    const marked = rows.filter((row) => within(row).queryByText("You"))
    expect(marked).toHaveLength(1)
    expect(marked[0]).toHaveTextContent("Dave")
    expect(marked[0]).toHaveAttribute("data-you", "true")
  })

  it("shows nobody as You to a member who is not in the pool", () => {
    renderRoom([created, started], "manager")
    expect(screen.queryByText("You")).not.toBeInTheDocument()
  })

  it("gives a watcher no pick buttons", () => {
    renderRoom([created, started], "p3")
    expect(
      screen.queryByRole("button", { name: /^Pick/ })
    ).not.toBeInTheDocument()
  })

  it("shows ratings to everyone, and Unrated for a player without data", () => {
    renderRoom([created, started], "p3")
    const pool = screen.getByRole("list", { name: "Available players" })
    // Alice .9 -> 90; Dave has no rating.
    expect(within(pool).getByText("90")).toBeInTheDocument()
    const dave = within(pool)
      .getAllByRole("listitem")
      .find((row) => within(row).queryByText("Dave"))!
    expect(within(dave).getByText("Unrated")).toBeInTheDocument()
  })

  it("marks the viewer on the roster of the team they were drafted onto", () => {
    renderRoom([created, started, pickEvent(1)], "p0")
    const team = screen.getByRole("region", { name: "Team Team 1" })
    expect(within(team).getByText("You")).toBeInTheDocument()
    expect(
      within(screen.getByRole("region", { name: "Team Team 2" })).queryByText(
        "You"
      )
    ).not.toBeInTheDocument()
  })

  it("has no balance panel before the first pick, and one that follows the picks", () => {
    const { unmount } = renderRoom([created, started], "p3")
    expect(
      screen.queryByRole("region", { name: "Team balance" })
    ).not.toBeInTheDocument()
    unmount()
    renderRoom([created, started, pickEvent(1), pickEvent(2)], "p3")
    const panel = screen.getByRole("region", { name: "Team balance" })
    // Header plus the two teams.
    expect(within(panel).getAllByRole("row")).toHaveLength(3)
  })

  it("offers the recap once the draft is complete, and not before", () => {
    const { unmount } = renderRoom([created, started, pickEvent(1)], "p3")
    expect(
      screen.queryByRole("link", { name: /View recap/ })
    ).not.toBeInTheDocument()
    unmount()
    renderRoom([created, started, ...allPicks, completed], "p3")
    expect(screen.getByRole("link", { name: /View recap/ })).toHaveAttribute(
      "href",
      "/events/event-1/draft/recap"
    )
  })
})

describe("BalancePanel", () => {
  it("lists each team's size, rating sum and mean, top players and time zones", () => {
    const state = replayDraft([created, started, ...allPicks])
    render(<BalancePanel state={state} players={playersById} />)
    const panel = screen.getByRole("region", { name: "Team balance" })
    const rows = within(panel).getAllByRole("row")
    const team1 = within(rows[1]!)
    expect(team1.getByRole("rowheader")).toHaveTextContent("Team 1")
    // Team 1: Alice (90) and Dave (unrated) plus the captain.
    expect(rows[1]).toHaveTextContent("90.0")
    expect(rows[1]).toHaveTextContent("(1 unrated)")
    // Team 2: Bob (70) and Carol (50).
    expect(rows[2]).toHaveTextContent("120.0")
    expect(rows[2]).toHaveTextContent("60.0")
    // No time zones in the fixtures.
    expect(rows[1]).toHaveTextContent("unknown")
    expect(panel).toHaveTextContent("Sum spread 30.0")
  })

  it("renders nothing before a pick", () => {
    const state = replayDraft([created, started])
    const { container } = render(
      <BalancePanel state={state} players={playersById} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe("the recap", () => {
  const events = [created, started, ...allPicks, completed]
  const state = replayDraft(events)

  it("shows the final rosters with the captain first and whether they were applied", () => {
    const { rerender } = render(
      <FinalRosters state={state} players={playersById} viewerUserId="p1" />
    )
    expect(screen.getByText("Not applied yet")).toBeInTheDocument()
    const team2 = screen.getByRole("region", { name: "Team Team 2" })
    const items = within(team2).getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("Captain Two")
    expect(items[1]).toHaveTextContent("Bob")
    expect(items[1]).toHaveTextContent("You")
    expect(items[2]).toHaveTextContent("Carol")
    rerender(
      <FinalRosters state={{ ...state, applied: true }} players={playersById} />
    )
    expect(screen.getByText("Applied")).toBeInTheDocument()
  })

  it("lists every pick in a table; the analysis columns are for managers", () => {
    const { rerender } = render(
      <PickHistoryTable state={state} players={playersById} />
    )
    const table = screen.getByRole("table")
    expect(within(table).getAllByRole("row")).toHaveLength(5)
    expect(
      within(table).queryByRole("columnheader", { name: "Rating rank" })
    ).not.toBeInTheDocument()
    expect(within(table).getAllByRole("row")[4]).toHaveTextContent("Unrated")

    const analytics = analyseDraft(state, events)
    rerender(
      <PickHistoryTable
        state={state}
        players={playersById}
        analysis={analytics.picks}
      />
    )
    expect(
      screen.getByRole("columnheader", { name: "Rating rank" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Time" })
    ).toBeInTheDocument()
  })

  it("says so when no pick was made", () => {
    render(
      <PickHistoryTable
        state={replayDraft([created, started])}
        players={playersById}
      />
    )
    expect(screen.getByText("No picks were made.")).toBeInTheDocument()
  })

  it("shows the manager's analytics: auto-picks, time, balance gap and the empty highlights", () => {
    const analytics = analyseDraft(state, events)
    render(
      <DraftAnalyticsPanel
        state={state}
        players={playersById}
        analytics={analytics}
        optimum={{
          actual: 0.25,
          optimum: 0.125,
          gap: 0.125,
          players: 6,
          teams: 2,
        }}
      />
    )
    const panel = screen.getByRole("region", { name: "Draft analytics" })
    expect(panel).toHaveTextContent("Auto-pick rate")
    expect(panel).toHaveTextContent("0%")
    expect(panel).toHaveTextContent("0.125")
    expect(panel).toHaveTextContent(
      "Drafted 0.250 against 0.125 found by simulated annealing over the same 6 players"
    )
    expect(within(panel).getByText("Biggest reaches")).toBeInTheDocument()
    expect(
      screen.getAllByText(/Nobody (went far ahead|lasted far beyond)/)
    ).toHaveLength(2)
  })

  it("explains a missing comparison", () => {
    const analytics = analyseDraft(state, events)
    render(
      <DraftAnalyticsPanel
        state={state}
        players={playersById}
        analytics={analytics}
        optimum={null}
      />
    )
    expect(screen.getByText("Not enough teams to compare")).toBeInTheDocument()
  })
})
