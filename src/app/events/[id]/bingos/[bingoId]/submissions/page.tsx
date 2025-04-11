/* eslint-disable */
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getEventById, getUserRole } from "@/app/actions/events"
import { getTeamsByEventId } from "@/app/actions/team"
import { getAllSubmissionsForTeam, updateTeamTileSubmissionStatus, deleteSubmission, getBingoById, BingoData, TileData } from "@/app/actions/bingo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { ArrowLeft, Check, RefreshCw, X, AlertTriangle, Search, Clock, Award } from "lucide-react"
import { FullSizeImageDialog } from "@/components/full-size-image-dialog"
import type { Tile, TeamTileSubmission } from "@/app/actions/events"

export default function BingoSubmissionsPage({ params }: { params: { id: string; bingoId: string } }) {
  const { id: eventId, bingoId } = params
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [bingo, setBingo] = useState<BingoData | null>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<"participant" | "management" | "admin" | null>(null)
  const [tiles, setTiles] = useState<TileData[]>([])
  const [tileSubmissions, setTileSubmissions] = useState<Record<string, TeamTileSubmission[]>>({})
  const [fullSizeImage, setFullSizeImage] = useState<{ src: string; alt: string } | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("pending")
  const [searchQuery, setSearchQuery] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [eventData, teamsData, userRoleData, bingoData] = await Promise.all([
          getEventById(eventId),
          getTeamsByEventId(eventId),
          getUserRole(eventId),
          getBingoById(bingoId),
        ])

        if (!eventData || !bingoData) {
          router.push(`/events/${eventId}`)
          return
        }

        setBingo(bingoData)
        setTiles(bingoData.tiles || [])
        setTeams(teamsData)
        setUserRole(userRoleData)

        // Set the first team as selected by default
        if (teamsData.length > 0 && !selectedTeamId) {
          setSelectedTeamId(teamsData[0]!.id)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to fetch data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
      .then(() => console.log("Data fetched"))
      .catch((error) => console.error("Error fetching data:", error))
  }, [eventId, bingoId, router, selectedTeamId, refreshKey])

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!selectedTeamId) return

      try {
        setLoading(true)
        // Use the new server action to fetch all submissions for the team in one request
        const submissionsMap = await getAllSubmissionsForTeam(bingoId, selectedTeamId)
        setTileSubmissions(submissionsMap)
      } catch (error) {
        console.error("Error fetching submissions:", error)
        toast({
          title: "Error",
          description: "Failed to fetch submissions",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchSubmissions()
      .then(() => console.log("Submissions fetched"))
      .catch((error) => console.error("Error fetching submissions:", error))
  }, [bingoId, selectedTeamId, refreshKey])

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId)
  }

  const handleStatusUpdate = async (
    teamTileSubmissionId: string,
    newStatus: "accepted" | "requires_interaction" | "declined",
  ) => {
    try {
      const result = await updateTeamTileSubmissionStatus(teamTileSubmissionId, newStatus)
      if (result.success) {
        // Update local state
        const updatedSubmissions = { ...tileSubmissions }

        Object.keys(updatedSubmissions).forEach((tileId) => {
          updatedSubmissions[tileId] = updatedSubmissions[tileId]!.map((sub) =>
            sub.id === teamTileSubmissionId ? { ...sub, status: newStatus } : sub,
          )
        })

        setTileSubmissions(updatedSubmissions)

        toast({
          title: "Status updated",
          description: `Submission marked as ${newStatus.replace("_", " ")}`,
        })
      } else {
        throw new Error(result.error || "Failed to update status")
      }
    } catch (error) {
      console.error("Error updating submission status:", error)
      toast({
        title: "Error",
        description: "Failed to update submission status",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSubmission = async (submissionId: string) => {
    if (!confirm("Are you sure you want to delete this submission?")) return

    try {
      const result = await deleteSubmission(submissionId)
      if (result.success) {
        // Refresh submissions after deletion
        setRefreshKey((prev) => prev + 1)

        toast({
          title: "Submission deleted",
          description: "The submission has been successfully deleted.",
        })
      } else {
        throw new Error((result as { error: string }).error ?? "Failed to delete submission")
      }
    } catch (error) {
      console.error("Error deleting submission:", error)
      toast({
        title: "Error",
        description: "Failed to delete submission",
        variant: "destructive",
      })
    }
  }

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-green-500">Accepted</Badge>
      case "declined":
        return <Badge className="bg-red-500">Declined</Badge>
      case "requires_interaction":
        return <Badge className="bg-yellow-500">Requires Interaction</Badge>
      default:
        return <Badge className="bg-blue-500">Pending</Badge>
    }
  }

  const getDifficultyBadge = (difficulty?: string) => {
    if (!difficulty) return null

    switch (difficulty.toLowerCase()) {
      case "easy":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
            Easy
          </Badge>
        )
      case "medium":
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
            Medium
          </Badge>
        )
      case "hard":
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
            Hard
          </Badge>
        )
      default:
        return <Badge variant="outline">{difficulty}</Badge>
    }
  }

  const filteredTiles = tiles.filter((tile) => {
    // Only include tiles that have submissions for the selected team
    return (tileSubmissions[tile.id] ?? []).length > 0
  })

  const filteredSubmissions = (tileId: string) => {
    if (!tileSubmissions[tileId]) return []

    return tileSubmissions[tileId].filter((submission) => {
      // Filter by status
      if (submission.status !== statusFilter) {
        return false
      }

      // Filter by search query (tile title or submission details)
      if (searchQuery) {
        const tile = tiles.find((t) => t.id === tileId)
        const tileTitle = tile?.title?.toLowerCase() || ""
        const tileContent = tile?.description?.toLowerCase() || ""
        return tileTitle.includes(searchQuery.toLowerCase()) || tileContent.includes(searchQuery.toLowerCase())
      }

      return true
    })
  }

  if (loading && !bingo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-6 w-full mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
        </div>
      </div>
    )
  }

  const isAdminOrManagement = userRole === "admin" || userRole === "management"
  const selectedTeam = teams.find((team) => team.id === selectedTeamId)

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/events/${eventId}/bingos/${bingoId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">{bingo?.title} - Team Submissions</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-muted/30 p-4 rounded-lg">
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <Select value={selectedTeamId || ""} onValueChange={handleTeamChange}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Select Team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="requires_interaction">Requires Interaction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tiles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-full md:w-[250px]"
              />
            </div>
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "grid" | "list")} className="w-auto">
              <TabsList className="h-9">
                <TabsTrigger value="grid" className="px-3">
                  <div className="grid grid-cols-2 gap-0.5 h-4 w-4">
                    <div className="bg-current rounded-sm"></div>
                    <div className="bg-current rounded-sm"></div>
                    <div className="bg-current rounded-sm"></div>
                    <div className="bg-current rounded-sm"></div>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="list" className="px-3">
                  <div className="flex flex-col gap-0.5 h-4 w-4 justify-center">
                    <div className="h-0.5 bg-current rounded-sm"></div>
                    <div className="h-0.5 bg-current rounded-sm"></div>
                    <div className="h-0.5 bg-current rounded-sm"></div>
                  </div>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {selectedTeam && (
          <div className="bg-muted/20 p-3 rounded-md flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Award className="h-3 w-3" />
              </div>
              <span className="font-medium">{selectedTeam.name}</span>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="text-sm text-muted-foreground">
              {filteredTiles.length} {filteredTiles.length === 1 ? "tile" : "tiles"} with submissions
            </div>
          </div>
        )}

        {!selectedTeamId ? (
          <div className="text-center py-8">Please select a team to view submissions</div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
          </div>
        ) : filteredTiles.length === 0 ? (
          <div className="text-center py-8">No submissions found for this team</div>
        ) : (
          <Tabs value={viewMode} className="mt-0">
            <TabsContent value="grid">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTiles.map((tile) => {
                  const submissions = filteredSubmissions(tile.id)
                  if (submissions.length === 0) return null

                  return (
                    <Card key={tile.id} className="overflow-hidden">
                      <CardHeader className="bg-muted/50 pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{tile.title}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              {tile.weight && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Award className="h-3.5 w-3.5" />
                                  <span>{tile.weight} xp</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="font-normal">
                            {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        {tile.description && (
                          <CardDescription className="mt-2 line-clamp-2">{tile.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="p-4">
                        {submissions.map((teamSubmission) => (
                          <div
                            key={teamSubmission.id}
                            className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-b-0"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2">
                                {getStatusBadge(teamSubmission.status)}
                                <span className="text-xs text-muted-foreground">
                                  {new Date(teamSubmission.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              {isAdminOrManagement && (
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleStatusUpdate(teamSubmission.id, "accepted")}
                                    disabled={teamSubmission.status === "accepted"}
                                  >
                                    <Check className="h-4 w-4 text-green-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleStatusUpdate(teamSubmission.id, "requires_interaction")}
                                    disabled={teamSubmission.status === "requires_interaction"}
                                  >
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleStatusUpdate(teamSubmission.id, "declined")}
                                    disabled={teamSubmission.status === "declined"}
                                  >
                                    <X className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {teamSubmission.submissions.map((submission) => (
                                <div key={submission.id} className="relative group">
                                  <img
                                    src={submission.image.path || "/placeholder.svg"}
                                    alt={`Submission for ${tile.title}`}
                                    className="w-full h-24 object-cover rounded-md cursor-pointer"
                                    onClick={() =>
                                      setFullSizeImage({
                                        src: submission.image.path,
                                        alt: `Submission for ${tile.title}`,
                                      })
                                    }
                                  />
                                  {isAdminOrManagement && (
                                    <Button
                                      variant="destructive"
                                      size="icon"
                                      className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleDeleteSubmission(submission.id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>
            <TabsContent value="list">
              <div className="space-y-4">
                {filteredTiles.map((tile) => {
                  const submissions = filteredSubmissions(tile.id)
                  if (submissions.length === 0) return null

                  return (
                    <Card key={tile.id} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {tile.title}
                              <Badge variant="outline" className="font-normal">
                                {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
                              </Badge>
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              {tile.weight && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Award className="h-3.5 w-3.5" />
                                  <span>{tile.weight} xp</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {tile.description && <CardDescription className="mt-2">{tile.description}</CardDescription>}
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          {submissions.map((teamSubmission) => (
                            <div key={teamSubmission.id} className="border rounded-md p-3">
                              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-3">
                                <div className="flex items-center gap-2">
                                  {getStatusBadge(teamSubmission.status)}
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(teamSubmission.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                {isAdminOrManagement && (
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8"
                                      onClick={() => handleStatusUpdate(teamSubmission.id, "accepted")}
                                      disabled={teamSubmission.status === "accepted"}
                                    >
                                      <Check className="h-4 w-4 mr-1 text-green-500" />
                                      Accept
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8"
                                      onClick={() => handleStatusUpdate(teamSubmission.id, "requires_interaction")}
                                      disabled={teamSubmission.status === "requires_interaction"}
                                    >
                                      <AlertTriangle className="h-4 w-4 mr-1 text-yellow-500" />
                                      Needs Review
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8"
                                      onClick={() => handleStatusUpdate(teamSubmission.id, "declined")}
                                      disabled={teamSubmission.status === "declined"}
                                    >
                                      <X className="h-4 w-4 mr-1 text-red-500" />
                                      Decline
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {teamSubmission.submissions.map((submission) => (
                                  <div key={submission.id} className="relative group">
                                    <img
                                      src={submission.image.path || "/placeholder.svg"}
                                      alt={`Submission for ${tile.title}`}
                                      className="w-full h-24 object-cover rounded-md cursor-pointer"
                                      onClick={() =>
                                        setFullSizeImage({
                                          src: submission.image.path,
                                          alt: `Submission for ${tile.title}`,
                                        })
                                      }
                                    />
                                    {isAdminOrManagement && (
                                      <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleDeleteSubmission(submission.id)}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <FullSizeImageDialog
        isOpen={!!fullSizeImage}
        onClose={() => setFullSizeImage(null)}
        imageSrc={fullSizeImage?.src ?? ""}
        imageAlt={fullSizeImage?.alt ?? ""}
      />
    </div>
  )
}
