"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { Bar, BarChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts"
import type { TeamItemStats, UserItemStats } from "@/app/actions/item-statistics"
import { formatGPValue } from "@/lib/format-gp"

interface ItemValueChartsProps {
  teamStats: TeamItemStats[]
  userStats: UserItemStats[]
}

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#f97316"]

export function ItemValueCharts({ teamStats, userStats }: ItemValueChartsProps) {
  // Prepare data for team value distribution (pie chart)
  const teamPieData = teamStats.map((team, index) => ({
    name: team.teamName,
    value: team.totalValue,
    fill: COLORS[index % COLORS.length],
  }))

  // Prepare data for top users bar chart (top 10)
  const topUsersData = userStats.slice(0, 10).map((user) => ({
    name: user.runescapeName ?? user.userName,
    value: user.totalValue,
    submissions: user.submissionCount,
  }))

  // Prepare data for team comparison bar chart
  const teamBarData = teamStats.map((team) => ({
    name: team.teamName,
    totalValue: team.totalValue,
    avgPerUser: team.averageValuePerUser,
  }))

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Team Value Distribution Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Team Value Distribution</CardTitle>
          <CardDescription>Total item value by team</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              value: {
                label: "Total Value",
                color: "hsl(var(--primary))",
              },
            }}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={teamPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {teamPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const data = payload[0].payload as { name: string; value: number; fill: string }
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="grid gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{data.name}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground">Value:</span>
                              <span className="text-sm font-bold">{formatGPValue(data.value)} GP</span>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Top Users Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top Contributors by Value</CardTitle>
          <CardDescription>Top 10 users by total item value</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              value: {
                label: "Total Value",
                color: "hsl(var(--primary))",
              },
            }}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topUsersData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value: number) => formatGPValue(value)} />
                <YAxis type="category" dataKey="name" width={100} />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const data = payload[0].payload as { name: string; value: number; submissions: number }
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="grid gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{data.name}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground">Value:</span>
                              <span className="text-sm font-bold">{formatGPValue(data.value)} GP</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground">Submissions:</span>
                              <span className="text-sm">{data.submissions}</span>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Team Comparison Bar Chart */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Team Comparison</CardTitle>
          <CardDescription>Total value and average per user by team</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              totalValue: {
                label: "Total Value",
                color: "hsl(var(--chart-1))",
              },
              avgPerUser: {
                label: "Avg per User",
                color: "hsl(var(--chart-2))",
              },
            }}
            className="h-[350px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamBarData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value: number) => formatGPValue(value)} />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const data = payload[0].payload as { name: string; totalValue: number; avgPerUser: number }
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="grid gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{data.name}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground">Total Value:</span>
                              <span className="text-sm font-bold">{formatGPValue(data.totalValue)} GP</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground">Avg per User:</span>
                              <span className="text-sm">{formatGPValue(data.avgPerUser)} GP</span>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend />
                <Bar dataKey="totalValue" name="Total Value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgPerUser" name="Avg per User" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
