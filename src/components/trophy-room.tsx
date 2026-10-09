import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Medal, Calendar, Flame } from "lucide-react"
import { cn } from "@/lib/utils"

interface TrophyRoomProps {
  stats: {
    totalSubmissions: number
  }
  eventsCount: number
}

type TrophyTier = "gold" | "silver" | "bronze"

// Fixed medal colours (theme independent) with dark text for AA contrast.
const tierStyles: Record<TrophyTier, string> = {
  gold: "bg-osrs-gold text-osrs-stone-950",
  silver: "bg-[#c0c0c0] text-osrs-stone-950",
  bronze: "bg-[#cd7f32] text-osrs-stone-950",
}

export function TrophyRoom({ stats, eventsCount }: TrophyRoomProps) {
  const badges: {
    id: string
    title: string
    description: string
    tier: TrophyTier
    icon: React.ReactNode
  }[] = []

  // Logic to determine earned badges
  if (stats.totalSubmissions > 0) {
    badges.push({
      id: "first-blood",
      title: "First Blood",
      description: "Submitted your first item.",
      tier: "bronze",
      icon: <Flame aria-hidden="true" className="h-6 w-6" />,
    })
  }

  if (stats.totalSubmissions >= 100) {
    badges.push({
      id: "dedicated",
      title: "Dedicated",
      description: "Achieved 100 total Submissions.",
      tier: "gold",
      icon: <Medal aria-hidden="true" className="h-6 w-6" />,
    })
  }

  if (eventsCount > 0) {
    badges.push({
      id: "participant",
      title: "Event Participant",
      description: `Participated in ${eventsCount} Event${eventsCount === 1 ? "" : "s"}.`,
      tier: "silver",
      icon: <Calendar aria-hidden="true" className="h-6 w-6" />,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Medal aria-hidden="true" className="h-5 w-5 text-primary" />
          Trophy Room
        </CardTitle>
      </CardHeader>
      <CardContent>
        {badges.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <Medal
              aria-hidden="true"
              className="mx-auto mb-2 h-10 w-10 opacity-40"
            />
            <p>No badges earned yet. Start submitting!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="osrs-slot flex items-center gap-4 rounded-sm p-4"
              >
                <div
                  className={cn(
                    "osrs-bevel flex h-12 w-12 shrink-0 items-center justify-center rounded-sm",
                    tierStyles[badge.tier]
                  )}
                >
                  {badge.icon}
                </div>
                <div>
                  <h4 className="text-sm font-semibold">{badge.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {badge.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
