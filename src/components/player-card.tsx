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
    <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-card to-card/50">
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <Avatar className="h-32 w-32 ring-4 ring-primary/20 ring-offset-4 ring-offset-background">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
            <AvatarFallback className="text-4xl">{user.name?.[0] ?? "U"}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 text-center md:text-left space-y-4">
            <div>
              <InlineRsnEditor 
                userId={user.id} 
                initialRsn={user.runescapeName} 
                fallbackName={user.name || "Unknown Adventurer"} 
              />
              <div className="flex items-center justify-center md:justify-start gap-2 mt-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{user.name}</span>
                {metadata?.skillLevel && (
                  <Badge variant="secondary" className="capitalize">
                    {metadata.skillLevel.replace("_", " ")}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
              <div className="flex items-center gap-2 bg-secondary/50 px-4 py-2 rounded-lg">
                <Swords className="h-5 w-5 text-red-500" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Combat</span>
                  <span className="font-semibold">{metadata?.combatLevel ?? "—"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-secondary/50 px-4 py-2 rounded-lg">
                <ArrowUpCircle className="h-5 w-5 text-blue-500" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Level</span>
                  <span className="font-semibold">{metadata?.totalLevel ?? "—"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-secondary/50 px-4 py-2 rounded-lg border border-primary/20">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Rank</span>
                  <span className="font-semibold text-primary">{rank}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
