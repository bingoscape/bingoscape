import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { User, Swords, ArrowUpCircle, Trophy } from "lucide-react"
import { InlineRsnEditor } from "./inline-rsn-editor"

interface PlayerCardProps {
  user: {
    id: string
    name: string | null
    image: string | null
    runescapeName: string | null
  }
  metadata: {
    combatLevel: number | null
    totalLevel: number | null
    skillLevel: string | null
  } | null
  totalSubmissions: number
}

export function PlayerCard({ user, metadata, totalSubmissions }: PlayerCardProps) {
  // Simple "Rank" calculation for gamification based on submission count
  const calculateRank = (subs: number) => {
    if (subs >= 100) return "Bingo God"
    if (subs >= 50) return "Master"
    if (subs >= 25) return "Veteran"
    if (subs >= 10) return "Journeyman"
    if (subs >= 1) return "Novice"
    return "Unranked"
  }

  const rank = calculateRank(totalSubmissions)

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <Avatar className="osrs-slot h-32 w-32 rounded-sm">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
            <AvatarFallback className="rounded-sm font-display text-4xl">{user.name?.[0] ?? "U"}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 text-center md:text-left space-y-4">
            <div>
              <InlineRsnEditor 
                userId={user.id} 
                initialRsn={user.runescapeName} 
                fallbackName={user.name || "Unknown Player"} 
              />
              <div className="flex items-center justify-center md:justify-start gap-2 mt-2 text-muted-foreground">
                <User aria-hidden="true" className="h-4 w-4" />
                <span>{user.name}</span>
                {metadata?.skillLevel && (
                  <Badge variant="secondary" className="capitalize">
                    {metadata.skillLevel.replace("_", " ")}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
              <div className="osrs-slot flex items-center gap-2 rounded-sm px-4 py-2">
                <Swords aria-hidden="true" className="h-5 w-5 text-danger" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Combat</span>
                  <span className="font-display font-semibold">{metadata?.combatLevel ?? "—"}</span>
                </div>
              </div>
              <div className="osrs-slot flex items-center gap-2 rounded-sm px-4 py-2">
                <ArrowUpCircle aria-hidden="true" className="h-5 w-5 text-pending" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Level</span>
                  <span className="font-display font-semibold">{metadata?.totalLevel ?? "—"}</span>
                </div>
              </div>
              <div className="osrs-slot flex items-center gap-2 rounded-sm px-4 py-2">
                <Trophy aria-hidden="true" className="h-5 w-5 text-primary" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Rank</span>
                  <span className="font-display font-semibold text-primary">{rank}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
