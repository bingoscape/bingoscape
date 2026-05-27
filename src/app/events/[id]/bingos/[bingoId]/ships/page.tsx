"use client"

import { use, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { UUID } from "crypto"
import { ArrowLeft } from "lucide-react"
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

  const [loading, setLoading] = useState(true)
  const [bingo, setBingo] = useState<Bingo | null>(null)
  const [teamId, setTeamId] = useState<string | undefined>(
    searchParams.teamId
  )
  const [teamName, setTeamName] = useState("")
  const [rules, setRules] = useState<ShipRule[]>([])
  const [ships, setShips] = useState<ShipPlacement[]>([])
  const [currentShip, setCurrentShip] = useState<{
    length: number
    tileIds: string[]
  } | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const tileCoords: TileCoord[] = useMemo(() => {
    if (!bingo?.tiles) return []
    return bingo.tiles.map((t) => {
      const { col, row } = indexToCoord(t.index, bingo.columns)
      return { id: t.id, col, row }
    })
  }, [bingo])

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

        const effectiveTeamId = searchParams.teamId ?? currentTeam?.id
        if (!effectiveTeamId) {
          setError("You must be on a team to place ships")
          return
        }

        const team = eventData.event.teams?.find(
          (t: { id: string; name: string }) => t.id === effectiveTeamId
        )
        setBingo(foundBingo)
        setTeamId(effectiveTeamId)
        setTeamName(team?.name ?? "Team")

        const [shipRules, existingShips] = await Promise.all([
          getBingoShipRules(bingoId),
          getTeamShipPlacements(bingoId, effectiveTeamId),
        ])

        setRules(shipRules)
        if (existingShips.success && existingShips.ships) {
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
  }, [eventId, bingoId, searchParams.teamId, router])

  const placedTileIds = useMemo(() => {
    const ids = new Set<string>()
    for (const s of ships) {
      s.tileIds.forEach((t) => ids.add(t))
    }
    return ids
  }, [ships])

  const placedCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const s of ships) {
      counts[s.length] = (counts[s.length] ?? 0) + 1
    }
    return counts
  }, [ships])

  const nextRule = (): ShipRule | null => {
    for (const r of rules) {
      if ((placedCounts[r.length] ?? 0) < r.count) return r
    }
    return null
  }

  const onSelect = (tile: Tile) => {
    if (!bingo) return
    setError("")

    if (placedTileIds.has(tile.id)) {
      setMessage("This tile is already part of a saved ship")
      return
    }

    let ship = currentShip
    if (!ship) {
      const rule = nextRule()
      if (!rule) {
        setMessage("All ships placed. Save or reset to start over.")
        return
      }
      ship = { length: rule.length, tileIds: [] }
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
      setMessage(`Placed ship of length ${next.length}`)
    } else {
      setCurrentShip(next)
      setMessage(
        `Selected ${next.tileIds.length}/${next.length} — must stay in one straight line`
      )
    }
  }

  const save = async () => {
    if (!teamId) return
    if (currentShip) {
      setError("Finish or cancel the ship you are placing first")
      return
    }
    setError("")
    const result = await saveTeamShipPlacements(bingoId, teamId, ships)
    if (result.success) {
      toast({
        title: "Ships saved",
        description: "Your ship placement is hidden from opponents.",
      })
      setMessage("Ships saved (hidden from opponents)")
    } else {
      setError(result.error ?? "Failed to save")
    }
  }

  const reset = () => {
    setShips([])
    setCurrentShip(null)
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

  const sortedTiles = [...(bingo.tiles ?? [])].sort((a, b) => a.index - b.index)

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
        Place ships in one straight line (horizontal or vertical) with no gaps.
        Click a selected tile again to undo.
      </p>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">Ship rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="text-sm space-y-1">
            {rules.map((r, i) => (
              <li key={i}>
                {r.count}× length {r.length} — placed{" "}
                {placedCounts[r.length] ?? 0}/{r.count}
              </li>
            ))}
          </ul>
          {currentShip && (
            <p className="text-sm">
              Placing length {currentShip.length} ship:{" "}
              {currentShip.tileIds.length}/{currentShip.length} tiles
            </p>
          )}
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={save}>
              Save placement
            </Button>
            {currentShip && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCurrentShip(null)
                  setMessage("Cancelled current ship")
                }}
              >
                Cancel current ship
              </Button>
            )}
            <Button type="button" variant="outline" onClick={reset}>
              Reset all
            </Button>
          </div>
        </CardContent>
      </Card>

      <BattleshipPlacementGrid
        tiles={sortedTiles}
        columns={bingo.columns}
        rows={bingo.rows}
        savedShipTileIds={placedTileIds}
        currentShipTileIds={new Set(currentShip?.tileIds ?? [])}
        onSelect={onSelect}
      />
    </div>
  )
}
