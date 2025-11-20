"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy, Coins, TrendingUp, Package, Clock, Award } from "lucide-react"
import type { ItemStatistics } from "@/app/actions/item-statistics"
import { formatGPValue } from "@/lib/format-gp"
import { ItemValueCharts } from "@/components/item-value-charts"
import { ItemTimelineCharts } from "@/components/item-timeline-charts"
import Image from "next/image"

interface ItemStatisticsDisplayProps {
  statistics: ItemStatistics
  title: string
}

export function ItemStatisticsDisplay({ statistics, title: _title }: ItemStatisticsDisplayProps) {
  const { totalValue, uniqueItemsCount, totalSubmissions, mvp, topUsers, teamStats, mostValuableItem, profitPerHour } =
    statistics

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatGPValue(totalValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">GP</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueItemsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Different items obtained</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Item Submissions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubmissions}</div>
            <p className="text-xs text-muted-foreground mt-1">Approved submissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit per Hour</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profitPerHour !== null ? formatGPValue(profitPerHour) : "N/A"}</div>
            <p className="text-xs text-muted-foreground mt-1">GP/hour</p>
          </CardContent>
        </Card>
      </div>

      {/* MVP Spotlight */}
      {mvp && (
        <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 border-yellow-200 dark:border-yellow-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-600" />
              MVP (Most Valuable Player)
            </CardTitle>
            <CardDescription>Top contributor by total item value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-2xl font-bold">{mvp.runescapeName ?? mvp.userName}</p>
                <p className="text-sm text-muted-foreground">Team: {mvp.teamName}</p>
                <div className="flex gap-4 mt-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Value</p>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {formatGPValue(mvp.totalValue)} GP
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Items</p>
                    <p className="text-lg font-semibold">{mvp.itemCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Submissions</p>
                    <p className="text-lg font-semibold">{mvp.submissionCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg per Sub</p>
                    <p className="text-lg font-semibold">{formatGPValue(mvp.valuePerSubmission)} GP</p>
                  </div>
                </div>
              </div>
              <Award className="h-16 w-16 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Most Valuable Item */}
      {mostValuableItem && (
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              Most Valuable Item
            </CardTitle>
            <CardDescription>Highest total value item obtained</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 flex-shrink-0">
                  <Image
                    src={mostValuableItem.itemImageUrl}
                    alt={mostValuableItem.itemName}
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{mostValuableItem.itemName}</p>
                  <div className="flex gap-4 mt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Value</p>
                      <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                        {formatGPValue(mostValuableItem.totalValue)} GP
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Quantity</p>
                      <p className="text-lg font-semibold">{mostValuableItem.totalQuantity.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Price Each</p>
                      <p className="text-lg font-semibold">{formatGPValue(mostValuableItem.pricePerItem)} GP</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Obtained By</p>
                      <p className="text-lg font-semibold">{mostValuableItem.obtainedByCount} players</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Obtainers */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium mb-2">Top Obtainers:</p>
              <div className="space-y-2">
                {mostValuableItem.obtainedBy.slice(0, 5).map((obtainer, index) => (
                  <div key={obtainer.userId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{index + 1}</Badge>
                      <span className="font-medium">{obtainer.runescapeName ?? obtainer.userName}</span>
                      <span className="text-muted-foreground">({obtainer.teamName})</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatGPValue(obtainer.value)} GP</p>
                      <p className="text-xs text-muted-foreground">{obtainer.quantity}x</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for detailed statistics */}
      <Tabs defaultValue="teams" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="teams">Team Rankings</TabsTrigger>
          <TabsTrigger value="users">User Rankings</TabsTrigger>
          <TabsTrigger value="charts">Visualizations</TabsTrigger>
          <TabsTrigger value="timeline">Timeline & Trends</TabsTrigger>
        </TabsList>

        {/* Team Rankings Tab */}
        <TabsContent value="teams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Profit Rankings</CardTitle>
              <CardDescription>Teams ranked by total item value obtained</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamStats.map((team, index) => (
                  <div key={team.teamId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
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
                        <h3 className="font-semibold text-lg">{team.teamName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {team.userCount} users · {team.submissionCount} submissions · {team.itemCount} items
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">
                        {formatGPValue(team.totalValue)} GP
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Avg per user: {formatGPValue(team.averageValuePerUser)} GP
                      </div>
                      {team.mostValuableItem && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Best: {team.mostValuableItem.itemName} ({formatGPValue(team.mostValuableItem.totalValue)} GP)
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {teamStats.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">No team data available yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Rankings Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Profit Rankings</CardTitle>
              <CardDescription>Top contributors by total item value</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topUsers.map((user, index) => (
                  <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
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
                        <h3 className="font-semibold text-lg">{user.runescapeName ?? user.userName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {user.submissionCount} submissions · {user.itemCount} items
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">
                        {formatGPValue(user.totalValue)} GP
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Avg per sub: {formatGPValue(Math.floor(user.totalValue / user.submissionCount))} GP
                      </div>
                      {user.mostValuableItem && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Best: {user.mostValuableItem.itemName} ({formatGPValue(user.mostValuableItem.totalValue)} GP)
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {topUsers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">No user data available yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-4">
          <ItemValueCharts teamStats={teamStats} userStats={topUsers} />
        </TabsContent>

        {/* Timeline & Trends Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <ItemTimelineCharts
            dailyValueTimeline={statistics.dailyValueTimeline}
            teamTimelineComparison={statistics.teamTimelineComparison}
            itemDiversityByTeam={statistics.itemDiversityByTeam}
            efficiencyTrends={statistics.efficiencyTrends}
            userStreaks={statistics.userStreaks}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
