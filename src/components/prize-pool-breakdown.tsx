"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { calculateEventPrizePool } from "@/app/actions/events"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import { DollarSign, Trophy, Users, Heart, Loader2 } from "lucide-react"

interface PrizePoolData {
  basePrizePool: number
  totalBuyIns: number
  totalDonations: number
  totalPrizePool: number
}

interface PrizePoolBreakdownProps {
  eventId: string
  className?: string
}

export function PrizePoolBreakdown({ eventId, className }: PrizePoolBreakdownProps) {
  const [prizePoolData, setPrizePoolData] = useState<PrizePoolData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetchPrizePoolData()
  }, [eventId, fetchPrizePoolData])

  const fetchPrizePoolData = async () => {
    setLoading(true)
    try {
      const data = await calculateEventPrizePool(eventId)
      setPrizePoolData(data)
    } catch (error) {
      console.error("Error fetching prize pool data:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex justify-center items-center h-20">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!prizePoolData) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground text-sm">
            Failed to load prize pool data
          </div>
        </CardContent>
      </Card>
    )
  }

  const { basePrizePool, totalBuyIns, totalDonations, totalPrizePool } = prizePoolData

  return (
    <Card className={`${className} border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/50 to-yellow-50/30 dark:from-amber-950/20 dark:to-yellow-950/10`}>
      <CardContent className="p-6">
        {/* Total Prize Pool - More Prominent */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-300">Prize Pool</h3>
          </div>
          <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-1">
            {formatRunescapeGold(totalPrizePool)} GP
          </div>
          <div className="text-sm text-amber-600/70 dark:text-amber-400/70">Total Available</div>
        </div>

        {/* Enhanced Breakdown with Progress Bars */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-2">
            <div className="w-8 h-8 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Base</div>
            <div className="text-sm font-bold">{formatRunescapeGold(basePrizePool)}</div>
            <div className="text-xs text-muted-foreground">
              {totalPrizePool > 0 ? Math.round((basePrizePool / totalPrizePool) * 100) : 0}%
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="w-8 h-8 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-xs font-medium text-green-600 dark:text-green-400">Buy-ins</div>
            <div className="text-sm font-bold">{formatRunescapeGold(totalBuyIns)}</div>
            <div className="text-xs text-muted-foreground">
              {totalPrizePool > 0 ? Math.round((totalBuyIns / totalPrizePool) * 100) : 0}%
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="w-8 h-8 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
              <Heart className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-xs font-medium text-red-600 dark:text-red-400">Donations</div>
            <div className="text-sm font-bold">{formatRunescapeGold(totalDonations)}</div>
            <div className="text-xs text-muted-foreground">
              {totalPrizePool > 0 ? Math.round((totalDonations / totalPrizePool) * 100) : 0}%
            </div>
          </div>
        </div>

        {/* Growth Summary */}
        {(totalBuyIns > 0 || totalDonations > 0) && (
          <div className="text-xs text-center text-muted-foreground pt-2 border-t">
            +{formatRunescapeGold(totalBuyIns + totalDonations)} GP from participants
          </div>
        )}
      </CardContent>
    </Card>
  )
}
