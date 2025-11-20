"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { Line, LineChart, Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts"
import type {
  DailyValueData,
  TeamDailyProgress,
  ItemDiversityStats,
  EfficiencyTrend,
  UserStreakStats,
} from "@/app/actions/item-statistics"
import { formatGPValue } from "@/lib/format-gp"
import { TrendingUp, Activity, Award, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ItemTimelineChartsProps {
  dailyValueTimeline: DailyValueData[]
  teamTimelineComparison: TeamDailyProgress[]
  itemDiversityByTeam: ItemDiversityStats[]
  efficiencyTrends: EfficiencyTrend[]
  userStreaks: UserStreakStats[]
}

const TEAM_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#f97316"]

export function ItemTimelineCharts({
  dailyValueTimeline,
  teamTimelineComparison,
  itemDiversityByTeam,
  efficiencyTrends,
  userStreaks,
}: ItemTimelineChartsProps) {
  // Format date for display (e.g., "Aug 13" or "8/13")
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  // Prepare team timeline data grouped by team
  const teamTimelineByTeam = new Map<string, TeamDailyProgress[]>()
  for (const entry of teamTimelineComparison) {
    const existing = teamTimelineByTeam.get(entry.teamId) ?? []
    existing.push(entry)
    teamTimelineByTeam.set(entry.teamId, existing)
  }

  // Create unified timeline data with all teams
  const unifiedTeamTimeline: Record<string, number | string>[] = []
  if (teamTimelineComparison.length > 0) {
    const allDates = [...new Set(teamTimelineComparison.map((t) => t.date))].sort()
    for (const date of allDates) {
      const dataPoint: Record<string, number | string> = { date: formatDate(date) }
      for (const [teamId, teamData] of teamTimelineByTeam.entries()) {
        const dayData = teamData.find((d) => d.date === date)
        if (dayData) {
          dataPoint[teamId] = dayData.cumulativeValue
        }
      }
      unifiedTeamTimeline.push(dataPoint)
    }
  }

  return (
    <div className="space-y-6">
      {/* Daily Value Timeline */}
      {dailyValueTimeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Daily Value Timeline
            </CardTitle>
            <CardDescription>Cumulative and daily item value over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                cumulativeValue: {
                  label: "Cumulative Value",
                  color: "hsl(var(--chart-1))",
                },
                dailyValue: {
                  label: "Daily Value",
                  color: "hsl(var(--chart-2))",
                },
              }}
              className="h-[350px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dailyValueTimeline.map((d) => ({
                    ...d,
                    date: formatDate(d.date),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value: number) => formatGPValue(value)} />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (active && payload?.[0]) {
                        const data = payload[0].payload as DailyValueData & { date: string }
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="grid gap-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">Date: {data.date}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-muted-foreground">Cumulative:</span>
                                <span className="text-sm font-bold">{formatGPValue(data.cumulativeValue)} GP</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-muted-foreground">Daily:</span>
                                <span className="text-sm font-bold">{formatGPValue(data.dailyValue)} GP</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-muted-foreground">Submissions:</span>
                                <span className="text-sm">{data.submissionCount}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-muted-foreground">Active Users:</span>
                                <span className="text-sm">{data.activeUsers}</span>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cumulativeValue"
                    name="Cumulative Value"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="dailyValue"
                    name="Daily Value"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Team Timeline Comparison */}
      {unifiedTeamTimeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Team Progress Comparison
            </CardTitle>
            <CardDescription>Cumulative value progression by team over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{}}
              className="h-[350px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={unifiedTeamTimeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value: number) => formatGPValue(value)} />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length > 0 && payload[0]) {
                        const data = payload[0].payload as Record<string, number | string>
                        const date = data.date as string
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="grid gap-2">
                              <div className="text-sm font-medium mb-1">
                                {date}
                              </div>
                              {payload.map((entry, index) => {
                                const teamData = teamTimelineComparison.find(
                                  (t) => t.teamId === entry.dataKey,
                                )
                                return (
                                  <div key={index} className="flex items-center justify-between gap-2">
                                    <span className="text-xs" style={{ color: entry.color }}>
                                      {teamData?.teamName ?? "Unknown"}:
                                    </span>
                                    <span className="text-sm font-bold">
                                      {formatGPValue(entry.value as number)} GP
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const teamData = teamTimelineComparison.find((t) => t.teamId === value)
                      return teamData?.teamName ?? value
                    }}
                  />
                  {Array.from(teamTimelineByTeam.keys()).map((teamId, index) => (
                    <Line
                      key={teamId}
                      type="monotone"
                      dataKey={teamId}
                      name={teamId}
                      stroke={TEAM_COLORS[index % TEAM_COLORS.length]}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Item Diversity by Team */}
        {itemDiversityByTeam.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Item Diversity by Team
              </CardTitle>
              <CardDescription>Unique items vs total submissions</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  diversityScore: {
                    label: "Diversity Score",
                    color: "hsl(var(--chart-3))",
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={itemDiversityByTeam}
                    layout="horizontal"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 1]} tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`} />
                    <YAxis type="category" dataKey="teamName" width={100} />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload?.[0]) {
                          const data = payload[0].payload as ItemDiversityStats
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="grid gap-2">
                                <div className="text-sm font-medium">{data.teamName}</div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">Diversity Score:</span>
                                  <span className="text-sm font-bold">
                                    {(data.diversityScore * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">Unique Items:</span>
                                  <span className="text-sm">{data.uniqueItemsCount}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">Total Submissions:</span>
                                  <span className="text-sm">{data.totalSubmissions}</span>
                                </div>
                                {data.topItems.length > 0 && (
                                  <div className="mt-1 pt-1 border-t">
                                    <div className="text-xs text-muted-foreground mb-1">Top Items:</div>
                                    {data.topItems.slice(0, 3).map((item, idx) => (
                                      <div key={idx} className="text-xs">
                                        {item.itemName} ({item.count}x)
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="diversityScore" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Efficiency Trends */}
        {efficiencyTrends.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Efficiency Trends
              </CardTitle>
              <CardDescription>Average value per submission over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  averageValuePerSubmission: {
                    label: "Avg Value/Sub",
                    color: "hsl(var(--chart-4))",
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={efficiencyTrends.map((d) => ({
                      ...d,
                      date: formatDate(d.date),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value: number) => formatGPValue(value)} />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload?.[0]) {
                          const data = payload[0].payload as EfficiencyTrend & { date: string }
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="grid gap-2">
                                <div className="text-sm font-medium">Date: {data.date}</div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">Avg per Sub:</span>
                                  <span className="text-sm font-bold">
                                    {formatGPValue(data.averageValuePerSubmission)} GP
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">Submissions:</span>
                                  <span className="text-sm">{data.totalSubmissions}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">Total Value:</span>
                                  <span className="text-sm">{formatGPValue(data.totalValue)} GP</span>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="averageValuePerSubmission"
                      name="Avg Value/Sub"
                      stroke="hsl(var(--chart-4))"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* User Activity Streaks */}
      {userStreaks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Top Activity Streaks
            </CardTitle>
            <CardDescription>Users with the longest consecutive day streaks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {userStreaks.slice(0, 10).map((user, index) => (
                <div key={user.userId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                        index === 0
                          ? "bg-yellow-500 text-white"
                          : index === 1
                            ? "bg-gray-400 text-white"
                            : index === 2
                              ? "bg-amber-600 text-white"
                              : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{user.runescapeName ?? user.userName}</p>
                      <p className="text-xs text-muted-foreground">{user.teamName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Longest Streak</p>
                      <Badge variant="secondary" className="text-base font-bold">
                        {user.longestStreak} {user.longestStreak === 1 ? "day" : "days"}
                      </Badge>
                    </div>
                    {user.currentStreak > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Current</p>
                        <Badge variant="outline" className="text-sm">
                          {user.currentStreak} {user.currentStreak === 1 ? "day" : "days"}
                        </Badge>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Active Days</p>
                      <p className="text-sm font-medium">{user.totalActiveDays}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Avg/Day</p>
                      <p className="text-sm font-medium">{formatGPValue(user.averageValuePerDay)} GP</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
