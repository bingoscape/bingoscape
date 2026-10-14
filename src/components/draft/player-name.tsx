import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { DraftPlayerInfo } from "@/lib/draft/types"
import { playerLabel, ratingPoints } from "@/lib/draft/view"
import { cn } from "@/lib/utils"

interface PlayerNameProps {
  info: DraftPlayerInfo | undefined
  className?: string
}

/** Avatar and display name of a player in the draft room. */
export function PlayerName({ info, className }: PlayerNameProps) {
  const label = playerLabel(info)
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Avatar className="h-6 w-6">
        {info?.image && <AvatarImage src={info.image} alt="" />}
        <AvatarFallback className="text-[10px]">
          {label.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{label}</span>
    </span>
  )
}

/** The rating out of 100, or "Unrated" for a player without Wise Old Man data. */
export function RatingBadge({ rating }: { rating: number | null }) {
  const points = ratingPoints(rating)
  return points === null ? (
    <Badge variant="outline" className="text-muted-foreground">
      Unrated
    </Badge>
  ) : (
    <Badge variant="secondary" title="Rating out of 100">
      {points}
    </Badge>
  )
}
