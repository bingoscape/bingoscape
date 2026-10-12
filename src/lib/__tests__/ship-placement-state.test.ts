import {
  countByLength,
  createPlacementState,
  firstUnplacedLength,
  fleetFingerprint,
  isDirty,
  isFleetComplete,
  placementReducer,
  type PlacementAction,
  type PlacementConfig,
  type PlacementState,
} from "../ship-placement-state"

/**
 * 4x4 board, tile ids "t<index>". Index 5 (row 1, column 1) is hidden.
 *
 *   t0  t1  t2  t3
 *   t4  t5* t6  t7
 *   t8  t9  t10 t11
 *   t12 t13 t14 t15
 */
const COLUMNS = 4
const coords = Array.from({ length: 16 }, (_, index) => ({
  id: `t${index}`,
  col: index % COLUMNS,
  row: Math.floor(index / COLUMNS),
})).filter((c) => c.id !== "t5")

const config = (overrides: Partial<PlacementConfig> = {}): PlacementConfig => ({
  coords,
  required: { 2: 1, 3: 2 },
  locked: false,
  ...overrides,
})

function run(
  state: PlacementState,
  ...actions: PlacementAction[]
): PlacementState {
  return actions.reduce(placementReducer, state)
}

const click = (...ids: string[]): PlacementAction[] =>
  ids.map((id) => ({ type: "clickTile", tileId: id }))

const fresh = (overrides: Partial<PlacementConfig> = {}) =>
  createPlacementState(config(overrides), [])

describe("helpers", () => {
  it("counts ships per length", () => {
    expect(
      countByLength([{ length: 3 }, { length: 2 }, { length: 3 }])
    ).toEqual({ 2: 1, 3: 2 })
  })

  it("picks the smallest length that still needs ships", () => {
    expect(firstUnplacedLength({ 2: 1, 3: 2 }, { 2: 1, 3: 1 })).toBe(3)
    expect(firstUnplacedLength({ 2: 1, 3: 2 }, { 2: 1, 3: 2 })).toBeNull()
    expect(firstUnplacedLength({ 2: 1, 3: 2 }, {})).toBe(2)
  })

  it("knows when a fleet is complete", () => {
    expect(isFleetComplete({ 2: 1, 3: 2 }, { 2: 1, 3: 2 })).toBe(true)
    expect(isFleetComplete({ 2: 1, 3: 2 }, { 2: 1, 3: 1 })).toBe(false)
    expect(isFleetComplete({ 2: 1 }, { 2: 1, 4: 1 })).toBe(false)
    expect(isFleetComplete({}, {})).toBe(false)
  })

  it("fingerprints a fleet regardless of order", () => {
    expect(
      fleetFingerprint([
        { length: 2, tileIds: ["b", "a"] },
        { length: 3, tileIds: ["x", "y", "z"] },
      ])
    ).toBe(
      fleetFingerprint([
        { length: 3, tileIds: ["z", "y", "x"] },
        { length: 2, tileIds: ["a", "b"] },
      ])
    )
  })
})

describe("placing ships", () => {
  it("starts with the smallest unplaced length selected", () => {
    expect(fresh().selectedLength).toBe(2)
  })

  it("places a ship tile by tile and moves on to the next length", () => {
    const state = run(fresh(), ...click("t0", "t1"))
    expect(state.ships).toEqual([
      { id: "ship-0", length: 2, tileIds: ["t0", "t1"] },
    ])
    expect(state.current).toBeNull()
    expect(state.selectedLength).toBe(3)
    expect(state.message).toMatch(/Next: a 3-tile ship/)
  })

  it("keeps the length selected while ships of it remain", () => {
    const state = run(fresh(), ...click("t0", "t1"), ...click("t4", "t5"))
    // t5 is hidden, so the second click was refused and a 3-tile ship started.
    expect(state.current).toEqual({ length: 3, tileIds: ["t4"] })

    const two = run(
      fresh(),
      { type: "selectLength", length: 3 },
      ...click("t0", "t1", "t2"),
      { type: "selectLength", length: 3 }
    )
    expect(two.selectedLength).toBe(3)
  })

  it("lets a ship grow from either end, but not sideways or with a gap", () => {
    let state = run(
      fresh(),
      { type: "selectLength", length: 3 },
      ...click("t9")
    )

    state = run(state, ...click("t11"))
    expect(state.current?.tileIds).toEqual(["t9"])
    expect(state.message).toMatch(/straight line/)

    state = run(state, ...click("t14"))
    expect(state.current?.tileIds).toEqual(["t9"])

    state = run(state, ...click("t10"))
    expect(state.current?.tileIds).toEqual(["t9", "t10"])

    // Now only the tiles next to either end are accepted.
    state = run(state, ...click("t6"))
    expect(state.current?.tileIds).toEqual(["t9", "t10"])
    state = run(state, ...click("t8"))
    expect(state.ships).toHaveLength(1)
    expect(state.ships[0]!.tileIds.slice().sort()).toEqual(["t10", "t8", "t9"])
  })

  it("takes a tile and what came after it back when it is clicked again", () => {
    let state = run(
      fresh(),
      { type: "selectLength", length: 3 },
      ...click("t8", "t9")
    )
    state = run(state, ...click("t9"))
    expect(state.current?.tileIds).toEqual(["t8"])
    state = run(state, ...click("t8"))
    expect(state.current).toBeNull()
  })

  it("refuses hidden tiles", () => {
    const state = run(fresh(), ...click("t5"))
    expect(state.current).toBeNull()
    expect(state.message).toMatch(/hidden/)
  })

  it("refuses a tile that holds another ship while building one", () => {
    const state = run(
      fresh(),
      ...click("t0", "t1"),
      { type: "selectLength", length: 3 },
      ...click("t2", "t1")
    )
    expect(state.current?.tileIds).toEqual(["t2"])
    expect(state.message).toMatch(/already holds another ship/)
  })

  it("cannot switch length while a ship is being built", () => {
    const state = run(fresh(), ...click("t0"), {
      type: "selectLength",
      length: 3,
    })
    expect(state.current).toEqual({ length: 2, tileIds: ["t0"] })
    expect(state.message).toMatch(/Finish or cancel/)
  })

  it("can cancel the ship being built", () => {
    const state = run(fresh(), ...click("t0"), { type: "cancelCurrent" })
    expect(state.current).toBeNull()
    expect(state.ships).toHaveLength(0)
  })

  it("does not place more ships of a length than the rules need", () => {
    const state = run(fresh({ required: { 2: 1 } }), ...click("t0", "t1"), {
      type: "selectLength",
      length: 2,
    })
    expect(state.message).toMatch(/already placed/)
    const after = run(state, ...click("t8"))
    expect(after.current).toBeNull()
    expect(after.message).toMatch(/All ships are placed/)
  })

  it("uses the aggregated count per length for duplicate-length rules", () => {
    // Rules {2x1}+{2x1} aggregate to two 2-ships.
    let state = fresh({ required: { 2: 2 } })
    state = run(state, ...click("t0", "t1"))
    expect(state.selectedLength).toBe(2)
    state = run(state, ...click("t8", "t9"))
    expect(state.selectedLength).toBeNull()
    expect(
      isFleetComplete(state.config.required, countByLength(state.ships))
    ).toBe(true)
  })
})

describe("selecting and removing a single ship", () => {
  const placed = () =>
    run(
      fresh(),
      ...click("t0", "t1"),
      ...click("t8", "t9", "t10"),
      ...click("t12", "t13", "t14")
    )

  it("selects a placed ship and removes only that ship", () => {
    let state = placed()
    expect(state.ships).toHaveLength(3)
    expect(state.selectedLength).toBeNull()

    state = run(state, ...click("t9"))
    expect(state.selectedShipId).toBe("ship-1")

    state = run(state, { type: "removeSelected" })
    expect(state.ships.map((s) => s.id)).toEqual(["ship-0", "ship-2"])
    expect(state.selectedShipId).toBeNull()
    // The removed length can be placed again.
    expect(state.selectedLength).toBe(3)
    state = run(state, ...click("t2", "t6", "t10"))
    expect(state.ships).toHaveLength(3)
  })

  it("deselects a ship when it is clicked again", () => {
    const state = run(placed(), ...click("t0", "t0"))
    expect(state.selectedShipId).toBeNull()
  })

  it("does nothing when removing without a selection", () => {
    const state = placed()
    expect(run(state, { type: "removeSelected" })).toBe(state)
  })

  it("resets the whole draft", () => {
    const state = run(placed(), { type: "reset" })
    expect(state.ships).toHaveLength(0)
    expect(state.selectedLength).toBe(2)
  })
})

describe("saved fleet and unsaved changes", () => {
  const saved = [
    { length: 2, tileIds: ["t0", "t1"] },
    { length: 3, tileIds: ["t8", "t9", "t10"] },
    { length: 3, tileIds: ["t12", "t13", "t14"] },
  ]

  it("starts clean with a saved fleet and nothing left to place", () => {
    const state = createPlacementState(config(), saved)
    expect(isDirty(state)).toBe(false)
    expect(state.selectedLength).toBeNull()
  })

  it("becomes dirty after removing a ship and clean again after reverting", () => {
    let state = createPlacementState(config(), saved)
    state = run(state, ...click("t0"), { type: "removeSelected" })
    expect(isDirty(state)).toBe(true)

    state = run(state, { type: "revert" })
    expect(isDirty(state)).toBe(false)
    expect(state.ships).toHaveLength(3)
  })

  it("is dirty while a ship is half built", () => {
    const state = run(fresh(), ...click("t0"))
    expect(isDirty(state)).toBe(true)
  })

  it("is clean after the draft was marked as saved", () => {
    let state = run(fresh(), ...click("t0", "t1"))
    expect(isDirty(state)).toBe(true)
    state = run(state, { type: "markSaved" })
    expect(isDirty(state)).toBe(false)
    expect(state.savedShips).toEqual([{ length: 2, tileIds: ["t0", "t1"] }])
  })

  it("treats an emptied draft as a change when something was saved", () => {
    const state = run(createPlacementState(config(), saved), { type: "reset" })
    expect(isDirty(state)).toBe(true)
  })
})

describe("locked", () => {
  it("ignores every action once the event started", () => {
    const state = createPlacementState(config({ locked: true }), [
      { length: 2, tileIds: ["t0", "t1"] },
    ])
    expect(state.selectedLength).toBeNull()

    const after = run(
      state,
      ...click("t8", "t0"),
      { type: "selectLength", length: 3 },
      { type: "removeSelected" },
      { type: "reset" }
    )
    expect(after.ships).toEqual(state.ships)
    expect(after.current).toBeNull()
    expect(after.selectedShipId).toBeNull()
    expect(after.message).toMatch(/locked/)
  })
})
