"use client"

import React, { useState } from "react"
import { ChevronDown, ChevronUp, Users, TrendingUp, Clock, Globe, Award, AlertCircle, CheckCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { EventTeamStatistics } from "@/app/actions/team-statistics"

interface TeamStatisticsDisplayProps {
  statistics: EventTeamStatistics
  isLoading?: boolean
}

export function TeamStatisticsDisplay({
  statistics,
  isLoading = false,
}: TeamStatisticsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <span className="text-lg font-semibold">Team Statistics</span>
            </div>
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (statistics.totalTeams === 0) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <span className="text-lg font-semibold">Team Statistics</span>
            </div>
            <div className="text-sm text-muted-foreground">
              No teams created yet
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { teams, balance, coverage, totalTeams } = statistics

  // Determine balance score color
  const getBalanceColor = (score: number) => {
    if (score >= 75) return "text-green-600"
    if (score >= 50) return "text-orange-600"
    return "text-red-600"
  }

  // Determine coverage color (not currently used but kept for potential future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getCoverageColor = (percentage: number) => {
    if (percentage >= 75) return "bg-green-600"
    if (percentage >= 50) return "bg-orange-600"
    return "bg-red-600"
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg font-semibold">Team Statistics</span>
            <Badge variant="secondary">{totalTeams} Teams</Badge>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? "Hide Details" : "Show Details"}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Summary Row (Always Visible) */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Metadata Coverage */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-help">
                  {coverage.coveragePercentage >= 75 ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground">
                      Metadata Coverage
                    </div>
                    <div className="text-xl font-semibold">
                      {coverage.coveragePercentage.toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {coverage.playersWithMetadata} / {coverage.totalPlayers}{" "}
                      players
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-semibold mb-1">Metadata Coverage</p>
                <p className="text-sm">
                  Percentage of team members with configured player metadata
                  (EHP, EHB, timezone, etc.). Higher coverage enables better
                  team balancing.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Balance Score */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-help">
                  <Award
                    className={`h-5 w-5 ${getBalanceColor(balance.overallBalanceScore)}`}
                  />
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground">
                      Balance Score
                    </div>
                    <div
                      className={`text-xl font-semibold ${getBalanceColor(balance.overallBalanceScore)}`}
                    >
                      {balance.overallBalanceScore}/100
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {balance.overallBalanceScore >= 75
                        ? "Well balanced"
                        : balance.overallBalanceScore >= 50
                          ? "Moderate balance"
                          : "Needs balancing"}
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-semibold mb-1">Balance Score</p>
                <p className="text-sm">
                  Composite score (0-100) measuring how evenly teams are
                  balanced across EHP, EHB, timezone diversity, and daily
                  hours. Higher scores indicate more fair team distribution.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Team Size Range */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-help">
                  <Users className="h-5 w-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground">
                      Team Sizes
                    </div>
                    <div className="text-xl font-semibold">
                      {Math.min(...teams.map((t) => t.memberCount))} -{" "}
                      {Math.max(...teams.map((t) => t.memberCount))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      members per team
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-semibold mb-1">Team Size Range</p>
                <p className="text-sm">
                  Range of team sizes across all teams. More even sizes
                  generally indicate better balance.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-6 space-y-6">
            {/* Team Comparison Grid */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team Comparison
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {teams.map((team) => (
                  <div
                    key={team.teamId}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold">{team.teamName}</div>
                        <div className="text-xs text-muted-foreground">
                          {team.memberCount} members •{" "}
                          {team.metadataCoverage.toFixed(0)}% metadata
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      {/* EHP Badge */}
                      {team.averageEHP != null && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="text-xs">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                EHP: {team.averageEHP.toFixed(1)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-sm">Average EHP (Efficient Hours Played)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {/* EHB Badge */}
                      {team.averageEHB != null && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="text-xs">
                                <Award className="h-3 w-3 mr-1" />
                                EHB: {team.averageEHB.toFixed(1)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-sm">Average EHB (Efficient Hours Bossed)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {/* Daily Hours Badge */}
                      {team.totalDailyHours != null && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {team.totalDailyHours.toFixed(1)}h/day
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-sm">Total daily hours available</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {/* Timezone Diversity Badge */}
                      {team.timezoneDistribution.length > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="secondary"
                                className="text-xs"
                              >
                                <Globe className="h-3 w-3 mr-1" />
                                {team.timezoneDistribution.length} TZ
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-sm font-semibold mb-1">
                                Timezone Distribution
                              </p>
                              {team.timezoneDistribution.map((tz) => (
                                <p key={tz.timezone} className="text-xs">
                                  {tz.timezone}: {tz.count} member
                                  {tz.count !== 1 ? "s" : ""}
                                </p>
                              ))}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Balance Metrics */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Award className="h-4 w-4" />
                Balance Metrics
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* EHP Variance */}
                {balance.standardDeviations.ehp > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-help">
                          <div className="text-sm text-muted-foreground mb-1">
                            EHP Standard Deviation
                          </div>
                          <div className="text-lg font-semibold">
                            ±{balance.standardDeviations.ehp.toFixed(1)}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          Standard deviation of average EHP across teams. Lower
                          values indicate teams are more evenly matched in
                          experience.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* EHB Variance */}
                {balance.standardDeviations.ehb > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-help">
                          <div className="text-sm text-muted-foreground mb-1">
                            EHB Standard Deviation
                          </div>
                          <div className="text-lg font-semibold">
                            ±{balance.standardDeviations.ehb.toFixed(1)}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          Standard deviation of average EHB across teams. Lower
                          values indicate teams are more evenly matched in
                          bossing experience.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* Daily Hours Variance */}
                {balance.standardDeviations.dailyHours > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-help">
                          <div className="text-sm text-muted-foreground mb-1">
                            Daily Hours Std Dev
                          </div>
                          <div className="text-lg font-semibold">
                            ±{balance.standardDeviations.dailyHours.toFixed(1)}h
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          Standard deviation of total daily hours across teams.
                          Lower values indicate teams have similar total
                          availability.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* Timezone Diversity */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-help">
                        <div className="text-sm text-muted-foreground mb-1">
                          Timezone Balance
                        </div>
                        <div className="text-lg font-semibold">
                          {balance.timezoneVariance < 0.1
                            ? "Excellent"
                            : balance.timezoneVariance < 0.3
                              ? "Good"
                              : "Needs work"}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        How evenly timezone diversity is distributed across
                        teams. Better balance means all teams have similar
                        timezone spreads.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Metadata Coverage Details */}
            {coverage.coveragePercentage < 100 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Metadata Coverage Details
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {Object.entries(coverage.specificCoverage).map(
                    ([key, percentage]) => (
                      <div
                        key={key}
                        className="p-2 rounded-lg border bg-card text-center"
                      >
                        <div className="text-xs text-muted-foreground mb-1 capitalize">
                          {key === "ehp"
                            ? "EHP"
                            : key === "ehb"
                              ? "EHB"
                              : key === "dailyHours"
                                ? "Daily Hours"
                                : key === "skillLevel"
                                  ? "Skill Level"
                                  : key}
                        </div>
                        <div
                          className={`text-sm font-semibold ${
                            percentage >= 75
                              ? "text-green-600"
                              : percentage >= 50
                                ? "text-orange-600"
                                : "text-red-600"
                          }`}
                        >
                          {percentage.toFixed(0)}%
                        </div>
                      </div>
                    )
                  )}
                </div>
                {coverage.coveragePercentage < 50 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 Tip: Configure player metadata for better team balancing
                    and statistics. Click the orange warning icons on team
                    members to add their data.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
