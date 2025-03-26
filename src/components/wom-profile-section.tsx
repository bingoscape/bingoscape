"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, Award, TrendingUp, AlertCircle, CheckCircle2, User, RefreshCw } from "lucide-react"
import { linkWomAccount, getWomPlayerDetails, refreshWomPlayerStats } from "@/app/actions/wom-integration"
import type { WomPlayerDetails } from "@/types/wom-types"

interface WomProfileSectionProps {
  userId: string
  runescapeName?: string | null
  womLinked: boolean
}

export function WomProfileSection({ userId, runescapeName, womLinked }: WomProfileSectionProps) {
  const [username, setUsername] = useState(runescapeName || "")
  const [isLinking, setIsLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [playerDetails, setPlayerDetails] = useState<WomPlayerDetails | null>(null)
  const [isLoading, setIsLoading] = useState(womLinked)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (womLinked && runescapeName) {
      fetchPlayerDetails()
    }
  }, [womLinked, runescapeName])

  const fetchPlayerDetails = async () => {
    if (!runescapeName) return

    setIsLoading(true)
    try {
      const details = await getWomPlayerDetails(runescapeName)
      setPlayerDetails(details)
    } catch (error) {
      console.error("Failed to fetch WOM player details:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLinkAccount = async () => {
    if (!username.trim()) {
      setLinkError("Please enter a RuneScape username")
      return
    }

    setIsLinking(true)
    setLinkError(null)

    try {
      const result = await linkWomAccount(userId, username.trim())
      if (result.success) {
        fetchPlayerDetails()
      } else {
        setLinkError(result.error || "Failed to link account")
      }
    } catch (error) {
      setLinkError("An unexpected error occurred")
      console.error(error)
    } finally {
      setIsLinking(false)
    }
  }

  const handleRefreshStats = async () => {
    if (!runescapeName) return

    setIsRefreshing(true)
    try {
      await refreshWomPlayerStats(runescapeName)
      await fetchPlayerDetails()
    } catch (error) {
      console.error("Failed to refresh stats:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  if (!womLinked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Wise Old Man Integration
          </CardTitle>
          <CardDescription>
            Link your RuneScape account to Wise Old Man for enhanced tracking and auto-verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Enter your RuneScape username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Button onClick={handleLinkAccount} disabled={isLinking}>
                {isLinking ? "Linking..." : "Link Account"}
              </Button>
            </div>
            {linkError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{linkError}</AlertDescription>
              </Alert>
            )}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Why link your account?</AlertTitle>
              <AlertDescription>
                Linking to Wise Old Man allows for automatic verification of bingo tiles, tracking your progress, and
                competing with other players in events.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Wise Old Man Stats
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefreshStats}
            disabled={isRefreshing}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
        <CardDescription>Stats and achievements for {runescapeName}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="achievements">Achievements</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4 pt-4">
              {playerDetails ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 p-4 border rounded-md">
                      <span className="text-sm text-muted-foreground">Account Type</span>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium capitalize">{playerDetails.type || "Regular"}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 p-4 border rounded-md">
                      <span className="text-sm text-muted-foreground">Combat Level</span>
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-red-500" />
                        <span className="font-medium">{playerDetails.combatLevel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 p-4 border rounded-md">
                      <span className="text-sm text-muted-foreground">Total Level</span>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="font-medium">
                          {playerDetails.latestSnapshot?.data?.skills?.overall?.level || "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 p-4 border rounded-md">
                      <span className="text-sm text-muted-foreground">Total XP</span>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">
                          {playerDetails.exp ? (playerDetails.exp / 1000000).toFixed(2) + "M" : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 p-4 border rounded-md">
                    <span className="text-sm text-muted-foreground">Last Updated</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {playerDetails.updatedAt ? new Date(playerDetails.updatedAt).toLocaleString() : "Never"}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No data available</AlertTitle>
                  <AlertDescription>
                    We couldn't find your data on Wise Old Man. Try refreshing your stats.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
            <TabsContent value="skills" className="pt-4">
              {playerDetails?.latestSnapshot ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {Object.entries(playerDetails.latestSnapshot.data.skills || {}).map(([skill, data]) => (
                    <div key={skill} className="flex flex-col p-3 border rounded-md">
                      <span className="text-sm font-medium capitalize">{skill.replace("_", " ")}</span>
                      <div className="flex items-center justify-between mt-1">
                        <Badge variant="outline">Level {data.level}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {(data.experience / 1000000).toFixed(2)}M XP
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No skill data available</AlertTitle>
                  <AlertDescription>Try refreshing your stats to see your skill levels.</AlertDescription>
                </Alert>
              )}
            </TabsContent>
            <TabsContent value="achievements" className="pt-4">
              {playerDetails?.achievements?.length ? (
                <div className="space-y-3">
                  {playerDetails.achievements.slice(0, 5).map((achievement, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-md">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-medium">{achievement.name}</span>
                        <span className="text-xs text-muted-foreground">
                          Achieved on {new Date(achievement.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No achievements yet</AlertTitle>
                  <AlertDescription>Keep playing to unlock achievements that will be tracked here.</AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm" asChild>
          <a
            href={`https://wiseoldman.net/players/${encodeURIComponent(runescapeName || "")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View Full Profile
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}

