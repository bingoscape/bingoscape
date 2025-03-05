/* eslint-disable */
"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Pie,
  PieChart,
  Legend,
  AreaChart,
  Area,
} from "recharts"
import { Trophy, Image, TrendingUp, Calendar, Grid, BarChart2, PieChartIcon, Award } from "lucide-react"
import type { Team } from "@/app/actions/events"
import { getAllTeamPointsAndTotal } from "@/app/actions/stats"
import type { StatsData, TeamUserSubmissions } from "@/app/actions/stats"

interface StatsDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  userRole: string
  currentTeamId?: string
  teams: Team[]
  bingoId: string
}

export function StatsDialog({ isOpen, onOpenChange, userRole, currentTeamId, teams, bingoId }: StatsDialogProps) {
  const [statsData, setStatsData] = useState<StatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)

      const fetchData = async () => {
        try {
          const data = await getAllTeamPointsAndTotal(bingoId)
          setStatsData(data)
          setIsLoading(false)
        } catch (error) {
          console.error("Error fetching stats data:", error)
          setIsLoading(false)
        }
      }

      fetchData()
        .then(() => console.log("Stats data fetched"))
        .catch(() => console.log("Error fetching stats data"))
    }
  }, [isOpen, bingoId])

  // Format team points data for the bar chart
  const teamPointsData =
    statsData?.teamPoints.map((team) => ({
      name: team.name,
      xp: team.xp,
    })) || []

  // Format team efficiency data
  const teamEfficiencyData =
    statsData?.teamEfficiency.map((team) => ({
      name: team.name,
      efficiency: team.efficiency,
      xp: team.xp,
      submissions: team.submissions,
    })) || []

  // Format tile completion data
  const tileCompletionData =
    statsData?.tileCompletions.slice(0, 10).map((tile) => ({
      name: tile.title.length > 20 ? tile.title.substring(0, 20) + "..." : tile.title,
      completions: tile.completionCount,
      weight: tile.weight,
      fullTitle: tile.title,
    })) || []

  // Format activity timeline data
  const activityTimelineData =
    statsData?.activityTimeline.map((day) => ({
      date: new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      submissions: day.submissions,
      fullDate: day.date,
    })) || []

  // Format submission status data
  const submissionStatusData =
    statsData?.teamSubmissions.map((team) => {
      const total = team.total || 1 // Avoid division by zero
      return {
        name: team.name,
        accepted: team.accepted,
        pending: team.pending,
        declined: team.declined,
        requiresInteraction: team.requiresInteraction,
        acceptedRate: Number.parseFloat(((team.accepted / total) * 100).toFixed(1)),
      }
    }) || []

  // Create a config for each team's pie chart
  const createTeamPieConfig = (team: TeamUserSubmissions) => {
    const config: Record<string, any> = {
      imageCount: {
        label: "Images",
      },
    }

    // Add colors for each user
    team.users.forEach((user, index) => {
      const colorIndex = (index % 5) + 1 // Use 5 chart colors
      config[user.userId] = {
        label: user.runescapeName || user.name,
        color: `hsl(var(--chart-${colorIndex}))`,
      }
    })

    return config
  }

  // Prepare data for each team's pie chart
  const prepareTeamPieData = (team: TeamUserSubmissions) => {
    return team.users.map((user, index) => {
      // Assign fill color based on user ID
      const colorIndex = (index % 5) + 1 // Use 5 chart colors
      return {
        ...user,
        fill: `var(--color-${user.userId})`,
        name: user.runescapeName || user.name,
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Team Statistics</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <Tabs defaultValue="xp" className="w-full">
              <TabsList className="grid w-full grid-cols-4 md:grid-cols-8">
                <TabsTrigger value="xp" className="flex items-center gap-1">
                  <Trophy className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">XP</span>
                </TabsTrigger>
                <TabsTrigger value="contributors" className="flex items-center gap-1">
                  <Award className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">Team MVPs</span>
                </TabsTrigger>
                <TabsTrigger value="efficiency" className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">Efficiency</span>
                </TabsTrigger>
                <TabsTrigger value="tiles" className="flex items-center gap-1">
                  <Grid className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">Tiles</span>
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">Activity</span>
                </TabsTrigger>
                <TabsTrigger value="status" className="flex items-center gap-1">
                  <BarChart2 className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">Status</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="xp" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-amber-500" />
                      Team XP Leaderboard
                    </CardTitle>
                    <CardDescription>Total XP earned by each team</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {teamPointsData.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No data available</p>
                      </div>
                    ) : (
                      <ChartContainer config={xpChartConfig}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={teamPointsData}
                            layout="vertical"
                            margin={{ top: 10, right: 50, left: 10, bottom: 10 }}
                          >
                            <CartesianGrid horizontal strokeDasharray="3 3" />
                            <YAxis dataKey="name" type="category" width={120} tickLine={false} axisLine={false} />
                            <XAxis type="number" domain={[0, statsData?.totalPossibleXP || "auto"]} />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                            <Bar dataKey="xp" fill="var(--color-xp)" radius={4}>
                              <LabelList
                                dataKey="xp"
                                position="right"
                                formatter={(value: number) => `${value} XP`}
                                className="fill-foreground"
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-2 text-sm">
                    <div className="leading-none text-muted-foreground">
                      Total Possible XP: {statsData?.totalPossibleXP || 0}
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>
              <TabsContent value="contributors" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {statsData?.teamUserWeightedSubmissions && statsData.teamUserWeightedSubmissions.length > 0 ? (
                    statsData.teamUserWeightedSubmissions.map((team) => (
                      <Card key={team.teamId} className="flex flex-col">
                        <CardHeader className="items-center pb-0">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Award className="h-4 w-4 text-amber-500" />
                            {team.teamName} MVPs
                          </CardTitle>
                          <CardDescription>Contribution by weighted image submissions</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 pb-0">
                          <ChartContainer
                            config={{
                              weightedAverage: {
                                label: "Weighted Average",
                              },
                              ...team.users.reduce(
                                (acc, user, index) => {
                                  const colorIndex = (index % 5) + 1
                                  acc[user.userId] = {
                                    label: user.runescapeName || user.name,
                                    color: `hsl(var(--chart-${colorIndex}))`,
                                  }
                                  return acc
                                },
                                {} as Record<string, any>,
                              ),
                            }}
                            className="mx-auto aspect-square max-h-[200px] pb-0 [&_.recharts-pie-label-text]:fill-foreground"
                          >
                            <PieChart>
                              <ChartTooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0]?.payload
                                    return (
                                      <div className="bg-background border border-border p-2 rounded-md shadow-md">
                                        <p className="font-medium">{data.name}</p>
                                        <p>Weighted Avg: {data.weightedAverage}</p>
                                        <p>Total Images: {data.totalImages}</p>
                                        <p>Tiles Completed: {data.totalTiles}</p>
                                        <p>Total XP: {data.totalXP}</p>
                                      </div>
                                    )
                                  }
                                  return null
                                }}
                              />
                              <Pie
                                data={team.users.map((user, index) => {
                                  const colorIndex = (index % 5) + 1
                                  return {
                                    ...user,
                                    name: user.runescapeName || user.name,
                                    value: user.weightedAverage,
                                    fill: `var(--color-${user.userId})`,
                                  }
                                })}
                                dataKey="weightedAverage"
                                nameKey="name"
                                label={(entry) => entry.name}
                                labelLine={false}
                              />
                              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                            </PieChart>
                          </ChartContainer>
                        </CardContent>
                        <CardFooter className="text-sm text-center">
                          <div className="w-full leading-none text-muted-foreground">
                            Pie slices represent weighted contribution per user
                          </div>
                        </CardFooter>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-2 flex items-center justify-center h-[300px]">
                      <p className="text-muted-foreground">No MVP data available</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="efficiency" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      Team Efficiency
                    </CardTitle>
                    <CardDescription>XP earned per submission (higher is better)</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {teamEfficiencyData.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No data available</p>
                      </div>
                    ) : (
                      <ChartContainer config={efficiencyChartConfig}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={teamEfficiencyData}
                            layout="vertical"
                            margin={{ top: 10, right: 80, left: 10, bottom: 10 }}
                          >
                            <CartesianGrid horizontal strokeDasharray="3 3" />
                            <YAxis dataKey="name" type="category" width={120} tickLine={false} axisLine={false} />
                            <XAxis type="number" />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                            <Bar dataKey="efficiency" fill="var(--color-efficiency)" radius={4}>
                              <LabelList
                                dataKey="efficiency"
                                position="right"
                                formatter={(value: number) => `${value} XP/sub`}
                                className="fill-foreground"
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-2 text-sm">
                    <div className="leading-none text-muted-foreground">
                      Higher efficiency means teams are earning more XP with fewer submissions
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="tiles" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Grid className="h-5 w-5 text-purple-500" />
                      Most Completed Tiles
                    </CardTitle>
                    <CardDescription>Top 10 tiles by completion count</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {tileCompletionData.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No data available</p>
                      </div>
                    ) : (
                      <ChartContainer config={tileCompletionChartConfig}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={tileCompletionData}
                            layout="vertical"
                            margin={{ top: 10, right: 50, left: 10, bottom: 10 }}
                          >
                            <CartesianGrid horizontal strokeDasharray="3 3" />
                            <YAxis dataKey="name" type="category" width={150} tickLine={false} axisLine={false} />
                            <XAxis type="number" />
                            <ChartTooltip
                              cursor={false}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-background border border-border p-2 rounded-md shadow-md">
                                      <p className="font-medium">{payload[0]?.payload.fullTitle}</p>
                                      <p>Completions: {payload[0]?.value}</p>
                                      <p>XP Value: {payload[0]?.payload.weight}</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Bar dataKey="completions" fill="var(--color-completions)" radius={4}>
                              <LabelList dataKey="completions" position="right" className="fill-foreground" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-blue-500" />
                      Activity Timeline
                    </CardTitle>
                    <CardDescription>Submission activity over the last 30 days</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {activityTimelineData.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No activity data available</p>
                      </div>
                    ) : (
                      <ChartContainer config={activityChartConfig}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={activityTimelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tickLine={false} />
                            <YAxis />
                            <ChartTooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-background border border-border p-2 rounded-md shadow-md">
                                      <p className="font-medium">{payload[0]?.payload.date}</p>
                                      <p>Submissions: {payload[0]?.value}</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="submissions"
                              stroke="var(--color-submissions)"
                              fill="var(--color-submissions)"
                              fillOpacity={0.3}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-2 text-sm">
                    <div className="leading-none text-muted-foreground">
                      Shows when teams are most active in submitting tiles
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="status" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart2 className="h-5 w-5 text-orange-500" />
                      Submission Status
                    </CardTitle>
                    <CardDescription>Breakdown of submission statuses by team</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {submissionStatusData.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No status data available</p>
                      </div>
                    ) : (
                      <ChartContainer config={submissionStatusChartConfig}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={submissionStatusData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Bar dataKey="accepted" stackId="a" fill="var(--color-accepted)" />
                            <Bar dataKey="pending" stackId="a" fill="var(--color-pending)" />
                            <Bar dataKey="declined" stackId="a" fill="var(--color-declined)" />
                            <Bar dataKey="requiresInteraction" stackId="a" fill="var(--color-requiresInteraction)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-2 text-sm">
                    <div className="leading-none text-muted-foreground">
                      Teams with higher acceptance rates are more successful at completing tiles correctly
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

const xpChartConfig = {
  xp: {
    label: "XP",
    color: "hsl(var(--chart-1))",
  },
  label: {
    color: "hsl(var(--background))",
  },
}

const efficiencyChartConfig = {
  efficiency: {
    label: "XP per Submission",
    color: "hsl(var(--chart-2))",
  },
  label: {
    color: "hsl(var(--background))",
  },
}

const tileCompletionChartConfig = {
  completions: {
    label: "Completions",
    color: "hsl(var(--chart-3))",
  },
  label: {
    color: "hsl(var(--background))",
  },
}

const activityChartConfig = {
  submissions: {
    label: "Submissions",
    color: "hsl(var(--chart-4))",
  },
  label: {
    color: "hsl(var(--background))",
  },
}

const submissionStatusChartConfig = {
  accepted: {
    label: "Accepted",
    color: "hsl(var(--chart-2))",
  },
  pending: {
    label: "Pending",
    color: "hsl(var(--chart-3))",
  },
  declined: {
    label: "Declined",
    color: "hsl(var(--chart-5))",
  },
  requiresInteraction: {
    label: "Requires Interaction",
    color: "hsl(var(--chart-4))",
  },
  label: {
    color: "hsl(var(--background))",
  },
}

