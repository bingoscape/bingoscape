import {
  resolvePlacementAccess,
  type PlacementAccessInput,
} from "../ship-placement-access"

const base: PlacementAccessInput = {
  bingoType: "battleship",
  isManager: false,
  ledTeamId: null,
  teamIds: ["t1", "t2"],
  requestedTeamId: null,
}

describe("resolvePlacementAccess", () => {
  it("lets a team leader place their own team's ships", () => {
    expect(resolvePlacementAccess({ ...base, ledTeamId: "t1" })).toEqual({
      ok: true,
      teamId: "t1",
      canSwitchTeam: false,
    })
    expect(
      resolvePlacementAccess({
        ...base,
        ledTeamId: "t1",
        requestedTeamId: "t1",
      })
    ).toEqual({ ok: true, teamId: "t1", canSwitchTeam: false })
  })

  it("denies a leader the other team", () => {
    expect(
      resolvePlacementAccess({
        ...base,
        ledTeamId: "t1",
        requestedTeamId: "t2",
      })
    ).toEqual({ ok: false, reason: "no-access" })
  })

  it("denies everybody who leads no team and does not manage the event", () => {
    expect(resolvePlacementAccess(base)).toEqual({
      ok: false,
      reason: "no-access",
    })
    expect(resolvePlacementAccess({ ...base, requestedTeamId: "t1" })).toEqual({
      ok: false,
      reason: "no-access",
    })
  })

  it("lets a manager place for either team and switch between them", () => {
    expect(
      resolvePlacementAccess({
        ...base,
        isManager: true,
        requestedTeamId: "t2",
      })
    ).toEqual({ ok: true, teamId: "t2", canSwitchTeam: true })
    expect(resolvePlacementAccess({ ...base, isManager: true })).toEqual({
      ok: true,
      teamId: "t1",
      canSwitchTeam: true,
    })
  })

  it("lets a manager who leads a team still choose the other one", () => {
    expect(
      resolvePlacementAccess({
        ...base,
        isManager: true,
        ledTeamId: "t1",
        requestedTeamId: "t2",
      })
    ).toMatchObject({ ok: true, teamId: "t2" })
  })

  it("does not accept a team of another event, even for a manager", () => {
    expect(
      resolvePlacementAccess({
        ...base,
        isManager: true,
        requestedTeamId: "foreign",
      })
    ).toEqual({ ok: false, reason: "team-not-found" })
  })

  it("has nothing to offer a manager in an event without teams", () => {
    expect(
      resolvePlacementAccess({ ...base, isManager: true, teamIds: [] })
    ).toEqual({ ok: false, reason: "no-team" })
  })

  it("answers not found for boards that are not battleship boards, whoever asks", () => {
    for (const bingoType of ["standard", "progression"]) {
      expect(
        resolvePlacementAccess({
          ...base,
          bingoType,
          isManager: true,
          ledTeamId: "t1",
        })
      ).toEqual({ ok: false, reason: "not-battleship" })
    }
  })
})
