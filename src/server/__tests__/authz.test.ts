/**
 * @jest-environment node
 */
import { db } from "@/server/db"
import { getServerAuthSession } from "@/server/auth"
import { getUserRole } from "@/app/actions/events"
import {
  AuthzError,
  assertTeamLeaderOrManager,
  authzErrorMessage,
  canReadTile,
  requireBingoAdmin,
  requireBingoAdminForGoal,
  requireBingoAdminForGoalGroup,
  requireBingoAdminForGoalValue,
  requireBingoAdminForSubmission,
  requireBingoAdminForTeamTileSubmission,
  requireBingoAdminForTile,
  requireEventManager,
  requireTeamMemberOrManager,
} from "@/server/authz"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("@/app/actions/events", () => ({ getUserRole: jest.fn() }))
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
const role = getUserRole as jest.Mock
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

describe("requireEventManager", () => {
  it("rejects anonymous callers", async () => {
    session.mockResolvedValue(null)
    await expect(requireEventManager(EVENT_ID)).rejects.toThrow("Unauthorized")
    expect(role).not.toHaveBeenCalled()
  })

  it.each([["participant"], [null]])("rejects role %s", async (r) => {
    role.mockResolvedValue(r)
    await expect(requireEventManager(EVENT_ID)).rejects.toBeInstanceOf(
      AuthzError
    )
  })

  it.each([["admin"], ["management"]])("allows %s", async (r) => {
    role.mockResolvedValue(r)
    await expect(requireEventManager(EVENT_ID)).resolves.toBe(EVENT_ID)
  })
})

describe("event is derived from the database, never from the client", () => {
  it("requireBingoAdmin checks the role for the Board's own Event", async () => {
    q.bingos!.findFirst.mockResolvedValue({ eventId: EVENT_ID })
    role.mockResolvedValue("admin")
    await expect(requireBingoAdmin("bingo-1")).resolves.toBe(EVENT_ID)
    expect(role).toHaveBeenCalledWith(EVENT_ID)
  })

  it("requireBingoAdminForTile checks the Tile's Event", async () => {
    q.tiles!.findFirst.mockResolvedValue({
      bingoId: "bingo-1",
      bingo: { eventId: EVENT_ID },
    })
    role.mockResolvedValue("management")
    await expect(requireBingoAdminForTile("tile-1")).resolves.toBe(EVENT_ID)
    expect(role).toHaveBeenCalledWith(EVENT_ID)
  })

  it("requireBingoAdminForGoal checks the Goal's Event", async () => {
    q.goals!.findFirst.mockResolvedValue(goalWithEvent)
    role.mockResolvedValue("admin")
    await expect(requireBingoAdminForGoal("goal-1")).resolves.toBe(EVENT_ID)
    expect(role).toHaveBeenCalledWith(EVENT_ID)
  })

  it("requireBingoAdminForGoalGroup checks the group's Event", async () => {
    q.goalGroups!.findFirst.mockResolvedValue(goalWithEvent)
    role.mockResolvedValue("admin")
    await expect(requireBingoAdminForGoalGroup("group-1")).resolves.toBe(
      EVENT_ID
    )
  })

  it("requireBingoAdminForGoalValue resolves through the Goal", async () => {
    q.goalValues!.findFirst.mockResolvedValue({ goalId: "goal-1" })
    q.goals!.findFirst.mockResolvedValue(goalWithEvent)
    role.mockResolvedValue("admin")
    await expect(requireBingoAdminForGoalValue("value-1")).resolves.toBe(
      EVENT_ID
    )
  })

  it("requireBingoAdminForSubmission resolves through team tile submission and Tile", async () => {
    q.submissions!.findFirst.mockResolvedValue({
      teamTileSubmissionId: "tts-1",
    })
    q.teamTileSubmissions!.findFirst.mockResolvedValue({ tileId: "tile-1" })
    q.tiles!.findFirst.mockResolvedValue({
      bingoId: "bingo-1",
      bingo: { eventId: EVENT_ID },
    })
    role.mockResolvedValue("admin")
    await expect(requireBingoAdminForSubmission("sub-1")).resolves.toBe(
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
      requireBingoAdmin("x"),
      requireBingoAdminForTile("x"),
      requireBingoAdminForGoal("x"),
      requireBingoAdminForGoalGroup("x"),
      requireBingoAdminForGoalValue("x"),
      requireBingoAdminForTeamTileSubmission("x"),
      requireBingoAdminForSubmission("x"),
    ]
    for (const attempt of attempts) {
      await expect(attempt).rejects.toThrow(/Forbidden/)
    }
  })

  it("rejects unknown resources", async () => {
    q.goals!.findFirst.mockResolvedValue(undefined)
    await expect(requireBingoAdminForGoal("nope")).rejects.toThrow(
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
    expect(q.teamMembers!.findFirst).not.toHaveBeenCalled()
  })

  it("allows team members", async () => {
    role.mockResolvedValue("participant")
    q.teamMembers!.findFirst.mockResolvedValue({ id: "m" })
    await expect(requireTeamMemberOrManager("team-1")).resolves.toBe(EVENT_ID)
  })

  it("rejects other participants", async () => {
    role.mockResolvedValue("participant")
    q.teamMembers!.findFirst.mockResolvedValue(undefined)
    await expect(requireTeamMemberOrManager("team-1")).rejects.toThrow(
      /not a member/
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
    expect(q.teamMembers!.findFirst).not.toHaveBeenCalled()
  })

  it("allows the team leader", async () => {
    role.mockResolvedValue("participant")
    q.teamMembers!.findFirst.mockResolvedValue({ isLeader: true })
    await expect(assertTeamLeaderOrManager("team-1")).resolves.toBe(EVENT_ID)
  })

  it("rejects plain team members", async () => {
    role.mockResolvedValue("participant")
    q.teamMembers!.findFirst.mockResolvedValue({ isLeader: false })
    await expect(assertTeamLeaderOrManager("team-1")).rejects.toThrow(
      /team leader/
    )
  })

  it("rejects users who are not in the team", async () => {
    role.mockResolvedValue("participant")
    q.teamMembers!.findFirst.mockResolvedValue(undefined)
    await expect(assertTeamLeaderOrManager("team-1")).rejects.toThrow(
      /not a member/
    )
  })
})

describe("canReadTile", () => {
  const DAY = 24 * 60 * 60 * 1000
  const tileOn = (
    overrides: {
      isHidden?: boolean
      bingoType?: "standard" | "battleship"
      startDate?: Date
    } = {}
  ) => ({
    isHidden: overrides.isHidden ?? false,
    bingo: {
      eventId: EVENT_ID,
      bingoType: overrides.bingoType ?? "standard",
      event: { startDate: overrides.startDate ?? new Date(Date.now() - DAY) },
    },
  })

  it("allows everyone to read visible Tiles", async () => {
    q.tiles!.findFirst.mockResolvedValue(tileOn())
    await expect(canReadTile("tile-1")).resolves.toBe(true)
  })

  it("hides the Tiles of a battleship board from non-managers until the start", async () => {
    q.tiles!.findFirst.mockResolvedValue(
      tileOn({ bingoType: "battleship", startDate: new Date(Date.now() + DAY) })
    )
    role.mockResolvedValue("participant")
    await expect(canReadTile("tile-1")).resolves.toBe(false)
    role.mockResolvedValue(null)
    await expect(canReadTile("tile-1")).resolves.toBe(false)
    role.mockResolvedValue("management")
    await expect(canReadTile("tile-1")).resolves.toBe(true)
  })

  it("shows the Tiles of a started battleship board to everyone", async () => {
    q.tiles!.findFirst.mockResolvedValue(
      tileOn({ bingoType: "battleship", startDate: new Date(Date.now() - DAY) })
    )
    role.mockResolvedValue(null)
    await expect(canReadTile("tile-1")).resolves.toBe(true)
  })

  it("never blinds a standard board, whatever its start date", async () => {
    q.tiles!.findFirst.mockResolvedValue(
      tileOn({ startDate: new Date(Date.now() + DAY) })
    )
    role.mockResolvedValue(null)
    await expect(canReadTile("tile-1")).resolves.toBe(true)
  })

  it("hides hidden Tiles from non-managers", async () => {
    q.tiles!.findFirst.mockResolvedValue(tileOn({ isHidden: true }))
    role.mockResolvedValue("participant")
    await expect(canReadTile("tile-1")).resolves.toBe(false)
    role.mockResolvedValue(null)
    await expect(canReadTile("tile-1")).resolves.toBe(false)
  })

  it("shows hidden Tiles to managers", async () => {
    q.tiles!.findFirst.mockResolvedValue(tileOn({ isHidden: true }))
    role.mockResolvedValue("admin")
    await expect(canReadTile("tile-1")).resolves.toBe(true)
  })

  it("treats unknown Tiles as unreadable", async () => {
    q.tiles!.findFirst.mockResolvedValue(undefined)
    await expect(canReadTile("nope")).resolves.toBe(false)
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
