/**
 * @jest-environment node
 */
import { redactHiddenTile, redactHiddenTiles } from "@/lib/hidden-tiles"

const tile = (overrides: object = {}) => ({
  id: "t1",
  index: 3,
  tier: 1,
  weight: 5,
  isHidden: true,
  title: "Secret boss",
  description: "Kill it",
  headerImage: "https://example.com/boss.png",
  goals: [{ id: "g1", description: "Kill" }],
  goalGroups: [{ id: "grp1", name: "Secret group" }],
  teamTileSubmissions: [
    {
      id: "tts1",
      status: "completed",
      submissions: [{ id: "s1", image: { path: "/uploads/x" } }],
    },
  ],
  ...overrides,
})

describe("redactHiddenTile", () => {
  it("blanks content but keeps identity and XP fields for hidden Tiles", () => {
    const result = redactHiddenTile(tile())
    expect(result).toMatchObject({
      id: "t1",
      index: 3,
      tier: 1,
      weight: 5,
      isHidden: true,
      title: "",
      description: "",
      headerImage: null,
      goals: [],
      goalGroups: [],
    })
    expect(result.teamTileSubmissions).toEqual([
      { id: "tts1", status: "completed", submissions: [] },
    ])
  })

  it("leaves visible Tiles untouched", () => {
    const visible = tile({ isHidden: false })
    expect(redactHiddenTile(visible)).toBe(visible)
  })

  it("does not mutate its input", () => {
    const hidden = tile()
    redactHiddenTile(hidden)
    expect(hidden.title).toBe("Secret boss")
    expect(hidden.goals).toHaveLength(1)
  })

  it("does not add relations the Tile did not have", () => {
    const bare = { isHidden: true, title: "x", description: "y", headerImage: "z" }
    expect(redactHiddenTile(bare)).toEqual({
      isHidden: true,
      title: "",
      description: "",
      headerImage: null,
    })
  })

  it("redacts only hidden Tiles in a list and keeps order", () => {
    const list = [tile({ id: "a", isHidden: false }), tile({ id: "b" })]
    const result = redactHiddenTiles(list)
    expect(result.map((t) => t.id)).toEqual(["a", "b"])
    expect(result[0]!.title).toBe("Secret boss")
    expect(result[1]!.title).toBe("")
  })
})
