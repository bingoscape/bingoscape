/**
 * @jest-environment node
 */
import {
  describeDraftSetup,
  draftSettingsSchema,
  summarizeDraftSetup,
} from "@/lib/draft/setup"

const captain = (n: number) => ({
  userId: `00000000-0000-4000-8000-00000000000${n}`,
  teamName: `Team ${n}`,
})

describe("summarizeDraftSetup", () => {
  it("describes the example from the issue", () => {
    const summary = summarizeDraftSetup({
      poolSize: 24,
      captains: 4,
      rounds: 6,
    })
    expect(summary).toEqual({
      players: 24,
      teams: 4,
      rounds: 6,
      leftover: 0,
      shortfall: 0,
      extraTeams: 0,
    })
    expect(describeDraftSetup(summary)).toBe(
      "24 players, 4 teams, 6 rounds, 0 leftover"
    )
  })

  it("counts leftover players and a short pool", () => {
    expect(
      summarizeDraftSetup({ poolSize: 10, captains: 2, rounds: 3 }).leftover
    ).toBe(4)
    const short = summarizeDraftSetup({ poolSize: 5, captains: 2, rounds: 3 })
    expect(short).toMatchObject({ leftover: 0, shortfall: 1 })
    expect(describeDraftSetup(short)).toContain("1 pick short")
  })
})

describe("draftSettingsSchema", () => {
  const valid = {
    orderType: "snake",
    rounds: 5,
    pickTimerSeconds: null,
    onTimeout: "auto_pick",
    autoPickRule: "best_rated",
    captains: [captain(1), captain(2)],
  }

  it("accepts a valid setup", () => {
    expect(draftSettingsSchema.safeParse(valid).success).toBe(true)
  })

  it.each([
    ["one captain", { captains: [captain(1)] }],
    ["zero rounds", { rounds: 0 }],
    ["a fractional timer", { pickTimerSeconds: 1.5 }],
    ["a zero timer", { pickTimerSeconds: 0 }],
    ["an unknown order", { orderType: "zigzag" }],
    ["an unknown timeout behaviour", { onTimeout: "explode" }],
    [
      "a blank team name",
      { captains: [captain(1), { ...captain(2), teamName: " " }] },
    ],
    [
      "a non-uuid captain",
      { captains: [captain(1), { userId: "x", teamName: "T" }] },
    ],
  ])("rejects %s", (_name, override) => {
    expect(
      draftSettingsSchema.safeParse({ ...valid, ...override }).success
    ).toBe(false)
  })
})
