import { Badge } from "@/components/ui/badge"

interface GameTypeBadgeProps {
  gameType: "osrs" | "rs3"
  className?: string
}

export function GameTypeBadge({ gameType, className }: GameTypeBadgeProps) {
  const isOSRS = gameType === "osrs"

  return (
    <Badge variant={isOSRS ? "default" : "secondary"} className={className}>
      {isOSRS ? "OSRS" : "RS3"}
    </Badge>
  )
}
