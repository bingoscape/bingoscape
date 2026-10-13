/**
 * @jest-environment node
 */
import type { EventActor } from "@/lib/authz/policy"
import {
  DEFAULT_READ_POLICY_MODE,
  READ_DECISIONS,
  boardReadable,
  codephraseVisible,
  eventReadLevel,
  levelAllows,
  parseReadPolicyMode,
  redactBoardSecrets,
  teamReadable,
  tileContentReadable,
  type EventReadFacts,
  type EventReadLevel,
  type ReadDecisions,
} from "@/lib/authz/read-policy"
import type { EventRole } from "@/lib/authz/roles"

function actor(
  role: EventRole | null,
  overrides: Partial<EventActor> = {}
): EventActor {
  return {
    userId: "user-1",
    eventId: "event-1",
    role,
    isOwner: false,
    teams: [],
    ...overrides,
  }
}

const facts = (
  a: EventActor | null,
  eventPublic = false,
  signedIn = a !== null
): EventReadFacts => ({ actor: a, signedIn, eventPublic })

describe("defaults pending maintainer confirmation", () => {
  it("preserve what the application did before the policy", () => {
    expect(READ_DECISIONS).toEqual({
      nonPublicEventForNonMembers: "link-holders",
      uploads: "public-url",
      codephrase: "players",
    })
    expect(DEFAULT_READ_POLICY_MODE).toBe("enforce")
  })
})

describe("parseReadPolicyMode", () => {
  it.each([
    ["enforce", "enforce"],
    ["relaxed", "relaxed"],
    ["  Relaxed\n", "relaxed"],
    ["ENFORCE", "enforce"],
    ["", "enforce"],
    ["off", "enforce"],
    [undefined, "enforce"],
    [null, "enforce"],
  ])("%j -> %s", (value, expected) => {
    expect(parseReadPolicyMode(value)).toBe(expected)
  })
})

describe("eventReadLevel", () => {
  it.each([
    ["admin", "manager"],
    ["management", "manager"],
    ["participant", "member"],
  ] as const)("a %s is a %s", (role, level) => {
    expect(eventReadLevel(facts(actor(role)))).toBe(level)
    expect(eventReadLevel(facts(actor(role), true))).toBe(level)
  })

  it("counts the owner as a manager even without a participant role", () => {
    expect(eventReadLevel(facts(actor("admin", { isOwner: true })))).toBe(
      "manager"
    )
  })

  it("counts a Team member without a role as a member", () => {
    const a = actor(null, { teams: [{ teamId: "t", isLeader: false }] })
    expect(eventReadLevel(facts(a))).toBe("member")
  })

  it.each<[string, EventReadFacts, EventReadLevel]>([
    ["signed in, private", facts(actor(null)), "summary"],
    ["signed in, public", facts(actor(null), true), "public"],
    ["anonymous, private", facts(null), "none"],
    ["anonymous, public", facts(null, true), "public"],
  ])("a non-member (%s) gets %s", (_name, f, level) => {
    expect(eventReadLevel(f)).toBe(level)
  })

  it("hides a private Event from non-members when decision 3 is members-only", () => {
    const decisions: ReadDecisions = {
      ...READ_DECISIONS,
      nonPublicEventForNonMembers: "members-only",
    }
    expect(eventReadLevel(facts(actor(null)), { decisions })).toBe("none")
    expect(eventReadLevel(facts(actor(null), true), { decisions })).toBe(
      "public"
    )
    expect(eventReadLevel(facts(actor("participant")), { decisions })).toBe(
      "member"
    )
  })

  it("lifts non-members to members in relaxed mode, never managers down", () => {
    const options = { mode: "relaxed" } as const
    expect(eventReadLevel(facts(null), options)).toBe("member")
    expect(eventReadLevel(facts(actor(null)), options)).toBe("member")
    expect(eventReadLevel(facts(actor("admin")), options)).toBe("manager")
  })
})

describe("levelAllows", () => {
  it.each<[EventReadLevel, boolean, boolean, boolean]>([
    // summary, content, member-data
    ["manager", true, true, true],
    ["member", true, true, true],
    ["public", true, true, false],
    ["summary", true, false, false],
    ["none", false, false, false],
  ])("%s", (level, summary, content, memberData) => {
    expect(levelAllows(level, "summary")).toBe(summary)
    expect(levelAllows(level, "content")).toBe(content)
    expect(levelAllows(level, "member-data")).toBe(memberData)
  })
})

describe("boardReadable", () => {
  it("lets managers read a draft Board and nobody else", () => {
    const draft = { visible: false }
    expect(boardReadable("manager", "content", draft)).toBe(true)
    expect(boardReadable("member", "content", draft)).toBe(false)
    expect(boardReadable("public", "content", draft)).toBe(false)
  })

  it("needs the scope on the Event for a visible Board", () => {
    const visible = { visible: true }
    expect(boardReadable("public", "content", visible)).toBe(true)
    expect(boardReadable("public", "member-data", visible)).toBe(false)
    expect(boardReadable("summary", "content", visible)).toBe(false)
    expect(boardReadable("none", "content", visible)).toBe(false)
  })
})

describe("tileContentReadable", () => {
  const board = { visible: true }

  it("hides hidden and Blind Tiles from everybody but managers", () => {
    for (const level of ["member", "public"] as const) {
      expect(
        tileContentReadable(level, board, { isHidden: false }, false)
      ).toBe(true)
      expect(tileContentReadable(level, board, { isHidden: true }, false)).toBe(
        false
      )
      expect(tileContentReadable(level, board, { isHidden: false }, true)).toBe(
        false
      )
    }
    expect(
      tileContentReadable("manager", board, { isHidden: true }, true)
    ).toBe(true)
  })

  it("needs a readable Board", () => {
    expect(
      tileContentReadable(
        "member",
        { visible: false },
        { isHidden: false },
        false
      )
    ).toBe(false)
    expect(
      tileContentReadable("summary", board, { isHidden: false }, false)
    ).toBe(false)
  })
})

describe("teamReadable", () => {
  const a = actor("participant", {
    teams: [{ teamId: "team-a", isLeader: false }],
  })

  it("lets everybody who reads the content see the Team summary", () => {
    expect(teamReadable(null, "public", "summary", { teamId: "team-a" })).toBe(
      true
    )
    expect(teamReadable(null, "summary", "summary", { teamId: "team-a" })).toBe(
      false
    )
  })

  it("lets the Team, its managers and other participants read the records", () => {
    expect(teamReadable(a, "member", "records", { teamId: "team-a" })).toBe(
      true
    )
    expect(teamReadable(a, "member", "records", { teamId: "team-b" })).toBe(
      true
    )
    expect(
      teamReadable(actor("admin"), "manager", "records", { teamId: "team-b" })
    ).toBe(true)
    expect(teamReadable(null, "public", "records", { teamId: "team-a" })).toBe(
      false
    )
  })

  it("keeps other Teams' records away on a battleship Board", () => {
    const ship = { isBattleship: true }
    expect(
      teamReadable(a, "member", "records", { teamId: "team-a" }, ship)
    ).toBe(true)
    expect(
      teamReadable(a, "member", "records", { teamId: "team-b" }, ship)
    ).toBe(false)
    expect(
      teamReadable(
        actor("admin"),
        "manager",
        "records",
        { teamId: "team-b" },
        ship
      )
    ).toBe(true)
  })
})

describe("secrets", () => {
  const board = {
    codephrase: "phrase",
    womCompetitionId: 7,
    womVerificationCode: "code",
  }

  it("shows the codephrase to managers and, by default, to players", () => {
    expect(codephraseVisible("manager")).toBe(true)
    expect(codephraseVisible("member")).toBe(true)
    for (const level of ["public", "summary", "none"] as const) {
      expect(codephraseVisible(level)).toBe(false)
    }
  })

  it("shows the codephrase to managers only when decision 5 says so", () => {
    const decisions: ReadDecisions = {
      ...READ_DECISIONS,
      codephrase: "managers",
    }
    expect(codephraseVisible("manager", decisions)).toBe(true)
    expect(codephraseVisible("member", decisions)).toBe(false)
  })

  it("redacts a Board per level; only managers get the verification code", () => {
    expect(redactBoardSecrets(board, "manager")).toEqual(board)
    expect(redactBoardSecrets(board, "member")).toEqual({
      ...board,
      womVerificationCode: null,
    })
    for (const level of ["public", "summary", "none"] as const) {
      expect(redactBoardSecrets(board, level)).toEqual({
        codephrase: "",
        womCompetitionId: null,
        womVerificationCode: null,
      })
    }
  })
})
