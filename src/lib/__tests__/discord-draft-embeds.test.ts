/**
 * @jest-environment node
 *
 * The shape of the team draft's Discord embeds (team draft 4/4, #218): what
 * is sent for the start, a pick, an undo, the completion and the applied
 * teams, and that every embed stays inside Discord's limits.
 */
import {
  createDraftAppliedEmbed,
  createDraftCompleteEmbed,
  createDraftPickEmbed,
  createDraftStartedEmbed,
  createDraftUndoEmbed,
  getTeamHslColor,
} from "@/lib/discord-webhook"

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

const pickData = {
  eventTitle: "Summer Bingo",
  pickNo: 7,
  totalPicks: 24,
  round: 2,
  teamName: "Team Rocket",
  teamColor: getTeamHslColor("Team Rocket"),
  playerName: "Zezima",
  rating: 83,
  madeBy: null,
} as const

describe("createDraftPickEmbed", () => {
  it("names the pick, the team, the round and the rating", () => {
    const embed = createDraftPickEmbed(pickData)
    expect(embed.title).toBe("🎯 Pick #7: Zezima")
    expect(embed.description).toBe("**Team Rocket** drafted **Zezima**")
    expect(embed.footer).toEqual({ text: "Summer Bingo • pick 7 of 24" })
    expect(embed.fields).toEqual([
      { name: "🏆 Team", value: "Team Rocket", inline: true },
      { name: "🔁 Round", value: "2", inline: true },
      { name: "⭐ Rating", value: "83/100", inline: true },
      { name: "🧾 How", value: "Picked by the captain", inline: false },
    ])
    expect(typeof embed.color).toBe("number")
    expect(Number.isNaN(Date.parse(embed.timestamp!))).toBe(false)
  })

  it("says Unrated for a player without data and who made the pick", () => {
    expect(
      createDraftPickEmbed({ ...pickData, rating: null, madeBy: "timer" })
        .fields
    ).toEqual(
      expect.arrayContaining([
        { name: "⭐ Rating", value: "Unrated", inline: true },
        {
          name: "🧾 How",
          value: "Auto-picked when the timer ran out",
          inline: false,
        },
      ])
    )
    expect(
      createDraftPickEmbed({ ...pickData, madeBy: "forced" }).fields
    ).toContainEqual({
      name: "🧾 How",
      value: "Picked by an organizer",
      inline: false,
    })
  })

  it("keeps a name from becoming Discord markdown", () => {
    const embed = createDraftPickEmbed({
      ...pickData,
      playerName: "_x_*y*~z~",
    })
    expect(embed.description).toBe(
      "**Team Rocket** drafted **\\_x\\_\\*y\\*\\~z\\~**"
    )
  })

  it("uses the team colour", () => {
    expect(createDraftPickEmbed(pickData).color).toBe(
      createDraftPickEmbed({ ...pickData, pickNo: 8 }).color
    )
    expect(createDraftPickEmbed(pickData).color).not.toBe(
      createDraftPickEmbed({
        ...pickData,
        teamName: "Other",
        teamColor: getTeamHslColor("Other"),
      }).color
    )
  })
})

describe("createDraftStartedEmbed", () => {
  it("lists the teams in pick order with the settings", () => {
    const embed = createDraftStartedEmbed({
      eventTitle: "Summer Bingo",
      teams: [
        { teamName: "B", captainName: "Bea" },
        { teamName: "A", captainName: "Al" },
      ],
      poolSize: 22,
      rounds: 11,
      orderLabel: "Snake",
      pickTimerSeconds: 90,
    })
    expect(embed.title).toBe("🏁 Team draft started")
    expect(embed.description).toBe(
      "1. **B** (captain Bea)\n2. **A** (captain Al)"
    )
    expect(embed.fields).toEqual([
      { name: "👥 Pool", value: "22 players", inline: true },
      { name: "🔁 Rounds", value: "11", inline: true },
      { name: "↕️ Order", value: "Snake", inline: true },
      { name: "⏱️ Pick timer", value: "90 seconds", inline: true },
    ])
  })

  it("says there is no timer when there is none", () => {
    const embed = createDraftStartedEmbed({
      eventTitle: "E",
      teams: [],
      poolSize: 4,
      rounds: 2,
      orderLabel: "Linear",
      pickTimerSeconds: null,
    })
    expect(embed.fields).toContainEqual({
      name: "⏱️ Pick timer",
      value: "No timer",
      inline: true,
    })
  })
})

describe("createDraftUndoEmbed", () => {
  it("says which pick was taken back", () => {
    const embed = createDraftUndoEmbed({
      eventTitle: "Summer Bingo",
      pickNo: 3,
      teamName: "A",
      playerName: "Bob",
    })
    expect(embed.title).toBe("↩️ Pick #3 undone")
    expect(embed.description).toContain("**Bob** is back in the pool")
    expect(embed.description).toContain("**A** is on the clock again")
  })
})

describe("roster embeds", () => {
  const teams = [
    { teamName: "A", captainName: "Al", players: ["Bob", "Cy"] },
    { teamName: "B", captainName: "Bea", players: [] },
  ]

  it("show the final rosters when the draft completes", () => {
    const embed = createDraftCompleteEmbed({ eventTitle: "E", teams })
    expect(embed.title).toBe("✅ Team draft complete")
    expect(embed.fields).toEqual([
      { name: "🏆 A", value: "👑 Al\n• Bob\n• Cy", inline: true },
      { name: "🏆 B", value: "👑 Bea", inline: true },
    ])
    expect(embed.footer).toEqual({ text: "E" })
  })

  it("show the same rosters when the teams are applied", () => {
    const embed = createDraftAppliedEmbed({ eventTitle: "E", teams })
    expect(embed.title).toBe("📣 Teams are set")
    expect(embed.fields).toHaveLength(2)
  })

  it("stay inside Discord's limits for a huge draft", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      teamName: `Team ${i}`,
      captainName: "Captain",
      players: Array.from({ length: 80 }, (_, j) => `Player number ${j}`),
    }))
    const embed = createDraftCompleteEmbed({ eventTitle: "E", teams: many })
    expect(embed.fields).toHaveLength(25)
    for (const field of embed.fields!) {
      expect(field.value.length).toBeLessThanOrEqual(1024)
      expect(field.name.length).toBeLessThanOrEqual(256)
    }
  })
})
