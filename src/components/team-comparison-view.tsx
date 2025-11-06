"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Globe, TrendingUp, Target, Scale, CheckCircle2, AlertTriangle } from "lucide-react"
import type { TeamStatistics } from "@/app/actions/team-statistics"

type Team = {
  id: string
  name: string
  teamMembers: Array<{
    user: {
      id: string
      name: string | null
      runescapeName: string | null
      image: string | null
    }
    isLeader: boolean
  }>
}

interface TeamComparisonViewProps {
  teams: Team[]
  teamStats: Record<string, TeamStatistics>
  eventAvgEHP?: number
  eventAvgEHB?: number
}

export function TeamComparisonView({
  teams,
  teamStats,
  eventAvgEHP,
  eventAvgEHB,
}: TeamComparisonViewProps) {
  // Calculate max values for progress bar scaling
  const maxEHP = Math.max(...Object.values(teamStats).map((s) => s.averageEHP ?? 0))
  const maxEHB = Math.max(...Object.values(teamStats).map((s) => s.averageEHB ?? 0))
  const maxTZVariance = Math.max(...Object.values(teamStats).map((s) => s.timezoneHourVariance))

  const getBalanceVariant = (value: number, avg: number) => {
    const deviation = Math.abs(value - avg) / avg
    if (deviation < 0.1) return "default"
    if (deviation < 0.2) return "secondary"
    return "destructive"
  }

  const getRecommendations = (team: Team, stats: TeamStatistics) => {
    const recommendations: string[] = []

    // Metadata coverage check
    if (stats.metadataCoverage < 75) {
      const missingCount = stats.memberCount - stats.membersWithMetadata
      recommendations.push(`${missingCount} member${missingCount !== 1 ? "s" : ""} missing metadata`)
    }

    // Timezone variance check
    if (stats.timezoneHourVariance > 5) {
      recommendations.push(`High timezone spread (±${stats.timezoneHourVariance.toFixed(1)}h) may affect coordination`)
    }

    // Balance checks
    if (eventAvgEHP && stats.averageEHP !== null) {
      const ehpDeviation = Math.abs(stats.averageEHP - eventAvgEHP) / eventAvgEHP
      if (ehpDeviation > 0.2) {
        const direction = stats.averageEHP > eventAvgEHP ? "above" : "below"
        recommendations.push(`EHP ${direction} event average by ${(ehpDeviation * 100).toFixed(0)}%`)
      }
    }

    if (eventAvgEHB && stats.averageEHB !== null) {
      const ehbDeviation = Math.abs(stats.averageEHB - eventAvgEHB) / eventAvgEHB
      if (ehbDeviation > 0.2) {
        const direction = stats.averageEHB > eventAvgEHB ? "above" : "below"
        recommendations.push(`EHB ${direction} event average by ${(ehbDeviation * 100).toFixed(0)}%`)
      }
    }

    // Team size check
    if (team.teamMembers.length < 5) {
      recommendations.push(`Small team size (${team.teamMembers.length} members)`)
    }

    return recommendations
  }

  return (
    <div className="space-y-6">
      {/* Comparison Legend */}
      <Card className="bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Team Balance Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span>Optimal (within 10% of average)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gray-500" />
              <span>Acceptable (within 20% of average)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span>Needs Attention (beyond 20% of average)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EHP Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Average EHP Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.map((team) => {
              const stats = teamStats[team.id]
              if (!stats?.averageEHP) return null

              const percentage = maxEHP > 0 ? (stats.averageEHP / maxEHP) * 100 : 0
              const variant = eventAvgEHP ? getBalanceVariant(stats.averageEHP, eventAvgEHP) : "secondary"

              return (
                <div key={team.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{team.name}</span>
                    <Badge variant={variant} className="ml-2">
                      {stats.averageEHP.toFixed(0)}
                    </Badge>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              )
            })}
            {eventAvgEHP && (
              <div className="pt-2 mt-2 border-t text-sm text-muted-foreground">
                Event Average: <span className="font-semibold">{eventAvgEHP.toFixed(0)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* EHB Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-red-600" />
              Average EHB Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.map((team) => {
              const stats = teamStats[team.id]
              if (!stats?.averageEHB) return null

              const percentage = maxEHB > 0 ? (stats.averageEHB / maxEHB) * 100 : 0
              const variant = eventAvgEHB ? getBalanceVariant(stats.averageEHB, eventAvgEHB) : "secondary"

              return (
                <div key={team.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{team.name}</span>
                    <Badge variant={variant} className="ml-2">
                      {stats.averageEHB.toFixed(0)}
                    </Badge>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              )
            })}
            {eventAvgEHB && (
              <div className="pt-2 mt-2 border-t text-sm text-muted-foreground">
                Event Average: <span className="font-semibold">{eventAvgEHB.toFixed(0)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timezone Variance Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple-600" />
              Timezone Variance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.map((team) => {
              const stats = teamStats[team.id]
              if (!stats) return null

              const percentage = maxTZVariance > 0 ? (stats.timezoneHourVariance / maxTZVariance) * 100 : 0
              const variant =
                stats.timezoneHourVariance === 0
                  ? "default"
                  : stats.timezoneHourVariance <= 3
                  ? "secondary"
                  : "destructive"

              return (
                <div key={team.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{team.name}</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant={variant} className="ml-2">
                            {stats.timezoneHourVariance === 0
                              ? "Same TZ"
                              : `±${stats.timezoneHourVariance.toFixed(1)}h`}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {stats.timezoneDistribution.map((tz) => `${tz.timezone} (${tz.count})`).join(", ")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              )
            })}
            <div className="pt-2 mt-2 border-t text-xs text-muted-foreground">
              Lower variance = better coordination
            </div>
          </CardContent>
        </Card>

        {/* Metadata Coverage Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Metadata Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.map((team) => {
              const stats = teamStats[team.id]
              if (!stats) return null

              const variant =
                stats.metadataCoverage >= 75 ? "default" : stats.metadataCoverage >= 50 ? "secondary" : "destructive"

              return (
                <div key={team.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{team.name}</span>
                    <Badge variant={variant} className="ml-2">
                      {stats.metadataCoverage.toFixed(0)}%
                    </Badge>
                  </div>
                  <Progress value={stats.metadataCoverage} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    {stats.membersWithMetadata}/{stats.memberCount} members
                  </div>
                </div>
              )
            })}
            <div className="pt-2 mt-2 border-t text-xs text-muted-foreground">Target: 75%+ coverage</div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations Section */}
      <Card className="border-orange-500/30 bg-orange-500/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
            <AlertTriangle className="h-4 w-4" />
            Recommendations & Action Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teams.map((team) => {
              const stats = teamStats[team.id]
              if (!stats) return null

              const recommendations = getRecommendations(team, stats)

              if (recommendations.length === 0) {
                return (
                  <div key={team.id} className="flex items-start gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-green-700 dark:text-green-400">{team.name}</div>
                      <div className="text-sm text-green-600 dark:text-green-500">
                        Team is well-balanced with no action items
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div key={team.id} className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold mb-1">{team.name}</div>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      {recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-orange-500 mt-0.5">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
