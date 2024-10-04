// components/prize-pool-display.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PrizePoolDisplayProps {
  prizePool: number
}

function formatRunescapeGold(amount: number): string {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(1)}B`
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`
  } else {
    return amount.toString()
  }
}

export function PrizePoolDisplay({ prizePool }: PrizePoolDisplayProps) {
  const formattedPrizePool = formatRunescapeGold(prizePool)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prize Pool</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{formattedPrizePool} GP</p>
      </CardContent>
    </Card>
  )
}
