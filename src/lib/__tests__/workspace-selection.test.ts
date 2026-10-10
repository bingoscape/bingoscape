/**
 * @jest-environment node
 */
import { resolveWorkspaceSelection } from "@/lib/workspace-selection"

const bingos = [
  { id: "b1", visible: true },
  { id: "b2", visible: false },
  { id: "b3", visible: true },
]
const teams = [{ id: "t1" }, { id: "t2" }]

const base = {
  bingos,
  teams,
  isManagement: false,
  ownTeamId: "t1",
  board: null,
  teamId: null,
}

describe("resolveWorkspaceSelection", () => {
  it("players only see visible Boards and default to the first", () => {
    const r = resolveWorkspaceSelection(base)
    expect(r.bingos.map((b) => b.id)).toEqual(["b1", "b3"])
    expect(r.bingo?.id).toBe("b1")
  })

  it("managers see every Board", () => {
    const r = resolveWorkspaceSelection({ ...base, isManagement: true })
    expect(r.bingos).toHaveLength(3)
  })

  it("?board selects a Board when visible to the viewer", () => {
    expect(resolveWorkspaceSelection({ ...base, board: "b3" }).bingo?.id).toBe(
      "b3"
    )
    // hidden Board for a player falls back to the first visible one
    expect(resolveWorkspaceSelection({ ...base, board: "b2" }).bingo?.id).toBe(
      "b1"
    )
    expect(
      resolveWorkspaceSelection({ ...base, isManagement: true, board: "b2" })
        .bingo?.id
    ).toBe("b2")
  })

  it("an unknown ?board falls back to the first Board", () => {
    expect(
      resolveWorkspaceSelection({ ...base, board: "nope" }).bingo?.id
    ).toBe("b1")
  })

  it("players always use their own Team and ignore ?teamId", () => {
    expect(
      resolveWorkspaceSelection({ ...base, teamId: "t2" }).effectiveTeamId
    ).toBe("t1")
  })

  it("managers can view as another Team, defaulting to their own", () => {
    const m = { ...base, isManagement: true }
    expect(resolveWorkspaceSelection({ ...m, teamId: "t2" }).effectiveTeamId).toBe(
      "t2"
    )
    expect(resolveWorkspaceSelection(m).effectiveTeamId).toBe("t1")
    expect(
      resolveWorkspaceSelection({ ...m, ownTeamId: undefined }).effectiveTeamId
    ).toBeUndefined()
  })

  it("ignores a ?teamId that is not a Team of the Event", () => {
    expect(
      resolveWorkspaceSelection({
        ...base,
        isManagement: true,
        teamId: "foreign",
      }).effectiveTeamId
    ).toBe("t1")
  })

  it("read-only (public) view uses ?teamId only", () => {
    const p = { ...base, readOnly: true, ownTeamId: undefined }
    expect(resolveWorkspaceSelection(p).effectiveTeamId).toBeUndefined()
    expect(resolveWorkspaceSelection({ ...p, teamId: "t2" }).effectiveTeamId).toBe(
      "t2"
    )
  })

  it("handles an Event without Boards", () => {
    const r = resolveWorkspaceSelection({ ...base, bingos: undefined })
    expect(r.bingo).toBeUndefined()
    expect(r.bingos).toEqual([])
  })
})
