import { placeShipsTeamId } from "../battleship-workspace"

const teamIds = ["t1", "t2"]

describe("placeShipsTeamId", () => {
  it("gives a leader their own team, whichever team is being viewed", () => {
    expect(
      placeShipsTeamId({
        isManagement: false,
        ledTeamId: "t1",
        viewedTeamId: "t2",
        teamIds,
      })
    ).toBe("t1")
  })

  it("gives nothing to people who lead no team", () => {
    expect(
      placeShipsTeamId({
        isManagement: false,
        ledTeamId: null,
        viewedTeamId: "t1",
        teamIds,
      })
    ).toBeNull()
  })

  it("lets a manager place for the viewed team, or the first team", () => {
    expect(
      placeShipsTeamId({
        isManagement: true,
        ledTeamId: null,
        viewedTeamId: "t2",
        teamIds,
      })
    ).toBe("t2")
    expect(
      placeShipsTeamId({
        isManagement: true,
        ledTeamId: null,
        viewedTeamId: undefined,
        teamIds,
      })
    ).toBe("t1")
    expect(
      placeShipsTeamId({
        isManagement: true,
        ledTeamId: null,
        viewedTeamId: "gone",
        teamIds,
      })
    ).toBe("t1")
  })

  it("gives a manager nothing in an event without teams", () => {
    expect(
      placeShipsTeamId({
        isManagement: true,
        ledTeamId: null,
        viewedTeamId: undefined,
        teamIds: [],
      })
    ).toBeNull()
  })
})
