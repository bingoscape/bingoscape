/**
 * @jest-environment node
 */
import { buildLeaderboard } from "@/lib/leaderboard"

const teams = [
  { id: "a", name: "Alpha", memberCount: 3 },
  { id: "b", name: "Bravo", memberCount: 2 },
  { id: "c", name: "Charlie" },
  { id: "d", name: "Delta" },
]

describe("buildLeaderboard", () => {
  it("orders Teams by XP descending", () => {
    const rows = buildLeaderboard(teams, [
      { teamId: "a", totalXP: 10 },
      { teamId: "b", totalXP: 30 },
      { teamId: "c", totalXP: 20 },
    ])
    expect(rows.map((r) => r.teamId)).toEqual(["b", "c", "a", "d"])
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4])
  })

  it("lists Teams without XP at zero", () => {
    const rows = buildLeaderboard(teams, [{ teamId: "a", totalXP: 5 }])
    expect(rows.find((r) => r.teamId === "d")?.xp).toBe(0)
  })

  it("gives equal XP the same rank and breaks display ties by name", () => {
    const rows = buildLeaderboard(teams, [
      { teamId: "b", totalXP: 20 },
      { teamId: "a", totalXP: 20 },
      { teamId: "c", totalXP: 5 },
    ])
    expect(rows.map((r) => [r.name, r.rank])).toEqual([
      ["Alpha", 1],
      ["Bravo", 1],
      ["Charlie", 3],
      ["Delta", 4],
    ])
  })

  it("ignores points of Teams that no longer exist and keeps bonus split", () => {
    const rows = buildLeaderboard(teams, [
      { teamId: "ghost", totalXP: 999 },
      { teamId: "a", totalXP: 12, baseXP: 10, bonusXP: 2 },
    ])
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({ teamId: "a", xp: 12, baseXP: 10, bonusXP: 2 })
  })

  it("handles no Teams", () => {
    expect(buildLeaderboard([], [])).toEqual([])
  })
})
