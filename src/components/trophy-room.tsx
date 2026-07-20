import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Medal, Calendar, Flame } from "lucide-react"

interface TrophyRoomProps {
  stats: {
    totalSubmissions: number
  }
  eventsCount: number
}

export function TrophyRoom({ stats, eventsCount }: TrophyRoomProps) {
  const badges = []

  // Logic to determine earned badges
  if (stats.totalSubmissions > 0) {
    badges.push({
      id: "first-blood",
      title: "First Blood",
      description: "Submitted your first item.",
      icon: <Flame className="h-6 w-6 text-orange-500" />
    })
  }

  if (stats.totalSubmissions >= 100) {
    badges.push({
      id: "dedicated",
      title: "Dedicated",
      description: "Achieved 100 total submissions.",
      icon: <Medal className="h-6 w-6 text-yellow-500" />
    })
  }

  if (eventsCount > 0) {
    badges.push({
      id: "participant",
      title: "Event Participant",
      description: `Participated in ${eventsCount} event${eventsCount === 1 ? '' : 's'}.`,
      icon: <Calendar className="h-6 w-6 text-blue-500" />
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Medal className="h-5 w-5" />
          Trophy Room
        </CardTitle>
      </CardHeader>
      <CardContent>
        {badges.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Medal className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p>No badges earned yet. Start submitting!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {badges.map((badge) => (
              <div key={badge.id} className="flex items-center gap-4 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary">
                  {badge.icon}
                </div>
                <div>
                  <h4 className="text-sm font-semibold">{badge.title}</h4>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
