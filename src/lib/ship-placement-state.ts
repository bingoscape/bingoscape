import {
  canAddTileToShip,
  isStraightContiguous,
  type ShipPlacementInput,
  type TileCoord,
} from "@/lib/ship-placement"

/**
 * The draft fleet of the ship placement page, as a pure reducer so the rules
 * of placing (straight lines, extend from an end, remove a single ship) are
 * tested without a browser.
 *
 * Vocabulary: a ship is "placed" once it has all its tiles; the ship being
 * built tile by tile is "current". "Saved" is what the server holds.
 */

export interface PlacedShip {
  /** Local id, only for selecting a ship; never sent to the server. */
  id: string
  length: number
  tileIds: string[]
}

export interface PlacementConfig {
  /** Position of every tile a ship may lie on (hidden tiles are left out). */
  coords: TileCoord[]
  /** How many ships of each length the fleet needs, aggregated per length. */
  required: Record<number, number>
  /** The event started: nothing can change any more. */
  locked: boolean
}

export interface PlacementState {
  config: PlacementConfig
  ships: PlacedShip[]
  /** The fleet the server holds, to detect unsaved changes and to revert. */
  savedShips: ShipPlacementInput[]
  current: { length: number; tileIds: string[] } | null
  /** Length of the next ship to place. */
  selectedLength: number | null
  /** A placed ship picked for removal. */
  selectedShipId: string | null
  nextShipId: number
  /** Short sentence for the live region: what just happened / what to do. */
  message: string
}

export type PlacementAction =
  | { type: "selectLength"; length: number }
  | { type: "clickTile"; tileId: string }
  | { type: "cancelCurrent" }
  | { type: "removeSelected" }
  | { type: "reset" }
  | { type: "revert" }
  | { type: "markSaved" }

export function countByLength(
  ships: Array<{ length: number }>
): Record<number, number> {
  const counts: Record<number, number> = {}
  for (const ship of ships) counts[ship.length] = (counts[ship.length] ?? 0) + 1
  return counts
}

/** The smallest ship length that still needs ships, or null when none does. */
export function firstUnplacedLength(
  required: Record<number, number>,
  placed: Record<number, number>
): number | null {
  const lengths = Object.keys(required)
    .map(Number)
    .sort((a, b) => a - b)
  return lengths.find((l) => (placed[l] ?? 0) < (required[l] ?? 0)) ?? null
}

/** True when exactly the required number of ships of every length is placed. */
export function isFleetComplete(
  required: Record<number, number>,
  placed: Record<number, number>
): boolean {
  const lengths = Object.keys(required).map(Number)
  return (
    lengths.length > 0 &&
    lengths.every((l) => (placed[l] ?? 0) === required[l]) &&
    Object.keys(placed).every((l) => required[Number(l)] !== undefined)
  )
}

/** Order independent description of a fleet, to compare drafts. */
export function fleetFingerprint(ships: ShipPlacementInput[]): string {
  return ships
    .map((s) => `${s.length}:${[...s.tileIds].sort().join(",")}`)
    .sort()
    .join("|")
}

export function isDirty(state: PlacementState): boolean {
  return (
    fleetFingerprint(state.ships) !== fleetFingerprint(state.savedShips) ||
    state.current !== null
  )
}

export function totalRequired(required: Record<number, number>): number {
  return Object.values(required).reduce((sum, n) => sum + n, 0)
}

function withIds(ships: ShipPlacementInput[], from: number): PlacedShip[] {
  return ships.map((ship, i) => ({
    id: `ship-${from + i}`,
    length: ship.length,
    tileIds: [...ship.tileIds],
  }))
}

export function createPlacementState(
  config: PlacementConfig,
  savedShips: ShipPlacementInput[]
): PlacementState {
  const ships = withIds(savedShips, 0)
  return {
    config,
    ships,
    savedShips: savedShips.map((s) => ({ ...s, tileIds: [...s.tileIds] })),
    current: null,
    selectedLength: config.locked
      ? null
      : firstUnplacedLength(config.required, countByLength(ships)),
    selectedShipId: null,
    nextShipId: ships.length,
    message: "",
  }
}

const tiles = (n: number) => `${n}-tile`

export function placementReducer(
  state: PlacementState,
  action: PlacementAction
): PlacementState {
  const { config } = state
  if (config.locked) {
    return {
      ...state,
      message: "Ship placement is locked: the event has started.",
    }
  }

  switch (action.type) {
    case "selectLength": {
      if (state.current && state.current.length !== action.length) {
        return {
          ...state,
          message: "Finish or cancel the current ship before switching length.",
        }
      }
      const placed = countByLength(state.ships)
      if (
        (placed[action.length] ?? 0) >= (config.required[action.length] ?? 0)
      ) {
        return {
          ...state,
          message: `All ${tiles(action.length)} ships are already placed.`,
        }
      }
      return {
        ...state,
        selectedLength: action.length,
        selectedShipId: null,
        message: `Selected a ${tiles(action.length)} ship. Pick its first tile on the board.`,
      }
    }

    case "clickTile":
      return clickTile(state, action.tileId)

    case "cancelCurrent": {
      if (!state.current) return state
      return {
        ...state,
        current: null,
        message: `Cancelled the ${tiles(state.current.length)} ship.`,
      }
    }

    case "removeSelected": {
      const ship = state.ships.find((s) => s.id === state.selectedShipId)
      if (!ship) return state
      return {
        ...state,
        ships: state.ships.filter((s) => s.id !== ship.id),
        selectedShipId: null,
        selectedLength: ship.length,
        message: `Removed the ${tiles(ship.length)} ship. Place it again anywhere.`,
      }
    }

    case "reset":
      return {
        ...state,
        ships: [],
        current: null,
        selectedShipId: null,
        selectedLength: firstUnplacedLength(config.required, {}),
        message: "Removed all ships from the board.",
      }

    case "revert": {
      const ships = withIds(state.savedShips, state.nextShipId)
      return {
        ...state,
        ships,
        nextShipId: state.nextShipId + ships.length,
        current: null,
        selectedShipId: null,
        selectedLength: firstUnplacedLength(
          config.required,
          countByLength(ships)
        ),
        message: "Discarded the unsaved changes.",
      }
    }

    case "markSaved":
      return {
        ...state,
        savedShips: state.ships.map((s) => ({
          length: s.length,
          tileIds: [...s.tileIds],
        })),
        message:
          state.ships.length === 0
            ? "Placement cleared."
            : "Placement saved. Only your team can see these ships.",
      }
  }
}

function clickTile(state: PlacementState, tileId: string): PlacementState {
  const { config } = state
  if (!config.coords.some((c) => c.id === tileId)) {
    return {
      ...state,
      message: "This tile is hidden and cannot hold a ship.",
    }
  }

  const shipHere = state.ships.find((s) => s.tileIds.includes(tileId))
  const current = state.current

  if (!current) {
    // Pick a placed ship (to remove it) or start a new one.
    if (shipHere) {
      if (state.selectedShipId === shipHere.id) {
        return {
          ...state,
          selectedShipId: null,
          message: `Deselected the ${tiles(shipHere.length)} ship.`,
        }
      }
      return {
        ...state,
        selectedShipId: shipHere.id,
        message: `Selected the ${tiles(shipHere.length)} ship. Use Remove ship to take it off the board.`,
      }
    }

    const length = state.selectedLength
    if (length === null) {
      return {
        ...state,
        selectedShipId: null,
        message:
          "All ships are placed. Select a placed ship to remove it, or save the placement.",
      }
    }
    if (config.required[length] === undefined) {
      return { ...state, message: "Select a ship length first." }
    }
    return extend(
      { ...state, selectedShipId: null },
      { length, tileIds: [] },
      tileId
    )
  }

  if (shipHere) {
    return {
      ...state,
      message: "That tile already holds another ship.",
    }
  }

  const index = current.tileIds.indexOf(tileId)
  if (index >= 0) {
    // Clicking a tile of the ship being built takes it and what came after it back.
    const kept = current.tileIds.slice(0, index)
    return {
      ...state,
      current: kept.length === 0 ? null : { ...current, tileIds: kept },
      message:
        kept.length === 0
          ? `Cancelled the ${tiles(current.length)} ship. Pick a starting tile.`
          : `${kept.length} of ${current.length} tiles.`,
    }
  }

  return extend(state, current, tileId)
}

function extend(
  state: PlacementState,
  ship: { length: number; tileIds: string[] },
  tileId: string
): PlacementState {
  const { config } = state
  if (
    ship.tileIds.length > 0 &&
    !canAddTileToShip(tileId, ship.tileIds, config.coords)
  ) {
    return {
      ...state,
      message:
        "A ship is one straight line. Pick the tile right next to either end of it.",
    }
  }

  const tileIds = [...ship.tileIds, tileId]
  if (tileIds.length < ship.length) {
    return {
      ...state,
      current: { length: ship.length, tileIds },
      message: `${tileIds.length} of ${ship.length} tiles. Pick the next tile in the same row or column.`,
    }
  }

  if (!isStraightContiguous(tileIds, config.coords)) {
    return {
      ...state,
      message: "A ship must be a straight line without gaps.",
    }
  }

  const ships = [
    ...state.ships,
    { id: `ship-${state.nextShipId}`, length: ship.length, tileIds },
  ]
  const placed = countByLength(ships)
  const remaining =
    (config.required[ship.length] ?? 0) - (placed[ship.length] ?? 0)
  const nextLength =
    remaining > 0 ? ship.length : firstUnplacedLength(config.required, placed)

  return {
    ...state,
    ships,
    nextShipId: state.nextShipId + 1,
    current: null,
    selectedLength: nextLength,
    message:
      nextLength === null
        ? "All ships are placed. Save the placement to lock it in."
        : `Placed a ${tiles(ship.length)} ship. Next: a ${tiles(nextLength)} ship.`,
  }
}
