"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy, Target, BarChart3, Users } from "lucide-react"
import type { EventStatsData } from "@/app/actions/stats"
import type { EventRole } from "@/app/actions/events"
import type { ItemStatistics } from "@/app/actions/item-statistics"
import { EventTeamChart } from "@/components/event-team-chart"
import { BingoBreakdownChart } from "@/components/bingo-breakdown-chart"
import { ItemStatisticsDisplay } from "@/components/item-statistics-display"

interface EventStatsDisplayProps {
  eventStats: EventStatsData
  eventTitle: string
  userRole: EventRole
  itemStatistics?: ItemStatistics
}

export function EventStatsDisplay({ eventStats, eventTitle, userRole, itemStatistics }: EventStatsDisplayProps) {
  const { eventTeamPoints, bingoSummary, totalEventXP, totalPossibleEventXP } = eventStats

  // Check if we have item statistics with data
  const hasItemStats = itemStatistics && itemStatistics.totalSubmissions > 0

  const overallCompletionRate =
    totalPossibleEventXP > 0 && eventTeamPoints.length > 0
      ? (totalEventXP / (totalPossibleEventXP * eventTeamPoints.length)) * 100
      : 0

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventTeamPoints.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bingo Boards</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bingoSummary.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallCompletionRate.toFixed(1)}%</div>
            <Progress value={overallCompletionRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leaderboard" className="w-full">
        <TabsList className={`grid w-full ${hasItemStats ? "grid-cols-5" : "grid-cols-4"}`}>
          <TabsTrigger value="leaderboard">Team Leaderboard</TabsTrigger>
          <TabsTrigger value="breakdown">Bingo Breakdown</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="boards">Board Summary</TabsTrigger>
          {hasItemStats && <TabsTrigger value="item-values">Item Values</TabsTrigger>}
        </TabsList>

        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Rankings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {eventTeamPoints.map((team, index) => (
                  <div key={team.teamId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="font-semibold">{team.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {team.totalXP.toLocaleString()} XP
                          {team.bonusXP !== undefined && team.bonusXP > 0 && (
                            <span className="text-amber-600 ml-2">
                              (+{team.bonusXP.toLocaleString()} bonus)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{team.totalXP.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">
                        {totalPossibleEventXP > 0
                          ? `${((team.totalXP / totalPossibleEventXP) * 100).toFixed(1)}%`
                          : "0%"}
                      </div>
                      {team.baseXP !== undefined && team.bonusXP !== undefined && team.bonusXP > 0 && (
                        <div className="text-xs text-amber-600 mt-1">
                          Base: {team.baseXP.toLocaleString()} + Bonus: {team.bonusXP.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {eventTeamPoints.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">No team data available yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Points by Bingo Board</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {eventTeamPoints.map((team) => (
                  <div key={team.teamId} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-lg">{team.name}</h3>
                      <Badge variant="secondary">{team.totalXP.toLocaleString()} XP Total</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {team.bingoBreakdown.map((bingo) => (
                        <div key={bingo.bingoId} className="p-3 bg-muted rounded">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{bingo.bingoTitle}</span>
                            <span className="text-sm font-mono">{bingo.xp.toLocaleString()} XP</span>
                          </div>
                          {bingo.bonusXP !== undefined && bingo.bonusXP > 0 && (
                            <div className="text-xs text-amber-600 mt-1">
                              Base: {bingo.baseXP?.toLocaleString() ?? 0} + Bonus: {bingo.bonusXP.toLocaleString()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {eventTeamPoints.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">No team data available yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EventTeamChart data={eventTeamPoints} totalPossibleXP={totalPossibleEventXP} title="Team XP Comparison" />
            <BingoBreakdownChart data={eventTeamPoints} bingoSummary={bingoSummary} title="XP Distribution by Board" />
          </div>
        </TabsContent>

        <TabsContent value="boards" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bingoSummary.map((bingo) => (
              <Card key={bingo.bingoId}>
                <CardHeader>
                  <CardTitle className="text-lg">{bingo.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total XP Available</span>
                      <span className="font-mono">{bingo.totalPossibleXP.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Completion Rate</span>
                      <span className="font-mono">{bingo.completionRate}%</span>
                    </div>
                    <Progress value={bingo.completionRate} className="mt-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
            {bingoSummary.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No bingo boards found for this event
              </div>
            )}
          </div>
        </TabsContent>

        {/* Item Values Tab */}
        {hasItemStats && itemStatistics && (
          <TabsContent value="item-values" className="space-y-4">
            <ItemStatisticsDisplay statistics={itemStatistics} title={eventTitle} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
