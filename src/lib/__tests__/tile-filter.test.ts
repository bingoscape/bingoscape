/**
 * @jest-environment node
 */
import {
  availableFilters,
  countTilesByFilter,
  getDimmedTileIds,
  resolveTileFilter,
  tileMatchesFilter,
} from "@/lib/tile-filter"

const tile = (
  id: string,
  tts: Array<{ teamId: string; status: string; subs?: string[] }> = [],
  isHidden = false
) => ({
  id,
  weight: 1,
  isHidden,
  teamTileSubmissions: tts.map((t) => ({
    teamId: t.teamId,
    status: t.status,
    submissions: (t.subs ?? []).map((s) => ({ status: s })),
  })),
})

const player = { teamId: "t1", isManagement: false }
const manager = { teamId: "t1", isManagement: true }

const tiles = [
  tile("done", [{ teamId: "t1", status: "completed", subs: ["approved"] }]),
  tile("pending", [{ teamId: "t1", status: "incomplete", subs: ["pending"] }]),
  tile("changes", [{ teamId: "t1", status: "needs_attention" }]),
  tile("other-team", [
    { teamId: "t2", status: "incomplete", subs: ["pending"] },
  ]),
  tile("untouched"),
  tile(
    "secret",
    [{ teamId: "t1", status: "incomplete", subs: ["pending"] }],
    true
  ),
]

describe("availableFilters", () => {
  it("offers hidden to management only", () => {
    expect(availableFilters(player)).not.toContain("hidden")
    expect(availableFilters(manager)).toContain("hidden")
  })

  it("needs a Team for incomplete", () => {
    expect(
      availableFilters({ teamId: undefined, isManagement: false })
    ).toEqual(["attention"])
  })
})

describe("resolveTileFilter", () => {
  it("drops a filter the viewer may not use", () => {
    expect(resolveTileFilter("hidden", player)).toBeNull()
    expect(resolveTileFilter("hidden", manager)).toBe("hidden")
    expect(
      resolveTileFilter("incomplete", { ...player, teamId: undefined })
    ).toBeNull()
    expect(resolveTileFilter(null, player)).toBeNull()
  })
})

describe("tileMatchesFilter", () => {
  const ids = (filter: Parameters<typeof tileMatchesFilter>[1], ctx = player) =>
    tiles.filter((t) => tileMatchesFilter(t, filter, ctx)).map((t) => t.id)

  it("attention (player): own pending and changes requested, not completed", () => {
    expect(ids("attention")).toEqual(["pending", "changes"])
  })

  it("attention (management): any Team's pending Submission", () => {
    expect(ids("attention", manager)).toEqual(["pending", "other-team"])
  })

  it("incomplete: not completed by the viewed Team", () => {
    expect(ids("incomplete")).toEqual([
      "pending",
      "changes",
      "other-team",
      "untouched",
    ])
  })

  it("hidden: management sees placeholders, players match nothing", () => {
    expect(ids("hidden", manager)).toEqual(["secret"])
    expect(ids("hidden")).toEqual([])
  })

  it("never matches a hidden Tile for the other filters", () => {
    expect(ids("attention")).not.toContain("secret")
    expect(ids("incomplete", manager)).not.toContain("secret")
  })
})

describe("getDimmedTileIds / countTilesByFilter", () => {
  it("returns undefined without a filter", () => {
    expect(getDimmedTileIds(tiles, null, player)).toBeUndefined()
  })

  it("dims everything that does not match", () => {
    const dimmed = getDimmedTileIds(tiles, "attention", player)!
    expect([...dimmed].sort()).toEqual(
      ["done", "other-team", "untouched", "secret"].sort()
    )
  })

  it("counts only the filters available to the viewer", () => {
    expect(countTilesByFilter(tiles, player)).toEqual({
      attention: 2,
      incomplete: 4,
      hidden: 0,
    })
    expect(countTilesByFilter(tiles, manager).hidden).toBe(1)
  })
})
