/* eslint-disable */
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getEventById, getUserRole } from "@/app/actions/events"
import { getTeamsByEventId } from "@/app/actions/team"
import {
  getAllSubmissionsForTeam,
  updateTeamTileSubmissionStatus,
  updateSubmissionStatus,
  deleteSubmission,
  type BingoData,
  type TileData,
} from "@/app/actions/bingo"
import { getBingoById } from "@/app/actions/getBingoById"
import { type TeamTileSubmission } from "@/app/actions/events"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Check,
  RefreshCw,
  AlertTriangle,
  Search,
  Clock,
  Award,
  ChevronDown,
  Filter,
  CircleCheck,
  Circle,
  Link,
  X,
  CheckCircle2,
  Hash,
} from "lucide-react"
import { FullSizeImageDialog } from "@/components/full-size-image-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { InlineGoalAssignment } from "@/components/inline-goal-assignment"
import { getGoalValues } from "@/app/actions/goals"

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
  const [expandedGoalForms, setExpandedGoalForms] = useState<Set<string>>(new Set())
  const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(null)
  const [goalValuesCache, setGoalValuesCache] = useState<Record<string, any[]>>({})

  // Update the statusOptions array to remove "declined" and use new names
  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "needs_review", label: "Needs Review" },
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
  }, [eventId, bingoId, router, refreshKey])

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

  // Update handleTileStatusUpdate function to use new status names
  const handleTileStatusUpdate = async (
    teamTileSubmissionId: string,
    newStatus: "approved" | "needs_review", // removed "declined"
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
          title: "Tile status updated",
          description: `Tile marked as ${newStatus.replace("_", " ")}`,
        })
      } else {
        throw new Error(result.error || "Failed to update team status")
      }
    } catch (error) {
      console.error("Error updating team submission status:", error)
      toast({
        title: "Error",
        description: "Failed to update team submission status",
        variant: "destructive",
      })
    }
  }

  // Update handleSubmissionStatusUpdate function to use new status names
  const handleSubmissionStatusUpdate = async (
    submissionId: string,
    newStatus: "approved" | "needs_review" | "pending",
    goalId?: string | null,
  ) => {
    try {
      const result = await updateSubmissionStatus(submissionId, newStatus, goalId)
      if (result.success) {
        // Update local state
        const updatedSubmissions = { ...tileSubmissions }

        Object.keys(updatedSubmissions).forEach((tileId) => {
          updatedSubmissions[tileId] = updatedSubmissions[tileId]!.map((teamSub) => ({
            ...teamSub,
            submissions: teamSub.submissions.map((sub) =>
              sub.id === submissionId ? { ...sub, status: newStatus, goalId: goalId ?? sub.goalId } : sub,
            ),
          }))
        })

        setTileSubmissions(updatedSubmissions)

        if (goalId !== undefined) {
          toast({
            title: goalId ? "Goal assigned" : "Goal removed",
            description: goalId
              ? "Goal has been assigned to the submission"
              : "Goal has been removed from the submission",
          })
        } else {
          toast({
            title: "Submission status updated",
            description: `Individual submission marked as ${newStatus.replace("_", " ")}`,
          })
        }
      } else {
        throw new Error(result.error || "Failed to update submission status")
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

  // Toggle expanded state for inline goal assignment
  const toggleGoalForm = (submissionId: string) => {
    setExpandedGoalForms((prev) => {
      const next = new Set(prev)
      if (next.has(submissionId)) {
        next.delete(submissionId)
      } else {
        next.add(submissionId)
      }
      return next
    })
  }

  // Handle inline goal assignment
  const handleInlineGoalAssignment = async (submissionId: string, goalId: string | null, value: number | null) => {
    try {
      // Find the current submission to get its status
      let currentStatus = "pending"

      // Look through all tile submissions to find the current status
      Object.keys(tileSubmissions).forEach((tileId) => {
        tileSubmissions[tileId]?.forEach((teamSub) => {
          teamSub.submissions.forEach((sub) => {
            if (sub.id === submissionId) {
              currentStatus = sub.status || "pending"
            }
          })
        })
      })

      const result = await updateSubmissionStatus(
        submissionId,
        currentStatus as "approved" | "needs_review" | "pending",
        goalId,
        value,
      )

      if (result.success) {
        // Update local state
        const updatedSubmissions = { ...tileSubmissions }

        Object.keys(updatedSubmissions).forEach((tileId) => {
          updatedSubmissions[tileId] = updatedSubmissions[tileId]!.map((teamSub) => ({
            ...teamSub,
            submissions: teamSub.submissions.map((sub) =>
              sub.id === submissionId ? { ...sub, goalId, submissionValue: value } : sub,
            ),
          }))
        })

        setTileSubmissions(updatedSubmissions)

        toast({
          title: goalId ? "Goal assigned" : "Goal removed",
          description: goalId
            ? "Goal has been assigned to the submission"
            : "Goal has been removed from the submission",
        })

        // Close the expanded form
        setExpandedGoalForms((prev) => {
          const next = new Set(prev)
          next.delete(submissionId)
          return next
        })
      } else {
        throw new Error(result.error || "Failed to assign goal")
      }
    } catch (error) {
      console.error("Error assigning goal:", error)
      toast({
        title: "Error",
        description: "Failed to assign goal to submission",
        variant: "destructive",
      })
    }
  }

  // Load goal values for a specific goal
  const loadGoalValues = async (goalId: string, tileId: string) => {
    if (!goalValuesCache[goalId]) {
      try {
        const values = await getGoalValues(goalId)
        setGoalValuesCache((prev) => ({ ...prev, [goalId]: values }))
      } catch (error) {
        console.error("Failed to load goal values:", error)
      }
    }
  }

  // Add this helper function to find a tile by ID
  const findTileById = (tileId: string) => {
    return tiles.find((tile) => tile.id === tileId)
  }

  // Add this helper function to get goals for a tile
  const getTileGoals = (tileId: string) => {
    const tile = findTileById(tileId)
    return tile?.goals || []
  }

  // Add this helper function to find the goal description
  const getGoalDescription = (goalId: string | null | undefined, tileId: string) => {
    if (!goalId) return null
    const goals = getTileGoals(tileId)
    return goals.find((goal) => goal.id === goalId)?.description || "Unknown Goal"
  }

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
  }

  // Update getStatusBadge function to use new status names and remove "declined"
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500 text-white">
            <Check className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      case "needs_review":
        return (
          <Badge className="bg-yellow-500 text-white">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Needs Review
          </Badge>
        )
      default:
        return (
          <Badge className="bg-blue-500 text-white">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
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

    return tileSubmissionsArray.some((submission) => {
      const teamMatches = selectedTeamIds.includes(submission.teamId)
      const teamStatusMatches = statusFilters.includes(submission.status)
      const hasIndividualSubmissions = submission.submissions.some((individualSub) =>
        statusFilters.includes(individualSub.status || "pending"),
      )

      return teamMatches && (teamStatusMatches || hasIndividualSubmissions)
    })
  })

  const filteredSubmissions = (tileId: string) => {
    const submissions = tileSubmissions[tileId] || []

    return submissions.filter((submission) => {
      // Filter by selected teams
      if (selectedTeamIds.length > 0 && !selectedTeamIds.includes(submission.teamId)) {
        return false
      }

      // Filter by selected statuses (either team status or individual submission status)
      if (statusFilters.length > 0) {
        const teamStatusMatches = statusFilters.includes(submission.status)
        const hasMatchingIndividualSubmissions = submission.submissions.some((individualSub) =>
          statusFilters.includes(individualSub.status || "pending"),
        )

        if (!teamStatusMatches && !hasMatchingIndividualSubmissions) {
          return false
        }
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

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/events/${eventId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">{bingo?.title} - Tile Submissions</h1>
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
                  className="w-full md:w-[250px] justify-between bg-transparent"
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
                          {selectedTeamIds.includes(team.id) ? (
                            <CircleCheck className="mr-2" />
                          ) : (
                            <Circle className="mr-2" />
                          )}
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
                  className="w-full md:w-[250px] justify-between bg-transparent"
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
                          {statusFilters.includes(status.value) ? (
                            <CircleCheck className="mr-2" />
                          ) : (
                            <Circle className="mr-2" />
                          )}
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
          <div className="space-y-6">
            {filteredTiles.map((tile) => {
              const submissions = filteredSubmissions(tile.id)
              if (submissions.length === 0) return null

              return (
                <Card key={tile.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/30 pb-2">
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
                      <div key={teamSubmission.id} className="border rounded-lg overflow-hidden mb-4 last:mb-0">
                        <div className="bg-muted/30 p-4">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{
                                  backgroundColor: `hsl(${(teamSubmission.team?.name?.charCodeAt(0) * 10) % 360 || 0
                                    }, 70%, 50%)`,
                                }}
                              />
                              <h3 className="font-medium">{getTeamName(teamSubmission.teamId)}</h3>
                              {getStatusBadge(teamSubmission.status)}
                            </div>
                            {isAdminOrManagement && (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleTileStatusUpdate(teamSubmission.id, "approved")}
                                  disabled={teamSubmission.status === "approved"}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                  onClick={() => handleTileStatusUpdate(teamSubmission.id, "needs_review")}
                                  disabled={teamSubmission.status === "needs_review"}
                                >
                                  <AlertTriangle className="h-4 w-4 mr-1" />
                                  Needs Review
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {teamSubmission.submissions.length > 0 ? (
                          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {teamSubmission.submissions.map((submission) => (
                              <div key={submission.id} className="border rounded-md overflow-hidden">
                                <div className="relative aspect-video">
                                  <img
                                    src={submission.image.path || "/placeholder.svg"}
                                    alt={`Submission by ${submission.user?.name || "Unknown"}`}
                                    className="w-full h-full object-cover cursor-pointer"
                                    onClick={() =>
                                      setFullSizeImage({
                                        src: submission.image.path,
                                        alt: `Submission by ${submission.user?.name || "Unknown"}`,
                                      })
                                    }
                                  />
                                </div>
                                <div className="p-3 space-y-2">
                                  <div className="flex justify-between items-center">
                                    <div className="text-sm font-medium truncate">
                                      {submission.user?.name || submission.user?.runescapeName || "Unknown"}
                                    </div>
                                    {getStatusBadge(submission.status || "pending")}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(submission.createdAt).toLocaleString()}
                                  </div>

                                  {/* Inline Goal Assignment */}
                                  <InlineGoalAssignment
                                    submissionId={submission.id}
                                    currentGoalId={submission.goalId}
                                    currentValue={submission.submissionValue}
                                    goals={getTileGoals(tile.id)}
                                    goalValues={goalValuesCache[submission.goalId || ""] || []}
                                    onAssign={(goalId, value) =>
                                      handleInlineGoalAssignment(submission.id, goalId, value)
                                    }
                                    hasSufficientRights={isAdminOrManagement}
                                    isExpanded={expandedGoalForms.has(submission.id)}
                                    onToggle={() => toggleGoalForm(submission.id)}
                                  />
                                </div>

                                {isAdminOrManagement && (
                                  <div className="flex justify-end gap-1 mt-2 pt-2 border-t">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                            onClick={() => handleSubmissionStatusUpdate(submission.id, "approved")}
                                            disabled={submission.status === "approved"}
                                          >
                                            <Check className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Approve Submission</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                            onClick={() => handleSubmissionStatusUpdate(submission.id, "needs_review")}
                                            disabled={submission.status === "needs_review"}
                                          >
                                            <AlertTriangle className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Mark as Needs Review</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <AlertDialog
                                      open={submissionToDelete === submission.id}
                                      onOpenChange={(open) => !open && setSubmissionToDelete(null)}
                                    >
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <AlertDialogTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => setSubmissionToDelete(submission.id)}
                                              >
                                                <X className="h-4 w-4" />
                                              </Button>
                                            </AlertDialogTrigger>
                                          </TooltipTrigger>
                                          <TooltipContent>Delete Submission</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Submission</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete this submission? This action cannot be
                                            undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => {
                                              handleDeleteSubmission(submission.id)
                                              setSubmissionToDelete(null)
                                            }}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-muted-foreground">No submissions yet</div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            })}
          </div>
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
