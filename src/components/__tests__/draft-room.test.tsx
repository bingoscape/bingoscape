import { fireEvent, render, screen, within } from "@testing-library/react"

import { DraftRoom } from "@/components/draft/draft-room"
import { replayDraft } from "@/lib/draft/reducer"
import type { DraftLogEvent, DraftPlayerInfo } from "@/lib/draft/types"
import type { DraftSnapshot } from "@/server/draft/queries"

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
jest.mock("@/components/draft/use-draft-polling", () => ({
  useDraftPolling: jest.fn(),
}))

const AT = "2026-01-01T00:00:00.000Z"

const created: DraftLogEvent = {
  seq: 1,
  type: "created",
  actorUserId: "manager",
  at: AT,
  payload: {
    orderType: "snake",
    rounds: 2,
    pickTimerSeconds: null,
    onTimeout: "auto_pick",
    autoPickRule: "best_rated",
    slots: [0, 1].map((i) => ({
      slotId: `s${i}`,
      position: i,
      captainUserId: `c${i}`,
      teamName: `Team ${i + 1}`,
      maxTeamSize: 3,
    })),
  },
}
const started: DraftLogEvent = {
  seq: 2,
  type: "started",
  actorUserId: "manager",
  at: AT,
  payload: {
    seed: 1,
    permutation: [0, 1],
    slots: [0, 1].map((i) => ({ slotId: `s${i}`, teamId: `t${i}` })),
    pool: [0, 1, 2, 3].map((i) => ({
      poolEntryId: `e${i}`,
      userId: `p${i}`,
      rating: i === 3 ? null : 0.9 - i * 0.2,
      ratingSource: "team_balancing_v1",
    })),
  },
}

const info = (userId: string, name: string): DraftPlayerInfo => ({
  userId,
  name,
  runescapeName: null,
  image: null,
  skillLevel: null,
})

function snapshot(events: DraftLogEvent[]): DraftSnapshot {
  return {
    draftId: "draft-1",
    eventId: "event-1",
    version: 1,
    state: replayDraft(events),
    players: [
      info("c0", "Captain One"),
      info("c1", "Captain Two"),
      info("p0", "Alice"),
      info("p1", "Bob"),
      info("p2", "Carol"),
      info("p3", "Dave"),
      info("manager", "Manager"),
    ],
  }
}

function renderRoom(
  events: DraftLogEvent[],
  viewer: { id: string; canManage?: boolean; canPick?: boolean }
) {
  return render(
    <DraftRoom
      eventId="event-1"
      snapshot={snapshot(events)}
      viewerUserId={viewer.id}
      canManage={viewer.canManage ?? false}
      canPick={viewer.canPick ?? false}
    />
  )
}

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

  it("shows a captain who is not on turn who is, without pick buttons", () => {
    renderRoom([created, started], { id: "c1", canPick: true })
    expect(screen.getByText("On the clock: Team 1")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Pick" })
    ).not.toBeInTheDocument()
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
    renderRoom(
      [
        created,
        started,
        {
          seq: 3,
          type: "pick",
          actorUserId: "c0",
          at: AT,
          payload: {
            pickNo: 1,
            round: 1,
            slotId: "s0",
            poolEntryId: "e0",
            userId: "p0",
            auto: false,
            forced: false,
            reason: null,
          },
        },
      ],
      { id: "p1" }
    )
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
