import { notFound } from "next/navigation"
import { eq, desc, sql } from "drizzle-orm"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { users, apiKeys, playerMetadata, submissions, eventParticipants } from "@/server/db/schema"
import { PlayerCard } from "@/components/player-card"
import { StatsDashboard } from "@/components/stats-dashboard"
import { TrophyRoom } from "@/components/trophy-room"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

async function getProfileData(userId: string) {
  // 1. Get user basic info
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  if (!user) return null

  // 2. Get API keys count to check if they have one
  const keysCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))

  const hasApiKey = (keysCount[0]?.count ?? 0) > 0

  // 3. Get most recent player metadata
  const metadata = await db.query.playerMetadata.findFirst({
    where: eq(playerMetadata.userId, userId),
    orderBy: [desc(playerMetadata.updatedAt)],
  })

  // 4. Get submission stats
  const allSubmissions = await db.query.submissions.findMany({
    where: eq(submissions.submittedBy, userId),
    columns: {
      status: true,
    }
  })

  const totalSubmissions = allSubmissions.length
  const approvedSubmissions = allSubmissions.filter(s => s.status === "approved").length
  const approvalRate = totalSubmissions > 0 ? (approvedSubmissions / totalSubmissions) * 100 : 0

  // 5. Get event participation count
  const eventsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(eventParticipants)
    .where(eq(eventParticipants.userId, userId))

  return {
    user,
    hasApiKey,
    metadata: metadata || null,
    stats: {
      totalSubmissions,
      approvedSubmissions,
      approvalRate,
    },
    eventsCount: eventsCount[0]?.count ?? 0
  }
}

export default async function ProfilePage() {
  const session = await getServerAuthSession()

  if (!session || !session.user) {
    notFound()
  }

  const data = await getProfileData(session.user.id)

  if (!data) {
    notFound()
  }

  return (
    <div className="space-y-8">
      {!data.hasApiKey && (
        <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No API Key Configured</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>You need an API key to submit drops via the RuneLite plugin.</span>
            <Link href="/profile/api-keys" className="font-semibold underline underline-offset-2 hover:text-destructive/80">
              Set up your API Key
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <PlayerCard 
        user={data.user} 
        metadata={data.metadata} 
        totalSubmissions={data.stats.totalSubmissions} 
      />

      <StatsDashboard 
        stats={data.stats} 
        metadata={data.metadata} 
      />

      <TrophyRoom 
        stats={data.stats} 
        eventsCount={data.eventsCount} 
      />
    </div>
  )
}
