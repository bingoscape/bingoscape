/**
 * @jest-environment node
 */
import {
  getAttentionTiles,
  getBoardStats,
  getTileTeamStatus,
} from "@/lib/tile-status"

const tile = (
  id: string,
  weight: number,
  tts: Array<{
    teamId: string
    status: string
    subs?: string[]
  }> = [],
  isHidden = false
) => ({
  id,
  weight,
  isHidden,
  teamTileSubmissions: tts.map((t) => ({
    teamId: t.teamId,
    status: t.status,
    submissions: (t.subs ?? []).map((s) => ({ status: s })),
  })),
})

describe("getTileTeamStatus", () => {
  it("is incomplete without a team or record", () => {
    expect(getTileTeamStatus(tile("a", 1), "t1")).toEqual({
      completion: "incomplete",
      submissionState: null,
    })
    expect(
      getTileTeamStatus(tile("a", 1, [{ teamId: "t1", status: "completed" }]), undefined)
    ).toEqual({ completion: "incomplete", submissionState: null })
  })

  it("only looks at the requested team", () => {
    const t = tile("a", 1, [{ teamId: "t2", status: "completed" }])
    expect(getTileTeamStatus(t, "t1").completion).toBe("incomplete")
    expect(getTileTeamStatus(t, "t2").completion).toBe("completed")
  })

  it("ranks needs_review above pending above approved", () => {
    const state = (subs: string[], status = "incomplete") =>
      getTileTeamStatus(tile("a", 1, [{ teamId: "t1", status, subs }]), "t1")
        .submissionState
    expect(state(["approved", "pending", "needs_review"])).toBe("needs_review")
    expect(state(["approved", "pending"])).toBe("pending")
    expect(state(["approved"])).toBe("approved")
    expect(state([])).toBeNull()
  })

  it("treats team-level needs_attention as changes requested", () => {
    const t = tile("a", 1, [{ teamId: "t1", status: "needs_attention" }])
    expect(getTileTeamStatus(t, "t1")).toEqual({
      completion: "incomplete",
      submissionState: "needs_review",
    })
  })
})

describe("getBoardStats", () => {
  const tiles = [
    tile("1", 5, [{ teamId: "t1", status: "completed", subs: ["approved"] }]),
    tile("2", 3, [{ teamId: "t1", status: "incomplete", subs: ["pending"] }]),
    tile("3", 2, [{ teamId: "t1", status: "needs_attention", subs: ["needs_review"] }]),
    tile("4", 10),
    tile("5", 1, [], true),
  ]

  it("counts completed, pending, review and remaining for a team", () => {
    expect(getBoardStats(tiles, "t1")).toEqual({
      total: 5,
      completed: 1,
      pending: 1,
      needsReview: 1,
      remaining: 2,
      xpEarned: 5,
      xpTotal: 21,
      percent: 20,
    })
  })

  it("handles an empty board and no team", () => {
    expect(getBoardStats([], "t1").percent).toBe(0)
    expect(getBoardStats(tiles, undefined).completed).toBe(0)
  })
})

describe("getAttentionTiles", () => {
  it("lists changes-requested before pending and skips completed", () => {
    const tiles = [
      tile("p", 1, [{ teamId: "t1", status: "incomplete", subs: ["pending"] }]),
      tile("c", 1, [{ teamId: "t1", status: "completed", subs: ["pending"] }]),
      tile("n", 1, [{ teamId: "t1", status: "incomplete", subs: ["needs_review"] }]),
    ]
    const result = getAttentionTiles(tiles, "t1")
    expect(result.map((r) => r.tile.id)).toEqual(["n", "p"])
  })
})
