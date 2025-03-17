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
    if (prizePool >= 1000000000) return "text-lg font-bold" // 1B+
    if (prizePool >= 100000000) return "text-base font-semibold" // 100M+
    return "text-sm"
  }

  // Determine color based on prize pool amount
  const getTextColor = () => {
    if (prizePool >= 1000000000) return "text-amber-500 dark:text-amber-400" // 1B+
    if (prizePool >= 100000000) return "text-amber-500 dark:text-amber-400" // 100M+
    if (prizePool >= 10000000) return "text-amber-500 dark:text-amber-400" // 10M+
    if (prizePool >= 1000000) return "text-amber-500 dark:text-amber-400" // 1M+
    return "text-muted-foreground"
  }

  if (variant === "badge") {
    return (
      <div
        className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30",
          getTextColor(),
          className,
        )}
      >
        {showIcon && <Coins className="h-3 w-3 mr-1" />}
        {formattedPrizePool}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-1", getTextColor(), getTextSize(), className)}>
      {showIcon && <Coins className={cn("flex-shrink-0", variant === "compact" ? "h-3.5 w-3.5" : "h-4 w-4")} />}
      <span>{formattedPrizePool}</span>
    </div>
  )
}

