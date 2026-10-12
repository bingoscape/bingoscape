"use client"

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react"
import { Ship, TriangleAlert } from "lucide-react"

import { saveTeamShipPlacements } from "@/app/actions/battleship"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { FleetPalette } from "@/components/ship-placement/fleet-palette"
import {
  ShipPlacementBoard,
  type PlacementTile,
} from "@/components/ship-placement/ship-placement-board"
import AlertBanner from "@/components/ui/alert-banner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { aggregateShipRuleCounts } from "@/lib/ship-rules"
import {
  indexToCoord,
  type ShipPlacementInput,
  type TileCoord,
} from "@/lib/ship-placement"
import {
  countByLength,
  createPlacementState,
  isDirty,
  isFleetComplete,
  placementReducer,
  totalRequired,
} from "@/lib/ship-placement-state"
import type { ShipRule } from "@/server/db/schema"

interface ShipPlacementClientProps {
  bingoId: string
  teamId: string
  teamName: string
  rows: number
  columns: number
  tiles: PlacementTile[]
  rules: ShipRule[]
  /** The fleet the server holds for this team. */
  savedShips: ShipPlacementInput[]
  /** The event has started: the fleet is frozen. */
  locked: boolean
}

type Confirmation = "reset" | "clear" | "revert" | null

/**
 * Draft fleet of one team. The draft lives in a reducer; nothing reaches the
 * server before "Save placement", which is blocked while a save is running.
 */
export function ShipPlacementClient({
  bingoId,
  teamId,
  teamName,
  rows,
  columns,
  tiles,
  rules,
  savedShips,
  locked,
}: ShipPlacementClientProps) {
  const required = useMemo(() => aggregateShipRuleCounts(rules), [rules])
  const coords: TileCoord[] = useMemo(
    () =>
      tiles
        .filter((t) => !t.isHidden)
        .map((t) => ({ id: t.id, ...indexToCoord(t.index, columns) })),
    [tiles, columns]
  )

  const [state, dispatch] = useReducer(
    placementReducer,
    { coords, required, locked },
    (config) => createPlacementState(config, savedShips)
  )
  const [confirm, setConfirm] = useState<Confirmation>(null)
  const [isSaving, startSaving] = useTransition()
  // A second click can arrive before React re-renders with isSaving.
  const saveInFlight = useRef(false)

  const placed = countByLength(state.ships)
  const complete = isFleetComplete(required, placed)
  const dirty = isDirty(state)
  const needed = totalRequired(required)
  const canSave =
    !locked && !isSaving && state.current === null && dirty && complete
  const busy = locked || isSaving

  // Unsaved ships are lost when the page is left.
  useEffect(() => {
    if (!dirty || locked) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty, locked])

  /**
   * Saves `fleet` (an empty one clears the placement). One save at a time:
   * the button is disabled while saving, and the ref covers a second click
   * that arrives before React has re-rendered.
   */
  const persist = (fleet: ShipPlacementInput[], onSaved?: () => void) => {
    if (saveInFlight.current || locked) return
    saveInFlight.current = true
    const clearing = fleet.length === 0
    startSaving(async () => {
      try {
        const result = await saveTeamShipPlacements(bingoId, teamId, fleet)
        if (!result.success) {
          toast({
            title: clearing
              ? "Could not clear the placement"
              : "Could not save the ships",
            description: result.error ?? "Failed to save the ships",
            variant: "destructive",
          })
          return
        }
        onSaved?.()
        dispatch({ type: "markSaved" })
        toast({
          title: clearing ? "Placement cleared" : "Ships saved",
          description: clearing
            ? `${teamName} has no ships placed.`
            : `${teamName}'s fleet is saved. Only ${teamName} can see it.`,
        })
      } catch {
        toast({
          title: "Could not save the ships",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        })
      } finally {
        saveInFlight.current = false
      }
    })
  }

  const save = () =>
    persist(
      state.ships.map((ship) => ({
        length: ship.length,
        tileIds: ship.tileIds,
      }))
    )

  const confirmCopy = {
    reset: {
      title: "Remove all ships?",
      description:
        "This takes every ship off the board. Nothing is saved until you press Save placement.",
      confirmLabel: "Remove all ships",
    },
    revert: {
      title: "Discard unsaved changes?",
      description:
        "The board goes back to the last saved placement. Your changes are lost.",
      confirmLabel: "Discard changes",
    },
    clear: {
      title: "Clear the saved placement?",
      description: `This deletes the saved fleet of ${teamName} right away. You can place the ships again until the event starts.`,
      confirmLabel: "Clear placement",
    },
  } as const

  const runConfirmed = () => {
    if (confirm === "reset") dispatch({ type: "reset" })
    else if (confirm === "revert") dispatch({ type: "revert" })
    else if (confirm === "clear") {
      // The board is emptied once the server has cleared the placement.
      persist([], () => dispatch({ type: "reset" }))
    }
  }

  const hint = locked
    ? ""
    : state.message ||
      (state.selectedLength === null
        ? "All ships are placed."
        : `Pick the first tile of a ${state.selectedLength}-tile ship on the board.`)

  const selectedShip = state.ships.find((s) => s.id === state.selectedShipId)

  return (
    <div className="space-y-4">
      {locked && (
        <AlertBanner
          icon={<TriangleAlert className="size-5" />}
          message="Ship placement is locked: the event has started. Ships can no longer be changed."
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
        <section
          aria-label="Fleet"
          className="osrs-panel h-fit space-y-4 rounded-sm p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="osrs-heading flex items-center gap-2 text-lg">
              <Ship aria-hidden="true" className="size-5" />
              Your fleet
            </h2>
            {!locked && (
              <Badge variant={dirty ? "pending" : "success"}>
                {dirty ? "Unsaved changes" : "Saved"}
              </Badge>
            )}
          </div>

          <p className="text-muted-foreground text-sm">
            {state.ships.length} of {needed} {needed === 1 ? "ship" : "ships"}{" "}
            placed.{" "}
            {locked
              ? ""
              : "Pick a length, then click tiles in one row or column."}
          </p>

          <FleetPalette
            required={required}
            placed={placed}
            selectedLength={state.selectedLength}
            buildingLength={state.current?.length ?? null}
            disabled={busy}
            onSelect={(length) => dispatch({ type: "selectLength", length })}
          />

          <p
            role="status"
            aria-live="polite"
            className="text-foreground min-h-10 text-sm"
          >
            {hint}
          </p>

          {!locked && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={!canSave} onClick={save}>
                {isSaving ? "Saving…" : "Save placement"}
              </Button>
              {state.current && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => dispatch({ type: "cancelCurrent" })}
                >
                  Cancel ship
                </Button>
              )}
              {selectedShip && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => dispatch({ type: "removeSelected" })}
                >
                  Remove ship
                </Button>
              )}
              {dirty && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirm("revert")}
                >
                  Discard changes
                </Button>
              )}
              {(state.ships.length > 0 || state.current) && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirm("reset")}
                >
                  Reset
                </Button>
              )}
              {state.savedShips.length > 0 && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setConfirm("clear")}
                >
                  Clear placement
                </Button>
              )}
            </div>
          )}
          {!locked && !complete && dirty && state.current === null && (
            <p className="text-muted-foreground text-xs">
              Place all {needed} {needed === 1 ? "ship" : "ships"} to save.
            </p>
          )}
        </section>

        <div className="min-w-0 lg:h-[min(72dvh,760px)]">
          <ShipPlacementBoard
            tiles={tiles}
            rows={rows}
            columns={columns}
            ships={state.ships}
            current={state.current}
            selectedShipId={state.selectedShipId}
            locked={locked || isSaving}
            onActivate={(tileId) => dispatch({ type: "clickTile", tileId })}
            onEscape={() => dispatch({ type: "cancelCurrent" })}
          />
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirm(null)
          }}
          title={confirmCopy[confirm].title}
          description={confirmCopy[confirm].description}
          confirmLabel={confirmCopy[confirm].confirmLabel}
          variant={confirm === "clear" ? "destructive" : "default"}
          onConfirm={runConfirmed}
        />
      )}
    </div>
  )
}
