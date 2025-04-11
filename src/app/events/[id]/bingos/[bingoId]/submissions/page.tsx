/* eslint-disable */
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getEventById, getUserRole } from "@/app/actions/events"
import { getTeamsByEventId } from "@/app/actions/team"
import {
  getAllSubmissionsForTeam,
  updateTeamTileSubmissionStatus,
  deleteSubmission,
  getBingoById,
  type BingoData,
  type TileData,
} from "@/app/actions/bingo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { ArrowLeft, Check, RefreshCw, X, AlertTriangle, Search, Clock, Award, ChevronDown, Filter } from "lucide-react"
import { FullSizeImageDialog } from "@/components/full-size-image-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Checkbox } from "@/components/ui/checkbox"
import type { TeamTileSubmission } from "@/app/actions/events"

export default function BingoSubmissionsPage({ params }: { params: { id: string; bingoId: string } }) {
  const { id: eventId, bingoId } = params
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [bingo, setBingo] = useState<BingoData | null>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [userRole, setUserRole] = useState<"participant" | "management" | "admin" | null>(null)
  const [tiles, setTiles] = useState<TileData[]>([])
  const [tileSubmissions, setTileSubmissions] = useState<Record<string, TeamTileSubmission[]>>({})
  const [fullSizeImage, setFullSizeImage] = useState<{ src: string; alt: string } | null>(null)
  const [statusFilters, setStatusFilters] = useState<string[]>(["pending"])
  const [searchQuery, setSearchQuery] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [teamsPopoverOpen, setTeamsPopoverOpen] = useState(false)
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false)

  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "accepted", label: "Accepted" },
    { value: "declined", label: "Declined" },
    { value: "requires_interaction", label: "Requires Interaction" },
  ]

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
        if (teamsData.length > 0 && selectedTeamIds.length === 0) {
          setSelectedTeamIds([teamsData[0]!.id])
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
  }, [eventId, bingoId, router, selectedTeamIds.length, refreshKey, teams.length])

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (selectedTeamIds.length === 0) return

      try {
        setLoading(true)
        // Fetch submissions for all selected teams
        const allSubmissions: Record<string, TeamTileSubmission[]> = {}

        await Promise.all(
          selectedTeamIds.map(async (teamId) => {
            const teamSubmissions = await getAllSubmissionsForTeam(bingoId, teamId)

            // Merge the submissions into the allSubmissions object
            Object.keys(teamSubmissions).forEach((tileId) => {
              if (!allSubmissions[tileId]) {
                allSubmissions[tileId] = []
              }

              // Check if teamSubmissions[tileId] exists and is an array before spreading
              const submissionsForTile = teamSubmissions[tileId] || []
              allSubmissions[tileId].push(...submissionsForTile)
            })
          }),
        )

        setTileSubmissions(allSubmissions)
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
  }, [bingoId, selectedTeamIds, refreshKey])

  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeamIds((prev) => {
      if (prev.includes(teamId)) {
        return prev.filter((id) => id !== teamId)
      } else {
        return [...prev, teamId]
      }
    })
  }

  const toggleStatusSelection = (status: string) => {
    setStatusFilters((prev) => {
      if (prev.includes(status)) {
        return prev.filter((s) => s !== status)
      } else {
        return [...prev, status]
      }
    })
  }

  const selectAllTeams = () => {
    setSelectedTeamIds(teams.map((team) => team.id))
  }

  const clearTeamSelection = () => {
    setSelectedTeamIds([])
  }

  const selectAllStatuses = () => {
    setStatusFilters(statusOptions.map((status) => status.value))
  }

  const clearStatusSelection = () => {
    setStatusFilters([])
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

  const getTeamName = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId)
    return team ? team.name : "Unknown Team"
  }

  const filteredTiles = tiles.filter((tile) => {
    // Only include tiles that have submissions for any of the selected teams
    if (selectedTeamIds.length === 0) return false

    const tileSubmissionsArray = tileSubmissions[tile.id] || []

    return tileSubmissionsArray.some(
      (sub) => selectedTeamIds.includes(sub.teamId) && statusFilters.includes(sub.status),
    )
  })

  const filteredSubmissions = (tileId: string) => {
    const submissions = tileSubmissions[tileId] || []

    return submissions.filter((submission) => {
      // Filter by selected teams
      if (selectedTeamIds.length > 0 && !selectedTeamIds.includes(submission.teamId)) {
        return false
      }

      // Filter by selected statuses
      if (statusFilters.length > 0 && !statusFilters.includes(submission.status)) {
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
  const selectedTeamsInfo =
    selectedTeamIds.length === 1 ? { name: getTeamName(selectedTeamIds[0]!) } : { count: selectedTeamIds.length }

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/events/${eventId}`)}>
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
            {/* Teams Multi-select */}
            <Popover open={teamsPopoverOpen} onOpenChange={setTeamsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={teamsPopoverOpen}
                  className="w-full md:w-[250px] justify-between"
                >
                  <div className="flex items-center gap-1 truncate">
                    <span>
                      {selectedTeamIds.length === 0
                        ? "Select Teams"
                        : selectedTeamIds.length === 1
                          ? getTeamName(selectedTeamIds[0]!)
                          : `${selectedTeamIds.length} teams selected`}
                    </span>
                    {selectedTeamIds.length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {selectedTeamIds.length}
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search teams..." />
                  <CommandList>
                    <CommandEmpty>No teams found.</CommandEmpty>
                    <CommandGroup>
                      <div className="p-2 flex items-center justify-between border-b">
                        <Button variant="ghost" size="sm" onClick={selectAllTeams} className="h-8">
                          Select All
                        </Button>
                        <Button variant="ghost" size="sm" onClick={clearTeamSelection} className="h-8">
                          Clear
                        </Button>
                      </div>
                      {teams.map((team) => (
                        <CommandItem
                          key={team.id}
                          onSelect={() => toggleTeamSelection(team.id)}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            checked={selectedTeamIds.includes(team.id)}
                            onCheckedChange={() => toggleTeamSelection(team.id)}
                            className="mr-2"
                          />
                          <span>{team.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Status Multi-select */}
            <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={statusPopoverOpen}
                  className="w-full md:w-[250px] justify-between"
                >
                  <div className="flex items-center gap-1 truncate">
                    <Filter className="h-4 w-4 mr-1" />
                    <span>
                      {statusFilters.length === 0
                        ? "Filter by Status"
                        : statusFilters.length === 1
                          ? statusOptions.find((s) => s.value === statusFilters[0])?.label
                          : `${statusFilters.length} statuses selected`}
                    </span>
                    {statusFilters.length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {statusFilters.length}
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <Command>
                  <CommandList>
                    <CommandGroup>
                      <div className="p-2 flex items-center justify-between border-b">
                        <Button variant="ghost" size="sm" onClick={selectAllStatuses} className="h-8">
                          Select All
                        </Button>
                        <Button variant="ghost" size="sm" onClick={clearStatusSelection} className="h-8">
                          Clear
                        </Button>
                      </div>
                      {statusOptions.map((status) => (
                        <CommandItem
                          key={status.value}
                          onSelect={() => toggleStatusSelection(status.value)}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            checked={statusFilters.includes(status.value)}
                            onCheckedChange={() => toggleStatusSelection(status.value)}
                            className="mr-2"
                          />
                          <span>{status.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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

        {selectedTeamIds.length > 0 && (
          <div className="bg-muted/20 p-3 rounded-md flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Award className="h-3 w-3" />
              </div>
              <span className="font-medium">
                {selectedTeamIds.length === 1
                  ? getTeamName(selectedTeamIds[0]!)
                  : `${selectedTeamIds.length} teams selected`}
              </span>
            </div>
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
            <div className="text-sm text-muted-foreground">
              {filteredTiles.length} {filteredTiles.length === 1 ? "tile" : "tiles"} with submissions
            </div>
            {statusFilters.length > 0 && (
              <>
                <Separator orientation="vertical" className="h-6 hidden sm:block" />
                <div className="flex flex-wrap gap-1">
                  {statusFilters.map((status) => (
                    <Badge key={status} variant="outline" className="text-xs">
                      {statusOptions.find((s) => s.value === status)?.label}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {selectedTeamIds.length === 0 ? (
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
          <div className="text-center py-8">No submissions found for the selected teams and statuses</div>
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
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                {getStatusBadge(teamSubmission.status)}
                                {selectedTeamIds.length > 1 && (
                                  <Badge variant="outline" className="text-xs">
                                    {getTeamName(teamSubmission.teamId)}
                                  </Badge>
                                )}
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
                                <div className="flex flex-wrap items-center gap-2">
                                  {getStatusBadge(teamSubmission.status)}
                                  {selectedTeamIds.length > 1 && (
                                    <Badge variant="outline" className="text-xs">
                                      {getTeamName(teamSubmission.teamId)}
                                    </Badge>
                                  )}
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
