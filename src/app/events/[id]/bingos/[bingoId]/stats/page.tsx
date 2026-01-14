import { notFound } from "next/navigation"
import { getServerAuthSession } from "@/server/auth"
import { getEventById } from "@/app/actions/events"
import { getBingoItemStatistics } from "@/app/actions/item-statistics"
import { getAllTeamPointsAndTotal } from "@/app/actions/stats"
import { ItemStatisticsDisplay } from "@/components/item-statistics-display"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BarChart3 } from "lucide-react"
import Link from "next/link"
import type { UUID } from "crypto"

export default async function BingoStatsPage(props: { params: Promise<{ id: UUID; bingoId: string }> }) {
  const params = await props.params;
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    notFound()
  }

  const data = await getEventById(params.id)
  if (!data) {
    notFound()
  }

  const { event, userRole } = data

  // Check if user has access to this event
  if (!userRole) {
    notFound()
  }

  // Find the bingo board
  const bingo = event.bingos?.find((b) => b.id === params.bingoId)
  if (!bingo) {
    notFound()
  }

  // Get item statistics for this bingo
  const itemStatistics = await getBingoItemStatistics(params.bingoId)

  // Get general bingo statistics
  const bingoStats = await getAllTeamPointsAndTotal(params.bingoId)

  const hasItemStats = itemStatistics.totalSubmissions > 0

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href={`/events/${params.id}/stats`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Event Stats
            </Button>
          </Link>
        </div>
        <h1 className="text-3xl font-bold">{bingo.title} - Statistics</h1>
        <p className="text-muted-foreground mt-2">{event.title}</p>
      </div>

      {/* General Bingo Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bingoStats.teamPoints.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total XP Earned</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {bingoStats.teamPoints.reduce((sum, team) => sum + team.xp, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              of {bingoStats.totalPossibleXP.toLocaleString()} possible
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {bingoStats.totalPossibleXP > 0
                ? (
                    (bingoStats.teamPoints.reduce((sum, team) => sum + team.xp, 0) / bingoStats.totalPossibleXP) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Item Statistics */}
      {hasItemStats ? (
        <ItemStatisticsDisplay statistics={itemStatistics} title={bingo.title} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Item Statistics</CardTitle>
            <CardDescription>No item goal submissions have been approved yet for this bingo board</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Item statistics will appear here once teams start submitting and getting approved for item-based goals.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
