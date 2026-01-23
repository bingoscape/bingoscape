"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Users, TrendingUp, Activity } from "lucide-react"

interface TeamBalanceMetrics {
  teams: Array<{
    teamId: string
    teamName: string
    memberCount: number
    averageScore: number
  }>
  overallAverage: number
  variance: number
  standardDeviation: number
}

interface TeamBalancePreviewProps {
  metrics: TeamBalanceMetrics | null
  loading?: boolean
}

export function TeamBalancePreview({
  metrics,
  loading,
}: TeamBalancePreviewProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Team Balance Analysis
          </CardTitle>
          <CardDescription>Loading balance metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!metrics || metrics.teams.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Team Balance Analysis
          </CardTitle>
          <CardDescription>No teams to analyze</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Create teams to see balance metrics and analysis.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Calculate balance quality (inverse of standard deviation)
  const balanceQuality = Math.max(0, 100 - metrics.standardDeviation * 200)

  // Get balance status
  const getBalanceStatus = () => {
    if (metrics.standardDeviation < 0.1)
      return { label: "Excellent", color: "bg-green-500" }
    if (metrics.standardDeviation < 0.15)
      return { label: "Good", color: "bg-blue-500" }
    if (metrics.standardDeviation < 0.2)
      return { label: "Fair", color: "bg-yellow-500" }
    return { label: "Poor", color: "bg-red-500" }
  }

  const balanceStatus = getBalanceStatus()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Team Balance Analysis
            </CardTitle>
            <CardDescription>
              Statistical balance across {metrics.teams.length} teams
            </CardDescription>
          </div>
          <Badge className={balanceStatus.color}>{balanceStatus.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Overall Average
            </p>
            <p className="text-2xl font-bold">
              {(metrics.overallAverage * 100).toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">Normalized score</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Variance
            </p>
            <p className="text-2xl font-bold">
              {(metrics.variance * 100).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Lower is better</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Std. Deviation
            </p>
            <p className="text-2xl font-bold">
              {(metrics.standardDeviation * 100).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Distribution spread</p>
          </div>
        </div>

        {/* Balance Quality Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Balance Quality</p>
            <p className="text-sm text-muted-foreground">
              {balanceQuality.toFixed(0)}%
            </p>
          </div>
          <Progress value={balanceQuality} className="h-2" />
        </div>

        {/* Individual Team Scores */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Team Strength Distribution</p>
          {metrics.teams
            .sort((a, b) => b.averageScore - a.averageScore)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .map((team, index) => {
              const scorePercentage = team.averageScore * 100
              const deviation =
                ((team.averageScore - metrics.overallAverage) /
                  metrics.overallAverage) *
                100

              return (
                <div key={team.teamId} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {team.teamName}
                      </span>
                      <Badge variant="outline" className="h-5">
                        <Users className="mr-1 h-3 w-3" />
                        {team.memberCount}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {scorePercentage.toFixed(1)}
                      </span>
                      {Math.abs(deviation) > 5 && (
                        <Badge
                          variant="outline"
                          className={
                            deviation > 0
                              ? "border-green-500 text-green-600"
                              : "border-red-500 text-red-600"
                          }
                        >
                          <TrendingUp
                            className={`mr-1 h-3 w-3 ${deviation < 0 ? "rotate-180" : ""}`}
                          />
                          {Math.abs(deviation).toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Progress value={scorePercentage} className="h-1.5" />
                </div>
              )
            })}
        </div>

        {/* Balance Tips */}
        {metrics.standardDeviation > 0.15 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950">
            <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
              Balance Suggestion
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Teams have significant strength differences. Consider adjusting
              weight sliders or manually reassigning players to improve balance.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
