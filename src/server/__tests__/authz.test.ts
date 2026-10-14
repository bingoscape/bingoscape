/**
 * @jest-environment node
 */
import { db } from "@/server/db"
import { getServerAuthSession } from "@/server/auth"
import { getEventActor } from "@/server/authz/actor"
import {
  AuthzError,
  assertTeamLeaderOrManager,
  authzErrorMessage,
  requirePermissionForBingo,
  requirePermissionForEvent,
  requirePermissionForGoal,
  requirePermissionForGoalGroup,
  requirePermissionForGoalValue,
  requirePermissionForSubmission,
  requirePermissionForTeamTileSubmission,
  requirePermissionForTile,
  requireTeamMemberOrManager,
} from "@/server/authz"
import { actorLookup } from "@/server/__tests__/helpers/mock-actor"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
// The actor lookup is the seam: every guard resolves the caller through it.
jest.mock("@/server/authz/actor", () => ({
  getEventActor: jest.fn(),
  getEventRole: jest.fn(),
  isUuid: () => true,
}))
jest.mock("@/server/db", () => {
  const table = () => ({ findFirst: jest.fn() })
  return {
    db: {
      query: {
        bingos: table(),
        tiles: table(),
        goals: table(),
        goalGroups: table(),
        goalValues: table(),
        submissions: table(),
        teamTileSubmissions: table(),
        teams: table(),
        teamMembers: table(),
      },
    },
  }
})

const session = getServerAuthSession as jest.Mock
const actor = getEventActor as jest.Mock
/** The caller's standing in the Event, as the actor loader reports it. */
const role = {
  mockResolvedValue: (
    r: string | null,
    teams: { teamId: string; isLeader: boolean }[] = []
  ) => actor.mockResolvedValue(actorLookup(r, { teams })),
}
const q = db.query as unknown as Record<string, { findFirst: jest.Mock }>

const EVENT_ID = "event-from-db"
const goalWithEvent = {
  tileId: "tile-1",
  tile: { bingoId: "bingo-1", bingo: { eventId: EVENT_ID } },
}

beforeEach(() => {
  jest.resetAllMocks()
  session.mockResolvedValue({ user: { id: "user-1" } })
})

describe("requirePermissionForEvent (board:manage)", () => {
  it("rejects anonymous callers", async () => {
    session.mockResolvedValue(null)
    await expect(requirePermissionForEvent(EVENT_ID, "board:manage")).rejects.toThrow("Unauthorized")
    expect(actor).not.toHaveBeenCalled()
  })

  it.each([["participant"], [null]])("rejects role %s", async (r) => {
    role.mockResolvedValue(r)
    await expect(requirePermissionForEvent(EVENT_ID, "board:manage")).rejects.toBeInstanceOf(
      AuthzError
    )
  })

  it.each([["admin"], ["management"]])("allows %s", async (r) => {
    role.mockResolvedValue(r)
    await expect(requirePermissionForEvent(EVENT_ID, "board:manage")).resolves.toBe(EVENT_ID)
  })
})

describe("event is derived from the database, never from the client", () => {
  it("requirePermissionForBingo checks the role for the Board's own Event", async () => {
    q.bingos!.findFirst.mockResolvedValue({ eventId: EVENT_ID })
    role.mockResolvedValue("admin")
    await expect(requirePermissionForBingo("bingo-1", "board:manage")).resolves.toBe(EVENT_ID)
    expect(actor).toHaveBeenCalledWith(EVENT_ID)
  })

  it("requirePermissionForTile checks the Tile's Event", async () => {
    q.tiles!.findFirst.mockResolvedValue({
      bingoId: "bingo-1",
      bingo: { eventId: EVENT_ID },
    })
    role.mockResolvedValue("management")
    await expect(requirePermissionForTile("tile-1", "board:manage")).resolves.toBe(EVENT_ID)
    expect(actor).toHaveBeenCalledWith(EVENT_ID)
  })

  it("requirePermissionForGoal checks the Goal's Event", async () => {
    q.goals!.findFirst.mockResolvedValue(goalWithEvent)
    role.mockResolvedValue("admin")
    await expect(requirePermissionForGoal("goal-1", "board:manage")).resolves.toBe(EVENT_ID)
    expect(actor).toHaveBeenCalledWith(EVENT_ID)
  })

  it("requirePermissionForGoalGroup checks the group's Event", async () => {
    q.goalGroups!.findFirst.mockResolvedValue(goalWithEvent)
    role.mockResolvedValue("admin")
    await expect(requirePermissionForGoalGroup("group-1", "board:manage")).resolves.toBe(
      EVENT_ID
    )
  })

  it("requirePermissionForGoalValue resolves through the Goal", async () => {
    q.goalValues!.findFirst.mockResolvedValue({ goalId: "goal-1" })
    q.goals!.findFirst.mockResolvedValue(goalWithEvent)
    role.mockResolvedValue("admin")
    await expect(requirePermissionForGoalValue("value-1", "board:manage")).resolves.toBe(
      EVENT_ID
    )
  })

  it("requirePermissionForSubmission resolves through team tile submission and Tile", async () => {
    q.submissions!.findFirst.mockResolvedValue({
      teamTileSubmissionId: "tts-1",
    })
    q.teamTileSubmissions!.findFirst.mockResolvedValue({ tileId: "tile-1" })
    q.tiles!.findFirst.mockResolvedValue({
      bingoId: "bingo-1",
      bingo: { eventId: EVENT_ID },
    })
    role.mockResolvedValue("admin")
    await expect(requirePermissionForSubmission("sub-1", "submission:review")).resolves.toBe(
      EVENT_ID
    )
  })

  it("rejects participants for every resource type", async () => {
    role.mockResolvedValue("participant")
    q.bingos!.findFirst.mockResolvedValue({ eventId: EVENT_ID })
    q.tiles!.findFirst.mockResolvedValue({
      bingoId: "b",
      bingo: { eventId: EVENT_ID },
    })
    q.goals!.findFirst.mockResolvedValue(goalWithEvent)
    q.goalGroups!.findFirst.mockResolvedValue(goalWithEvent)
    q.goalValues!.findFirst.mockResolvedValue({ goalId: "goal-1" })
    q.teamTileSubmissions!.findFirst.mockResolvedValue({ tileId: "tile-1" })
    q.submissions!.findFirst.mockResolvedValue({ teamTileSubmissionId: "t" })

    const attempts = [
      requirePermissionForBingo("x", "board:manage"),
      requirePermissionForTile("x", "board:manage"),
      requirePermissionForGoal("x", "board:manage"),
      requirePermissionForGoalGroup("x", "board:manage"),
      requirePermissionForGoalValue("x", "board:manage"),
      requirePermissionForTeamTileSubmission("x", "submission:review"),
      requirePermissionForSubmission("x", "submission:review"),
    ]
    for (const attempt of attempts) {
      await expect(attempt).rejects.toThrow(/Forbidden/)
    }
  })

  it("rejects unknown resources", async () => {
    q.goals!.findFirst.mockResolvedValue(undefined)
    await expect(requirePermissionForGoal("nope", "board:manage")).rejects.toThrow(
      "Goal not found"
    )
  })
})

describe("requireTeamMemberOrManager", () => {
  beforeEach(() => {
    q.teams!.findFirst.mockResolvedValue({ eventId: EVENT_ID })
  })

  it("allows managers without membership", async () => {
    role.mockResolvedValue("management")
    await expect(requireTeamMemberOrManager("team-1")).resolves.toBe(EVENT_ID)
  })

  it("allows team members", async () => {
    role.mockResolvedValue("participant", [
      { teamId: "team-1", isLeader: false },
    ])
    await expect(requireTeamMemberOrManager("team-1")).resolves.toBe(EVENT_ID)
  })

  it("rejects other participants and members of other Teams", async () => {
    role.mockResolvedValue("participant")
    await expect(requireTeamMemberOrManager("team-1")).rejects.toThrow(
      /Forbidden/
    )
    role.mockResolvedValue("participant", [
      { teamId: "team-2", isLeader: true },
    ])
    await expect(requireTeamMemberOrManager("team-1")).rejects.toThrow(
      /Forbidden/
    )
  })
})

describe("assertTeamLeaderOrManager", () => {
  beforeEach(() => {
    q.teams!.findFirst.mockResolvedValue({ eventId: EVENT_ID })
  })

  it("rejects anonymous callers", async () => {
    session.mockResolvedValue(null)
    await expect(assertTeamLeaderOrManager("team-1")).rejects.toThrow(
      "Unauthorized"
    )
  })

  it("rejects unknown teams", async () => {
    q.teams!.findFirst.mockResolvedValue(undefined)
    await expect(assertTeamLeaderOrManager("team-1")).rejects.toThrow(
      "Team not found"
    )
  })

  it("allows managers without membership", async () => {
    role.mockResolvedValue("management")
    await expect(assertTeamLeaderOrManager("team-1")).resolves.toBe(EVENT_ID)
  })

  it("allows the team leader", async () => {
    role.mockResolvedValue("participant", [
      { teamId: "team-1", isLeader: true },
    ])
    await expect(assertTeamLeaderOrManager("team-1")).resolves.toBe(EVENT_ID)
  })

  it("rejects plain team members", async () => {
    role.mockResolvedValue("participant", [
      { teamId: "team-1", isLeader: false },
    ])
    await expect(assertTeamLeaderOrManager("team-1")).rejects.toThrow(
      /Forbidden/
    )
  })

  it("rejects users who are not in the team", async () => {
    role.mockResolvedValue("participant")
    await expect(assertTeamLeaderOrManager("team-1")).rejects.toThrow(
      /Forbidden/
    )
  })
})

describe("authzErrorMessage", () => {
  it("exposes authorization errors and hides everything else", () => {
    expect(authzErrorMessage(new AuthzError("Unauthorized"), "x")).toBe(
      "Unauthorized"
    )
    expect(authzErrorMessage(new Error("db exploded"), "Failed")).toBe("Failed")
  })
})
