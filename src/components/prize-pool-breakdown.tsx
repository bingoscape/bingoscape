"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { calculateEventPrizePool } from "@/app/actions/events"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import { DollarSign, Trophy, Users, Heart, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface PrizePoolData {
  basePrizePool: number
  totalBuyIns: number
  totalDonations: number
  totalPrizePool: number
}

interface PrizePoolBreakdownProps {
  eventId: string
  className?: string
  /** Server-fetched data. When given, nothing is fetched on the client. */
  initialData?: PrizePoolData
}

export function PrizePoolBreakdown({
  eventId,
  className,
  initialData,
}: PrizePoolBreakdownProps) {
  // The last fetch and the Event it was for; no entry for the current Event
  // means it is still loading.
  const [fetched, setFetched] = useState<{
    eventId: string
    data: PrizePoolData | null
  } | null>(null)
  // Server data (fresh on every refresh) wins over anything fetched here.
  const prizePoolData = initialData ?? fetched?.data ?? null
  const loading = !initialData && fetched?.eventId !== eventId

  useEffect(() => {
    if (initialData) return
    let cancelled = false
    calculateEventPrizePool(eventId)
      .then((data) => {
        if (!cancelled) setFetched({ eventId, data })
      })
      .catch((error) => {
        console.error("Error fetching prize pool data:", error)
        if (!cancelled) {
          setFetched((prev) => ({ eventId, data: prev?.data ?? null }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [eventId, initialData])

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex h-20 items-center justify-center">
            <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!prizePoolData) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="text-center text-sm text-muted-foreground">
            Failed to load prize pool data
          </div>
        </CardContent>
      </Card>
    )
  }

  const { basePrizePool, totalBuyIns, totalDonations, totalPrizePool } =
    prizePoolData

  return (
    <Card className={cn("border-primary/40", className)}>
      <CardContent className="p-6">
        {/* Total Prize Pool - More Prominent */}
        <div className="mb-6 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Trophy aria-hidden="true" className="h-6 w-6 text-primary" />
            <h3 className="osrs-heading text-lg font-semibold">Prize Pool</h3>
          </div>
          <div className="osrs-panel-inset mx-auto mb-1 w-fit px-4 py-1 font-display text-3xl font-bold text-primary">
            {formatRunescapeGold(totalPrizePool)} GP
          </div>
          <div className="text-sm text-muted-foreground">
            Total Available
          </div>
        </div>

        {/* Enhanced Breakdown with Progress Bars */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-2">
            <div className="osrs-slot mx-auto flex h-8 w-8 items-center justify-center rounded-sm">
              <DollarSign aria-hidden="true" className="h-4 w-4 text-pending" />
            </div>
            <div className="text-xs font-medium text-pending">
              Base
            </div>
            <div className="text-sm font-bold">
              {formatRunescapeGold(basePrizePool)}
            </div>
            <div className="text-xs text-muted-foreground">
              {totalPrizePool > 0
                ? Math.round((basePrizePool / totalPrizePool) * 100)
                : 0}
              %
            </div>
          </div>

          <div className="space-y-2">
            <div className="osrs-slot mx-auto flex h-8 w-8 items-center justify-center rounded-sm">
              <Users aria-hidden="true" className="h-4 w-4 text-success" />
            </div>
            <div className="text-xs font-medium text-success">
              Buy-Ins
            </div>
            <div className="text-sm font-bold">
              {formatRunescapeGold(totalBuyIns)}
            </div>
            <div className="text-xs text-muted-foreground">
              {totalPrizePool > 0
                ? Math.round((totalBuyIns / totalPrizePool) * 100)
                : 0}
              %
            </div>
          </div>

          <div className="space-y-2">
            <div className="osrs-slot mx-auto flex h-8 w-8 items-center justify-center rounded-sm">
              <Heart aria-hidden="true" className="h-4 w-4 text-danger" />
            </div>
            <div className="text-xs font-medium text-danger">
              Donations
            </div>
            <div className="text-sm font-bold">
              {formatRunescapeGold(totalDonations)}
            </div>
            <div className="text-xs text-muted-foreground">
              {totalPrizePool > 0
                ? Math.round((totalDonations / totalPrizePool) * 100)
                : 0}
              %
            </div>
          </div>
        </div>

        {/* Growth Summary */}
        {(totalBuyIns > 0 || totalDonations > 0) && (
          <div className="mt-4 border-t pt-2 text-center text-xs text-muted-foreground">
            +{formatRunescapeGold(totalBuyIns + totalDonations)} GP from
            participants
          </div>
        )}
      </CardContent>
    </Card>
  )
}
