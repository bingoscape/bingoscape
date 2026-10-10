import Link from "next/link"
import { Coins, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PrizePoolBreakdown } from "@/components/prize-pool-breakdown"
import formatRunescapeGold from "@/lib/formatRunescapeGold"

interface PrizePanelProps {
  eventId: string
  prizePool: {
    basePrizePool: number
    totalBuyIns: number
    totalDonations: number
    totalPrizePool: number
  }
  minimumBuyIn: number
  /** admin / management: link to buy-ins and donations. */
  isManagement: boolean
  readOnly?: boolean
}

/** Prize pool breakdown, minimum buy-in and (for managers) the donations entry. */
export function PrizePanel({
  eventId,
  prizePool,
  minimumBuyIn,
  isManagement,
  readOnly = false,
}: PrizePanelProps) {
  if (readOnly) {
    // Public view: only the base prize pool and the minimum buy-in, as before.
    return (
      <div className="space-y-3 text-sm">
        <div className="osrs-panel-inset flex items-center justify-between rounded-sm px-3 py-2">
          <span className="text-muted-foreground">Prize pool</span>
          <span className="font-display text-lg text-primary">
            {formatRunescapeGold(prizePool.basePrizePool)} GP
          </span>
        </div>
        {minimumBuyIn > 0 && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Coins aria-hidden="true" className="h-4 w-4" />
            Minimum buy-in:{" "}
            <span className="font-medium text-foreground">
              {formatRunescapeGold(minimumBuyIn)} GP
            </span>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <PrizePoolBreakdown eventId={eventId} initialData={prizePool} />

      {minimumBuyIn > 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coins aria-hidden="true" className="h-4 w-4" />
          Minimum buy-in:{" "}
          <span className="font-medium text-foreground">
            {formatRunescapeGold(minimumBuyIn)} GP
          </span>
        </p>
      )}

      {isManagement && !readOnly && (
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/events/${eventId}/participants`}>
            <Users aria-hidden="true" className="mr-2 h-4 w-4" />
            Manage buy-ins and donations
          </Link>
        </Button>
      )}
    </div>
  )
}
