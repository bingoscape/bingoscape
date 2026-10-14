import { act, fireEvent, render, screen, within } from "@testing-library/react"

import { setPickQueue } from "@/app/actions/draft"
import { DraftRoom } from "@/components/draft/draft-room"
import { FakeEventSource } from "@/hooks/__tests__/fake-event-source"
import { toast } from "@/hooks/use-toast"
import {
  created,
  pickEvent,
  snapshotOf,
  started,
} from "@/lib/draft/__tests__/draft-fixtures"
import type { DraftLogEvent, DraftSnapshot } from "@/lib/draft/types"

jest.mock("@/app/actions/draft", () => ({
  applyDraft: jest.fn(),
  cancelDraft: jest.fn(),
  forcePick: jest.fn(),
  makePick: jest.fn(),
  pauseDraft: jest.fn(),
  resumeDraft: jest.fn(),
  setPickQueue: jest.fn(),
  skipTurn: jest.fn(),
  startDraft: jest.fn(),
  undoPick: jest.fn(),
}))
jest.mock("@/hooks/use-toast", () => ({ toast: jest.fn() }))

const setPickQueueMock = setPickQueue as jest.Mock
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
  setPickQueueMock.mockReset()
  ;(toast as jest.Mock).mockClear()
})
afterEach(() => {
  FakeEventSource.uninstall()
})

const AT = "2026-01-01T00:00:00.000Z"
const timer = {
  deadline: "2099-01-01T00:00:30.000Z",
  serverNow: "2099-01-01T00:00:00.000Z",
  pausedRemainingMs: null,
}

const timedCreated = {
  ...created,
  payload: { ...created.payload, pickTimerSeconds: 30 },
} as DraftLogEvent
const timedStarted = {
  ...started,
  payload: { ...started.payload, ...timer },
} as DraftLogEvent

function renderRoom(
  events: DraftLogEvent[],
  viewer: { id: string; canManage?: boolean; canPick?: boolean },
  extra: Partial<DraftSnapshot> = {},
  initialQueue: string[] = []
) {
  return render(
    <DraftRoom
      eventId="event-1"
      snapshot={{ ...snapshotOf(events), ...extra }}
      viewerUserId={viewer.id}
      canManage={viewer.canManage ?? false}
      canPick={viewer.canPick ?? false}
      initialQueue={initialQueue}
    />
  )
}

describe("DraftRoom: the pick timer", () => {
  it("shows the countdown in the banner of a timed draft", () => {
    renderRoom([timedCreated, timedStarted], { id: "p0" })
    expect(screen.getByRole("timer")).toBeInTheDocument()
  })

  it("shows no countdown without a timer", () => {
    renderRoom([created, started], { id: "p0" })
    expect(screen.queryByRole("timer")).not.toBeInTheDocument()
  })

  it("shows the frozen time of a paused draft", () => {
    const paused = {
      seq: 9,
      type: "paused",
      actorUserId: "manager",
      at: AT,
      payload: {
        reason: "manual",
        deadline: null,
        serverNow: timer.serverNow,
        pausedRemainingMs: 17_000,
      },
    } as DraftLogEvent
    renderRoom([timedCreated, timedStarted, paused], { id: "p0" })
    expect(screen.getByRole("timer")).toHaveTextContent("0:17")
    expect(screen.getByText("The draft is paused")).toBeInTheDocument()
  })

  it("badges a pick the timer made", () => {
    const auto = {
      ...pickEvent(1),
      actorUserId: null,
      payload: {
        ...pickEvent(1).payload,
        auto: true,
        reason: "timer_auto",
        consecutiveTimeouts: 1,
        ...timer,
      },
    } as DraftLogEvent
    renderRoom([timedCreated, timedStarted, auto], { id: "p1" })
    expect(screen.getByText("Auto-picked")).toBeInTheDocument()
    expect(
      screen.getByText(/time ran out: Alice was picked/)
    ).toBeInTheDocument()
  })

  it("does not badge a pick a captain made", () => {
    renderRoom([timedCreated, timedStarted, pickEvent(1)], { id: "p1" })
    expect(screen.queryByText("Auto-picked")).not.toBeInTheDocument()
  })
})

describe("DraftRoom: organizer", () => {
  it("offers to skip the turn, with a confirmation", () => {
    renderRoom([created, started], { id: "manager", canManage: true })
    const controls = screen.getByRole("group", { name: "Organizer controls" })
    fireEvent.click(within(controls).getByRole("button", { name: /Skip turn/ }))
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Skip this turn?")
  })

  it("warns about a captain who keeps timing out, to the manager only", () => {
    const away = [1, 2].map(
      (n) =>
        ({
          seq: 10 + n,
          type: "skipped",
          actorUserId: null,
          at: AT,
          payload: {
            pickNo: n,
            slotId: "s0",
            reason: "timer_skip",
            consecutiveTimeouts: n,
          },
        }) as DraftLogEvent
    )
    const { unmount } = renderRoom([created, started, ...away], {
      id: "manager",
      canManage: true,
    })
    expect(
      screen.getByText(/let the timer run out 2 turns in a row/)
    ).toBeInTheDocument()
    expect(screen.getByText("Away")).toBeInTheDocument()
    unmount()

    renderRoom([created, started, ...away], { id: "p0" })
    expect(screen.queryByText(/turns in a row/)).not.toBeInTheDocument()
    // The team still shows the flag to everybody.
    expect(screen.getByText("Away")).toBeInTheDocument()
  })

  it("asks the manager to replace or release a drafted player who left", () => {
    const snapshot = snapshotOf([created, started, pickEvent(1)])
    const withLeft: DraftSnapshot = {
      ...snapshot,
      state: {
        ...snapshot.state,
        pool: snapshot.state.pool.map((e) =>
          e.poolEntryId === "e0" ? { ...e, leftEvent: true } : e
        ),
      },
    }
    render(
      <DraftRoom
        eventId="event-1"
        snapshot={withLeft}
        viewerUserId="manager"
        canManage
        canPick={false}
      />
    )
    expect(
      screen.getByText(/left the event after Team 1 drafted them/)
    ).toBeInTheDocument()
    expect(screen.getAllByText("Left event").length).toBeGreaterThan(0)
  })

  it("marks available players who left, and offers no pick for them", () => {
    const snapshot = snapshotOf([created, started])
    const left: DraftSnapshot = {
      ...snapshot,
      state: {
        ...snapshot.state,
        pool: snapshot.state.pool.map((e) =>
          e.poolEntryId === "e3" ? { ...e, leftEvent: true } : e
        ),
      },
    }
    render(
      <DraftRoom
        eventId="event-1"
        snapshot={left}
        viewerUserId="c0"
        canManage={false}
        canPick
      />
    )
    expect(screen.getByText("Left event")).toBeInTheDocument()
    // Four players in the pool, one of whom left: three Pick buttons.
    expect(screen.getAllByRole("button", { name: "Pick" })).toHaveLength(3)
  })

  it("lists late joiners and players nobody picked as unassigned", () => {
    const done: DraftLogEvent = {
      seq: 99,
      type: "completed",
      actorUserId: null,
      at: AT,
      payload: {},
    }
    renderRoom(
      [created, started, pickEvent(1), done],
      { id: "p0" },
      {
        lateJoiners: ["c1"],
      }
    )
    const list = screen.getByRole("region", { name: "Unassigned players" })
    expect(within(list).getByText("Joined late")).toBeInTheDocument()
    expect(within(list).getAllByText("Not picked").length).toBe(3)
  })
})

describe("DraftRoom: pre-start pool", () => {
  it("tags players who joined after the draft was set up", () => {
    const snapshot = snapshotOf([created])
    const preview: DraftSnapshot = {
      ...snapshot,
      state: {
        ...snapshot.state,
        pool: [
          {
            poolEntryId: "candidate:p0",
            userId: "p0",
            status: "available",
            rating: null,
            ratingSource: "preview",
          },
          {
            poolEntryId: "candidate:p1",
            userId: "p1",
            status: "available",
            rating: null,
            ratingSource: "preview",
            isNew: true,
          },
        ],
      },
    }
    render(
      <DraftRoom
        eventId="event-1"
        snapshot={preview}
        viewerUserId="p0"
        canManage={false}
        canPick={false}
      />
    )
    expect(screen.getAllByText("New")).toHaveLength(1)
  })
})

describe("DraftRoom: the pick queue", () => {
  it("lets a captain queue a player and saves the list", async () => {
    setPickQueueMock.mockResolvedValue({ success: true, count: 1 })
    renderRoom([timedCreated, timedStarted], { id: "c1", canPick: true })
    // Captain c1 is not on turn, but may queue.
    expect(screen.getByText("Your queue is empty.")).toBeInTheDocument()
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add to my queue" })[0]!
    )
    await act(async () => {})
    expect(setPickQueueMock).toHaveBeenCalledWith({
      draftId: "draft-1",
      poolEntryIds: [expect.stringMatching(/^e\d$/)],
    })
    expect(screen.queryByText("Your queue is empty.")).not.toBeInTheDocument()
  })

  it("puts the queue back when the server refuses it", async () => {
    setPickQueueMock.mockResolvedValue({ success: false, error: "nope" })
    renderRoom([timedCreated, timedStarted], { id: "c1", canPick: true })
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add to my queue" })[0]!
    )
    await act(async () => {})
    expect(screen.getByText("Your queue is empty.")).toBeInTheDocument()
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "nope", variant: "destructive" })
    )
  })

  it("starts from the saved queue, in order, and reorders it", async () => {
    setPickQueueMock.mockResolvedValue({ success: true, count: 2 })
    renderRoom([timedCreated, timedStarted], { id: "c1", canPick: true }, {}, [
      "e2",
      "e0",
    ])
    const queue = screen.getByRole("region", { name: "My pick queue" })
    const names = () =>
      within(queue)
        .getAllByRole("listitem")
        .map((li) => li.textContent)
    expect(names()[0]).toContain("Carol")
    expect(names()[1]).toContain("Alice")

    fireEvent.click(
      within(queue).getAllByRole("button", { name: "Move down in queue" })[0]!
    )
    await act(async () => {})
    expect(setPickQueueMock).toHaveBeenCalledWith({
      draftId: "draft-1",
      poolEntryIds: ["e0", "e2"],
    })
    expect(names()[0]).toContain("Alice")
  })

  it("is for captains only", () => {
    renderRoom([timedCreated, timedStarted], { id: "p0" })
    expect(
      screen.queryByRole("region", { name: "My pick queue" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Add to my queue" })
    ).not.toBeInTheDocument()
  })
})
