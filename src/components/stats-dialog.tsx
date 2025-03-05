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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, ResponsiveContainer, Pie, PieChart } from "recharts"
import { Trophy, Users } from "lucide-react"
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

  // Chart configurations
  const xpChartConfig = {
    xp: {
      label: "XP",
      color: "hsl(var(--chart-1))",
    },
    label: {
      color: "hsl(var(--background))",
    },
  }

  // Create a config for each team's pie chart
  const createTeamPieConfig = (team: TeamUserSubmissions) => {
    const config: Record<string, any> = {
      submissions: {
        label: "Submissions",
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="xp">Team XP</TabsTrigger>
                <TabsTrigger value="users">User Submissions</TabsTrigger>
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
                            <XAxis type="number" domain={[0, statsData?.totalPossibleXP ?? "auto"]} />
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
                      Total Possible XP: {statsData?.totalPossibleXP ?? 0}
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="users" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {statsData?.teamUserSubmissions && statsData.teamUserSubmissions.length > 0 ? (
                    statsData.teamUserSubmissions.map((team) => (
                      <Card key={team.teamId} className="flex flex-col">
                        <CardHeader className="items-center pb-0">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Users className="h-4 w-4" />
                            {team.teamName}
                          </CardTitle>
                          <CardDescription>User Submissions</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 pb-0">
                          <ChartContainer
                            config={createTeamPieConfig(team)}
                            className="mx-auto aspect-square max-h-[200px] pb-0 [&_.recharts-pie-label-text]:fill-foreground"
                          >
                            <PieChart>
                              <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
                              <Pie
                                data={prepareTeamPieData(team)}
                                dataKey="submissions"
                                nameKey="name"
                                label
                                labelLine={false}
                              />
                              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                            </PieChart>
                          </ChartContainer>
                        </CardContent>
                        <CardFooter className="text-sm text-center">
                          <div className="w-full leading-none text-muted-foreground">
                            Total Submissions: {team.totalSubmissions}
                          </div>
                        </CardFooter>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-2 flex items-center justify-center h-[300px]">
                      <p className="text-muted-foreground">No user submission data available</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

