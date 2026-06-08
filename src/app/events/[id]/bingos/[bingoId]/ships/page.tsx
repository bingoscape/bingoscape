"use client"

import { use, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import type { UUID } from "crypto"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import { BattleshipPlacementGrid } from "@/components/battleship-placement-grid"
import {
  getBingoShipRules,
  getTeamShipPlacements,
  saveTeamShipPlacements,
  type ShipPlacement,
} from "@/app/actions/battleship"
import {
  canAddTileToShip,
  isStraightContiguous,
  indexToCoord,
  type TileCoord,
} from "@/lib/ship-placement"
import { isEventActive } from "@/lib/event-status"
import { aggregateShipRuleCounts } from "@/lib/ship-rules"
import {
  buildLengthColorMap,
  firstUnplacedLength,
} from "@/lib/ship-length-colors"
import { cn } from "@/lib/utils"
import { getEventById } from "@/app/actions/events"
import { getCurrentTeamForUser } from "@/app/actions/team"
import type { Bingo, Tile } from "@/app/actions/events"
import type { ShipRule } from "@/server/db/schema"

export default function ShipPlacementPage(props: {
  params: Promise<{ id: UUID; bingoId: string }>
  searchParams: Promise<{ teamId?: string }>
}) {
  const params = use(props.params)
  const searchParams = use(props.searchParams)
  const { id: eventId, bingoId } = params
  const router = useRouter()
  const { data: session } = useSession()

  const [loading, setLoading] = useState(true)
  const [bingo, setBingo] = useState<Bingo | null>(null)
  const [teamId, setTeamId] = useState<string | undefined>(
    searchParams.teamId
  )
  const [teamName, setTeamName] = useState("")
  const [rules, setRules] = useState<ShipRule[]>([])
  const [ships, setShips] = useState<ShipPlacement[]>([])
  const [selectedLength, setSelectedLength] = useState<number | null>(null)
  const [currentShip, setCurrentShip] = useState<{
    length: number
    tileIds: string[]
  } | null>(null)
  const [shipPlacementLocked, setShipPlacementLocked] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const placeableTiles = useMemo(
    () => (bingo?.tiles ?? []).filter((t) => !t.isHidden),
    [bingo?.tiles]
  )

  const tileCoords: TileCoord[] = useMemo(() => {
    if (!bingo) return []
    return placeableTiles.map((t) => {
      const { col, row } = indexToCoord(t.index, bingo.columns)
      return { id: t.id, col, row }
    })
  }, [placeableTiles, bingo])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [eventData, currentTeam] = await Promise.all([
          getEventById(eventId),
          getCurrentTeamForUser(eventId),
        ])

        if (!eventData) {
          router.push(`/events/${eventId}`)
          return
        }

        const foundBingo = eventData.event.bingos?.find(
          (b: Bingo) => b.id === bingoId
        )
        if (!foundBingo || foundBingo.bingoType !== "battleship") {
          router.push(`/events/${eventId}/bingos/${bingoId}`)
          return
        }

        const isBoardCreator = Boolean(
          session?.user?.id &&
            eventData.event.creatorId &&
            session.user.id === eventData.event.creatorId
        )
        const isEventAdminOrManagement =
          eventData.userRole === "admin" ||
          eventData.userRole === "management"
        const isTeamLeader = Boolean(currentTeam?.isLeader)

        const effectiveTeamId = searchParams.teamId ?? currentTeam?.id
        if (!effectiveTeamId) {
          setError("You must be on a team to place ships")
          return
        }

        if (!isBoardCreator && !isEventAdminOrManagement && !isTeamLeader) {
          setError(
            "Only team leaders, event admins, or board creator can manage ship placement"
          )
          return
        }

        if (
          !isBoardCreator &&
          !isEventAdminOrManagement &&
          effectiveTeamId !== currentTeam?.id
        ) {
          setError("You can only manage ship placement for your own team")
          return
        }

        const team = eventData.event.teams?.find(
          (t: { id: string; name: string }) => t.id === effectiveTeamId
        )
        if (!team) {
          setError("Team not found in this event")
          return
        }
        const eventIsActive = isEventActive(
          eventData.event.startDate,
          eventData.event.endDate
        )
        const eventIsCompleted = new Date() > new Date(eventData.event.endDate)
        const placementLocked = eventIsActive || eventIsCompleted

        setBingo(foundBingo)
        setTeamId(effectiveTeamId)
        setTeamName(team?.name ?? "Team")
        setShipPlacementLocked(placementLocked)
        if (placementLocked) {
          setMessage("Ship placement is only allowed before the event starts")
        }

        const [shipRules, existingShips] = await Promise.all([
          getBingoShipRules(bingoId),
          getTeamShipPlacements(bingoId, effectiveTeamId),
        ])

        setRules(shipRules)
        if (!existingShips.success) {
          setError(existingShips.error ?? "Failed to load existing ship placement")
          return
        }
        if (existingShips.ships) {
          setShips(existingShips.ships)
        }
      } catch (e) {
        console.error(e)
        setError("Failed to load ship placement")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [eventId, bingoId, searchParams.teamId, router, session?.user?.id])

  const placedTileIds = useMemo(() => {
    const ids = new Set<string>()
    for (const s of ships) {
      s.tileIds.forEach((t) => ids.add(t))
    }
    return ids
  }, [ships])

  const savedTileLengths = useMemo(() => {
    const map = new Map<string, number>()
    for (const ship of ships) {
      for (const tileId of ship.tileIds) {
        map.set(tileId, ship.length)
      }
    }
    return map
  }, [ships])

  const placedCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const s of ships) {
      counts[s.length] = (counts[s.length] ?? 0) + 1
    }
    return counts
  }, [ships])

  const requiredCounts = useMemo(
    () => aggregateShipRuleCounts(rules),
    [rules]
  )

  const lengthColors = useMemo(
    () => buildLengthColorMap(Object.keys(requiredCounts).map(Number)),
    [requiredCounts]
  )

  useEffect(() => {
    if (shipPlacementLocked || currentShip) return
    const next = firstUnplacedLength(requiredCounts, placedCounts)
    setSelectedLength((prev) => {
      if (prev !== null) {
        const required = requiredCounts[prev] ?? 0
        const placed = placedCounts[prev] ?? 0
        if (placed < required) return prev
      }
      return next
    })
  }, [requiredCounts, placedCounts, shipPlacementLocked, currentShip])

  const placementComplete = useMemo(() => {
    for (const [length, count] of Object.entries(requiredCounts)) {
      if ((placedCounts[Number(length)] ?? 0) !== count) {
        return false
      }
    }
    return Object.keys(requiredCounts).length > 0
  }, [requiredCounts, placedCounts])

  const canSave =
    !shipPlacementLocked &&
    !currentShip &&
    (placementComplete || ships.length === 0)

  const selectLength = (length: number) => {
    if (shipPlacementLocked) return
    if (currentShip && currentShip.length !== length) {
      setMessage("Cancel the current ship before switching length")
      return
    }
    const required = requiredCounts[length] ?? 0
    const placed = placedCounts[length] ?? 0
    if (placed >= required) return
    setSelectedLength(length)
    setError("")
    setMessage(`Selected length ${length} ship — click tiles on the grid`)
  }

  const onSelect = (tile: Tile) => {
    if (!bingo) return
    if (shipPlacementLocked) {
      setError("Ship placement is only allowed before the event starts")
      return
    }
    setError("")

    if (placedTileIds.has(tile.id)) {
      setMessage("This tile is already part of a saved ship")
      return
    }

    let ship = currentShip
    if (!ship) {
      if (selectedLength === null) {
        setMessage("Select a ship length to place")
        return
      }
      const required = requiredCounts[selectedLength] ?? 0
      const placed = placedCounts[selectedLength] ?? 0
      if (placed >= required) {
        setMessage(`All length-${selectedLength} ships are already placed`)
        return
      }
      ship = { length: selectedLength, tileIds: [] }
    }

    const existingIdx = ship.tileIds.indexOf(tile.id)
    if (existingIdx >= 0) {
      const nextIds = ship.tileIds.slice(0, existingIdx)
      if (nextIds.length === 0) {
        setCurrentShip(null)
        setMessage("Cancelled current ship — pick a starting tile")
      } else {
        setCurrentShip({ ...ship, tileIds: nextIds })
        setMessage(
          `Removed tile — ${nextIds.length}/${ship.length} selected (click again to undo)`
        )
      }
      return
    }

    if (ship.tileIds.length >= ship.length) {
      setMessage(`Current ship is full (${ship.length} tiles)`)
      return
    }

    if (!canAddTileToShip(tile.id, ship.tileIds, tileCoords)) {
      setMessage(
        "Extend the ship from either end — same row or column, no gaps"
      )
      return
    }

    const nextIds = [...ship.tileIds, tile.id]
    const next = { ...ship, tileIds: nextIds }

    if (next.tileIds.length === next.length) {
      if (!isStraightContiguous(next.tileIds, tileCoords)) {
        setMessage("Ship must be a straight contiguous line")
        return
      }
      setShips([...ships, next])
      setCurrentShip(null)
      const remaining = (placedCounts[next.length] ?? 0) + 1
      const required = requiredCounts[next.length] ?? 0
      if (remaining < required) {
        setSelectedLength(next.length)
        setMessage(
          `Placed length ${next.length} ship — place another (${remaining}/${required})`
        )
      } else {
        const nextLength = firstUnplacedLength(
          requiredCounts,
          { ...placedCounts, [next.length]: remaining }
        )
        setSelectedLength(nextLength)
        setMessage(
          nextLength
            ? `Placed length ${next.length} ship — select length ${nextLength} next`
            : "All ships placed. Save or reset to start over."
        )
      }
    } else {
      setCurrentShip(next)
      setMessage(
        `Selected ${next.tileIds.length}/${next.length} — must stay in one straight line`
      )
    }
  }

  const save = async () => {
    if (!teamId) return
    if (isSaving) return
    if (shipPlacementLocked) {
      setError("Ship placement is only allowed before the event starts")
      return
    }
    if (currentShip) {
      setError("Finish or cancel the ship you are placing first")
      return
    }
    setError("")
    setIsSaving(true)
    try {
      const result = await saveTeamShipPlacements(bingoId, teamId, ships)
      if (result.success) {
        toast({
          title: ships.length === 0 ? "Ships cleared" : "Ships saved",
          description:
            ships.length === 0
              ? "Your team's ship placement has been removed."
              : "Your ship placement is hidden from opponents.",
        })
        setMessage(
          ships.length === 0
            ? "Ship placement cleared"
            : "Ships saved (hidden from opponents)"
        )
      } else {
        setError(result.error ?? "Failed to save")
      }
    } finally {
      setIsSaving(false)
    }
  }

  const reset = () => {
    if (shipPlacementLocked) return
    setShips([])
    setCurrentShip(null)
    setSelectedLength(firstUnplacedLength(requiredCounts, {}))
    setMessage("Reset all ships")
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="aspect-square max-w-lg" />
      </div>
    )
  }

  if (!bingo || !teamId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-destructive">{error || "Unable to load placement"}</p>
        <Button asChild variant="link" className="mt-4 px-0">
          <Link href={`/events/${eventId}/bingos/${bingoId}`}>Back to board</Link>
        </Button>
      </div>
    )
  }

  const sortedTiles = [...placeableTiles].sort((a, b) => a.index - b.index)

  return (
    <div className="container mx-auto px-4 py-4 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/events/${eventId}/bingos/${bingoId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Place ships — {teamName}</h1>
      </div>

      <p className="text-muted-foreground mb-4">
        Select a ship length, then place it in one straight line (horizontal or
        vertical) with no gaps. Click a selected tile again to undo.
      </p>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">Your fleet</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tap a ship size below, then place it on the grid in one straight
            line.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(requiredCounts)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([lengthStr, count]) => {
                const length = Number(lengthStr)
                const placed = placedCounts[length] ?? 0
                const isComplete = placed >= count
                const isActivePlacement =
                  currentShip !== null && currentShip.length === length
                const isSelected = selectedLength === length || isActivePlacement
                const colors = lengthColors.get(length)
                const isDisabled =
                  shipPlacementLocked ||
                  isComplete ||
                  (currentShip !== null && currentShip.length !== length)
                return (
                  <button
                    key={length}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectLength(length)}
                    className={cn(
                      "rounded-full transition-opacity",
                      isDisabled && "cursor-not-allowed opacity-60",
                      !isDisabled && "hover:opacity-90"
                    )}
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "pointer-events-none border px-3 py-1 text-sm",
                        colors?.badge,
                        isSelected && colors?.badgeSelected
                      )}
                    >
                      {length} tiles · {placed}/{count} placed
                    </Badge>
                  </button>
                )
              })}
          </div>
          {currentShip && (
            <p className="text-sm">
              Placing {currentShip.length}-tile ship:{" "}
              {currentShip.tileIds.length}/{currentShip.length} tiles selected
            </p>
          )}
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!canSave && !shipPlacementLocked && !currentShip && ships.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Place all required ships before saving.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={save}
              disabled={!canSave || isSaving}
            >
              {ships.length === 0 ? "Clear placement" : "Save placement"}
            </Button>
            {currentShip && (
              <Button
                type="button"
                variant="outline"
                disabled={shipPlacementLocked}
                onClick={() => {
                  setCurrentShip(null)
                  setMessage("Cancelled current ship")
                }}
              >
                Cancel current ship
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              disabled={shipPlacementLocked}
            >
              Reset all
            </Button>
          </div>
        </CardContent>
      </Card>

      <BattleshipPlacementGrid
        tiles={sortedTiles}
        columns={bingo.columns}
        savedTileLengths={savedTileLengths}
        currentShipTileIds={new Set(currentShip?.tileIds ?? [])}
        currentShipLength={currentShip?.length ?? selectedLength}
        lengthColors={lengthColors}
        onSelect={onSelect}
        disabled={shipPlacementLocked}
      />
    </div>
  )
}
