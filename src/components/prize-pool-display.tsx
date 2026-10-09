import { Coins } from "lucide-react"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import { cn } from "@/lib/utils"

interface PrizePoolDisplayProps {
  prizePool: number
  className?: string
  variant?: "default" | "compact" | "badge"
  showIcon?: boolean
}

export function PrizePoolDisplay({
  prizePool,
  className,
  variant = "default",
  showIcon = true,
}: PrizePoolDisplayProps) {
  if (prizePool <= 0) return null

  const formattedPrizePool = formatRunescapeGold(prizePool)

  // Determine text size based on prize pool amount
  const getTextSize = () => {
    if (variant === "compact") return "text-sm"
    if (prizePool >= 1_000_000_000) return "text-lg font-bold" // 1B+
    if (prizePool >= 100_000_000) return "text-base font-semibold" // 100M+
    return "text-sm"
  }

  // Prize Pools of 1M+ read as gold coins; smaller amounts are muted.
  const getTextColor = () => {
    if (prizePool >= 1_000_000) return "text-primary"
    return "text-muted-foreground"
  }

  if (variant === "badge") {
    return (
      <div
        className={cn(
          "osrs-slot inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
          getTextColor(),
          className
        )}
      >
        {showIcon && <Coins aria-hidden="true" className="mr-1 h-3 w-3" />}
        {formattedPrizePool}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        getTextColor(),
        getTextSize(),
        className
      )}
    >
      {showIcon && (
        <Coins
          aria-hidden="true"
          className={cn(
            "shrink-0",
            variant === "compact" ? "h-3.5 w-3.5" : "h-4 w-4"
          )}
        />
      )}
      <span>{formattedPrizePool}</span>
    </div>
  )
}
