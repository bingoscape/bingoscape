import { act, fireEvent, render, screen, within } from "@testing-library/react"

import { makePick } from "@/app/actions/draft"
import { DraftRoom } from "@/components/draft/draft-room"
import { FakeEventSource } from "@/hooks/__tests__/fake-event-source"
import { toast } from "@/hooks/use-toast"
import {
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

const makePickMock = makePick as jest.Mock
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
  makePickMock.mockReset()
  ;(toast as jest.Mock).mockClear()
})

afterEach(() => {
  FakeEventSource.uninstall()
})

const AT = "2026-01-01T00:00:00.000Z"

function renderRoom(
  events: DraftLogEvent[],
  viewer: { id: string; canManage?: boolean; canPick?: boolean }
) {
  return render(
    <DraftRoom
      eventId="event-1"
      snapshot={snapshotOf(events)}
      viewerUserId={viewer.id}
      canManage={viewer.canManage ?? false}
      canPick={viewer.canPick ?? false}
    />
  )
}

const push = (event: DraftLogEvent) =>
  act(() => FakeEventSource.last.emit("draft", event))

describe("DraftRoom", () => {
  it("tells the on-turn captain it is their turn and lets them pick", () => {
    renderRoom([created, started], { id: "c0", canPick: true })
    expect(screen.getByText("You are on the clock")).toBeInTheDocument()
    // One "Pick" button per available player.
    expect(screen.getAllByRole("button", { name: "Pick" })).toHaveLength(4)
    // No organizer controls for a captain.
    expect(
      screen.queryByRole("group", { name: "Organizer controls" })
    ).not.toBeInTheDocument()
  })

  it("shows a captain who is not on turn who is, with the pick buttons disabled", () => {
    renderRoom([created, started], { id: "c1", canPick: true })
    expect(screen.getByText("On the clock: Team 1")).toBeInTheDocument()
    // The pick buttons are there, but disabled.
    for (const button of screen.getAllByRole("button", { name: "Pick" })) {
      expect(button).toHaveAttribute("aria-disabled", "true")
    }
  })

  it("gives a plain member the view only", () => {
    renderRoom([created, started], { id: "p0" })
    expect(screen.getByText("On the clock: Team 1")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Pick/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("group", { name: "Organizer controls" })
    ).not.toBeInTheDocument()
    // Ratings are visible to members; players without data are unrated.
    expect(screen.getByText("Unrated")).toBeInTheDocument()
  })

  it("gives a manager the organizer controls and a pick for the captain", () => {
    renderRoom([created, started], { id: "manager", canManage: true })
    const controls = screen.getByRole("group", { name: "Organizer controls" })
    expect(
      within(controls).getByRole("button", { name: /Pause/ })
    ).toBeInTheDocument()
    expect(
      within(controls).getByRole("button", { name: /Cancel draft/ })
    ).toBeInTheDocument()
    expect(
      within(controls).queryByRole("button", { name: /Undo last pick/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: "Pick for team" })
    ).toHaveLength(4)
  })

  it("asks for confirmation before picking", () => {
    renderRoom([created, started], { id: "c0", canPick: true })
    fireEvent.click(screen.getAllByRole("button", { name: "Pick" })[0]!)
    const dialog = screen.getByRole("dialog")
    expect(
      within(dialog).getByRole("heading", { name: "Confirm pick" })
    ).toBeInTheDocument()
    expect(within(dialog).getByText("Picking for Team 1.")).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: "Confirm pick" })
    ).toBeInTheDocument()
  })

  it("lets only a manager start a draft in setup", () => {
    const { unmount } = renderRoom([created], { id: "c0", canPick: true })
    expect(screen.getByText("The draft has not started")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Start draft/ })
    ).not.toBeInTheDocument()
    unmount()

    renderRoom([created], { id: "manager", canManage: true })
    expect(
      screen.getByRole("button", { name: /Start draft/ })
    ).toBeInTheDocument()
  })

  it("offers Apply teams to a manager once the draft is complete", () => {
    const done: DraftLogEvent[] = [
      created,
      started,
      {
        seq: 3,
        type: "completed",
        actorUserId: null,
        at: AT,
        payload: {},
      },
    ]
    renderRoom(done, { id: "manager", canManage: true })
    expect(screen.getByText("The draft is complete")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Apply teams/ })
    ).toBeInTheDocument()
  })

  it("lists the teams with their captains and the pick log", () => {
    renderRoom([created, started, pickEvent(1)], { id: "p1" })
    expect(
      screen.getByRole("region", { name: "Team Team 1" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Team Team 2" })
    ).toBeInTheDocument()
    const log = screen.getByRole("list", { name: "Pick log" })
    expect(within(log).getByText(/picked Alice/)).toBeInTheDocument()
    // Alice left the pool.
    const pool = screen.getByRole("region", { name: "Player pool" })
    expect(within(pool).queryByText("Alice")).not.toBeInTheDocument()
  })
})

describe("DraftRoom live updates", () => {
  it("shows the connection state", () => {
    renderRoom([created, started], { id: "p0" })
    expect(
      screen.getByRole("button", { name: /Connection: Connecting/ })
    ).toBeInTheDocument()
    act(() => FakeEventSource.last.open())
    const indicator = screen.getByRole("button", { name: /Connection: Live/ })
    expect(within(indicator).getByText("Live")).toBeInTheDocument()
    act(() => FakeEventSource.last.fail())
    expect(
      screen.getByRole("button", { name: /Connection: Reconnecting/ })
    ).toBeInTheDocument()
  })

  it("shows a pick a watcher did not make, without a reload", () => {
    renderRoom([created, started], { id: "p1" })
    act(() => FakeEventSource.last.open())
    const pool = screen.getByRole("region", { name: "Player pool" })
    expect(within(pool).getByText("Alice")).toBeInTheDocument()

    push(pickEvent(1))

    expect(within(pool).queryByText("Alice")).not.toBeInTheDocument()
    const log = screen.getByRole("list", { name: "Pick log" })
    expect(within(log).getByText(/picked Alice/)).toBeInTheDocument()
    expect(screen.getByText("On the clock: Team 2")).toBeInTheDocument()
    // The new roster row is highlighted for a moment.
    const roster = screen.getByRole("region", { name: "Team Team 1" })
    expect(roster.querySelector("[data-fresh='true']")).not.toBeNull()
  })

  it("announces the pick log politely and the own turn assertively", () => {
    renderRoom([created, started, pickEvent(1)], { id: "c1", canPick: true })
    expect(
      screen.getByRole("list", { name: "Pick log" }).closest("[aria-live]")
    ).toHaveAttribute("aria-live", "polite")
    expect(screen.getByRole("alert")).toHaveTextContent(
      "It is your turn to pick."
    )
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite")
  })

  it("cues the captain when the turn comes round", () => {
    renderRoom([created, started], { id: "c1", canPick: true })
    act(() => FakeEventSource.last.open())
    expect(screen.getByRole("alert")).toBeEmptyDOMElement()
    const original = document.title

    push(pickEvent(1))

    expect(screen.getByRole("alert")).toHaveTextContent(
      "It is your turn to pick."
    )
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Your pick!" })
    )
    expect(document.title).toBe(`Your pick! ${original}`.trim())

    // Team 2 also has pick 3 (snake); then it is Team 1 again.
    push(pickEvent(2))
    push(pickEvent(3))
    expect(document.title).toBe(original)
  })

  it("does not cue a captain who opens the page on their turn", () => {
    renderRoom([created, started], { id: "c0", canPick: true })
    expect(toast).not.toHaveBeenCalled()
  })

  it("shows Pick as disabled with the reason when it is not your turn", () => {
    renderRoom([created, started], { id: "c1", canPick: true })
    const pool = screen.getByRole("region", { name: "Player pool" })
    const buttons = within(pool).getAllByRole("button", { name: "Pick" })
    expect(buttons).toHaveLength(4)
    for (const button of buttons) {
      expect(button).toHaveAttribute("aria-disabled", "true")
      expect(button).toHaveAttribute("title", "Not your turn")
    }
    expect(within(pool).getByText(/Not your turn:/)).toBeInTheDocument()
    // Clicking one does nothing.
    fireEvent.click(buttons[0]!)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("leaves a plain member's rows alone", () => {
    renderRoom([created, started], { id: "p0" })
    const pool = screen.getByRole("region", { name: "Player pool" })
    expect(within(pool).queryByRole("button")).not.toBeInTheDocument()
    expect(within(pool).queryByText(/Not your turn/)).not.toBeInTheDocument()
  })

  it("picks from the keyboard: / searches, arrows move, Enter confirms", () => {
    renderRoom([created, started], { id: "c0", canPick: true })
    fireEvent.keyDown(document.body, { key: "/" })
    expect(
      screen.getByRole("textbox", { name: "Search players" })
    ).toHaveFocus()

    const rows = within(
      screen.getByRole("list", { name: "Available players" })
    ).getAllByRole("listitem")
    // Roving tabindex: one row is in the tab order.
    expect(rows.map((r) => r.tabIndex)).toEqual([0, -1, -1, -1])
    rows[0]!.focus()
    fireEvent.keyDown(rows[0]!, { key: "ArrowDown" })
    expect(rows[1]).toHaveFocus()
    expect(rows.map((r) => r.tabIndex)).toEqual([-1, 0, -1, -1])
    fireEvent.keyDown(rows[1]!, { key: "End" })
    expect(rows[3]).toHaveFocus()
    fireEvent.keyDown(rows[3]!, { key: "ArrowUp" })
    expect(rows[2]).toHaveFocus()

    fireEvent.keyDown(rows[2]!, { key: "Enter" })
    expect(
      within(screen.getByRole("dialog")).getByText("Carol")
    ).toBeInTheDocument()
    // Escape cancels.
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("does not steal / while typing in a field", () => {
    renderRoom([created, started], { id: "c0", canPick: true })
    const search = screen.getByRole("textbox", { name: "Search players" })
    const rows = within(
      screen.getByRole("list", { name: "Available players" })
    ).getAllByRole("listitem")
    rows[0]!.focus()
    fireEvent.keyDown(search, { key: "/" })
    expect(rows[0]).toHaveFocus()
  })
})

describe("DraftRoom optimistic pick", () => {
  const confirm = async () => {
    fireEvent.click(screen.getAllByRole("button", { name: "Pick" })[0]!)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm pick" }))
    })
  }

  it("moves the player into the roster as a pending row until the server confirms", async () => {
    let resolvePick!: (value: { success: boolean }) => void
    makePickMock.mockReturnValue(
      new Promise((resolve) => (resolvePick = resolve))
    )
    // The sync after the action finds the pick.
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        draft: { id: "draft-1", status: "in_progress", version: 2 },
        seq: 3,
        events: [pickEvent(1)],
      }),
    })
    renderRoom([created, started], { id: "c0", canPick: true })
    await confirm()

    const roster = screen.getByRole("region", { name: "Team Team 1" })
    expect(within(roster).getByText("Picking…")).toBeInTheDocument()
    expect(within(roster).getByText("Alice")).toBeInTheDocument()
    const pool = screen.getByRole("region", { name: "Player pool" })
    expect(within(pool).queryByText("Alice")).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await act(async () => resolvePick({ success: true }))

    expect(within(roster).queryByText("Picking…")).not.toBeInTheDocument()
    expect(within(roster).getByText("Alice")).toBeInTheDocument()
    expect(makePickMock).toHaveBeenCalledWith({
      draftId: "draft-1",
      poolEntryId: "e0",
    })
    expect(toast).not.toHaveBeenCalled()
  })

  it("rolls back with Taken by when somebody else got the player", async () => {
    makePickMock.mockResolvedValue({
      success: false,
      error: "That player is not available",
    })
    // Team 2 picked Alice first (the log shows it as the missed pick 1).
    const stolen = pickEvent(1)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        draft: { id: "draft-1", status: "in_progress", version: 2 },
        seq: 3,
        events: [
          stolen.type === "pick"
            ? {
                ...stolen,
                payload: { ...stolen.payload, slotId: "s1" },
              }
            : stolen,
        ],
      }),
    })
    renderRoom([created, started], { id: "c0", canPick: true })
    await confirm()

    expect(toast).toHaveBeenCalledWith({
      title: "Taken by Team 2",
      variant: "destructive",
    })
    const roster = screen.getByRole("region", { name: "Team Team 1" })
    expect(within(roster).queryByText("Picking…")).not.toBeInTheDocument()
  })

  it("puts the player back in the pool and shows the error when the server refuses", async () => {
    makePickMock.mockResolvedValue({
      success: false,
      error: "It is not your turn",
    })
    renderRoom([created, started], { id: "c0", canPick: true })
    await confirm()

    expect(toast).toHaveBeenCalledWith({
      title: "It is not your turn",
      variant: "destructive",
    })
    const pool = screen.getByRole("region", { name: "Player pool" })
    expect(within(pool).getByText("Alice")).toBeInTheDocument()
    const roster = screen.getByRole("region", { name: "Team Team 1" })
    expect(within(roster).queryByText("Picking…")).not.toBeInTheDocument()
  })

  it("shows the real state as soon as another event arrives, even before the action returns", async () => {
    makePickMock.mockReturnValue(new Promise(() => undefined))
    renderRoom([created, started], { id: "c0", canPick: true })
    act(() => FakeEventSource.last.open())
    await confirm()
    const roster = screen.getByRole("region", { name: "Team Team 1" })
    expect(within(roster).getByText("Picking…")).toBeInTheDocument()

    push(pickEvent(1)) // the server's own event arrives first

    expect(within(roster).queryByText("Picking…")).not.toBeInTheDocument()
    expect(within(roster).getByText("Alice")).toBeInTheDocument()
  })
})
