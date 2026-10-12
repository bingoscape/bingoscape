import { keepOwnTeamRecords } from "../battleship-privacy"

const tile = {
  id: "t1",
  teamTileSubmissions: [
    { teamId: "a", status: "completed" },
    { teamId: "b", status: "completed" },
  ],
}

describe("keepOwnTeamRecords", () => {
  it("keeps only the own team's records", () => {
    expect(keepOwnTeamRecords(tile, "a").teamTileSubmissions).toEqual([
      { teamId: "a", status: "completed" },
    ])
  })

  it("keeps nothing for people on no team", () => {
    expect(keepOwnTeamRecords(tile, null).teamTileSubmissions).toEqual([])
  })

  it("does not mutate the tile and leaves tiles without records alone", () => {
    keepOwnTeamRecords(tile, "a")
    expect(tile.teamTileSubmissions).toHaveLength(2)
    const bare: { id: string; teamTileSubmissions?: undefined } = { id: "t2" }
    expect(keepOwnTeamRecords(bare, "a")).toBe(bare)
  })
})
