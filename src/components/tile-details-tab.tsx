/* eslint-disable */
"use client"

import { useCallback } from "react"
import { useState } from "react"
import type React from "react"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ForwardRefEditor } from "./forward-ref-editor"
import type { Tile, Team } from "@/app/actions/events"
import { Progress } from "@/components/ui/progress"
import { AnimatedProgress } from "@/components/ui/animated-progress"
import { Pencil, X, Zap, EyeOff, Search, ExternalLink, CheckCircle2, Clock } from "lucide-react"
import Markdown from "react-markdown"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import getRandomFrog from "@/lib/getRandomFrog"

type EditableTileFields = {
  title: string
  description: string
  weight: number
  headerImage: string
  isHidden: boolean
  tier: number
}

interface TileDetailsTabProps {
  selectedTile: Tile | null
  editedTile: Partial<Tile>
  userRole: "admin" | "management" | "participant"
  teams: Team[]
  isProgressionBingo?: boolean
  onEditTile: <K extends keyof EditableTileFields>(field: K, value: EditableTileFields[K]) => void
  onUpdateTile: () => void
  onEditorChange: (content: string) => void
  onUpdateProgress: (goalId: string, teamId: string, newValue: number) => void
}

interface WikiImage {
  title: string
  url: string
  thumbnail: string
}

interface GoalProgress {
  approved: number
  total: number
}

function isValidImageUrl(url: string): boolean {
  try {
    const res = new URL(url)
    return !!res
  } catch {
    return false
  }
}

export function TileDetailsTab({
  selectedTile,
  editedTile,
  userRole,
  teams,
  isProgressionBingo = false,
  onEditTile,
  onUpdateTile,
  onEditorChange,
  onUpdateProgress,
}: TileDetailsTabProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isValidImage, setIsValidImage] = useState(true)
  const canEdit = userRole === "admin" || userRole === "management"

  // OSRS Wiki image search
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<WikiImage[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedImage, setSelectedImage] = useState<WikiImage | null>(null)

  const toggleEdit = (isCancelled: boolean) => {
    if (isCancelled) {
      setIsEditing(false)
      return
    }
    setIsEditing(!isEditing)
    if (isEditing) {
      onUpdateTile()
    } else {
      const headerImage = editedTile.headerImage ?? null
      setImagePreview(headerImage)
      setIsValidImage(headerImage ? isValidImageUrl(headerImage) : true)
    }
  }

  const handleHeaderImageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value
      onEditTile("headerImage", newValue)
      setImagePreview(newValue)
      setIsValidImage(isValidImageUrl(newValue))
    },
    [onEditTile],
  )

  const handleHeaderImagePaste = useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault()
      const pastedData = event.clipboardData.getData("text")
      if (pastedData) {
        onEditTile("headerImage", pastedData)
        setImagePreview(pastedData)
        setIsValidImage(isValidImageUrl(pastedData))
      }
    },
    [onEditTile],
  )

  const handleIsHiddenChange = useCallback(
    (checked: boolean) => {
      onEditTile("isHidden", checked)
    },
    [onEditTile],
  )

  const searchOSRSWikiImages = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchResults([])

    try {
      // Using the OSRS Wiki API to search for images
      const apiUrl = `https://oldschool.runescape.wiki/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&srnamespace=6&format=json&origin=*`
      const response = await fetch(apiUrl)

      const data = await response.json()

      if (data.query && data.query.search) {
        const imagePromises = data.query.search.map(async (result: any) => {
          const title = result.title.replace("File:", "")

          // Get image info including URL
          const imageInfoResponse = await fetch(
            `https://oldschool.runescape.wiki/api.php?action=query&titles=${encodeURIComponent(
              result.title,
            )}&prop=imageinfo&iiprop=url|thumburl&iiurlwidth=100&format=json&origin=*`,
          )

          const imageData = await imageInfoResponse.json()
          const pages = imageData.query.pages
          const pageId = Object.keys(pages)[0]

          if (pages[pageId!].imageinfo && pages[pageId!].imageinfo[0]) {
            const imageInfo = pages[pageId!].imageinfo[0]
            return {
              title,
              url: imageInfo.url,
              thumbnail: imageInfo.thumburl,
            }
          }
          return null
        })

        const images = (await Promise.all(imagePromises)).filter(Boolean) as WikiImage[]
        setSearchResults(images)
      }
    } catch (error) {
      console.error("Error searching OSRS Wiki:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleImageSelect = (image: WikiImage) => {
    setSelectedImage(image)
  }

  const applySelectedImage = () => {
    if (selectedImage) {
      onEditTile("headerImage", selectedImage.url)
      setImagePreview(selectedImage.url)
      setIsValidImage(true)
      setSelectedImage(null)
    }
  }

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 bg-background text-foreground">
      <div className="space-y-6 p-4">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="w-full md:w-1/3 relative aspect-square">
            {isEditing && imagePreview && isValidImage ? (
              <Image
                src={imagePreview || getRandomFrog()}
                alt="Header image preview"
                fill
                className="object-contain rounded-md"
              />
            ) : selectedTile?.headerImage && isValidImageUrl(selectedTile.headerImage) ? (
              <Image
                src={selectedTile.headerImage || getRandomFrog()}
                alt={selectedTile.title}
                fill
                className="object-contain rounded-md"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 rounded-md flex items-center justify-center">
                <span className="text-gray-400">{isEditing && !isValidImage ? "Invalid image URL" : "No image"}</span>
              </div>
            )}
          </div>
          <div className="w-full md:w-2/3 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">{selectedTile?.title}</h3>
              {canEdit && (
                <Button onClick={() => toggleEdit(isEditing)} variant="outline" size="sm">
                  {isEditing ? <X className="h-4 w-4 mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                  {isEditing ? "Cancel" : "Edit"}
                </Button>
              )}
            </div>
            {isEditing ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      Title
                    </label>
                    <Input
                      id="title"
                      value={editedTile.title ?? ""}
                      onChange={(e) => onEditTile("title", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="xp" className="block text-sm font-medium">
                        XP
                      </label>
                      <div className="mt-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Zap className="h-4 w-4 text-gray-400" />
                        </div>
                        <Input
                          id="xp"
                          type="number"
                          value={editedTile.weight?.toString() ?? ""}
                          onChange={(e) => onEditTile("weight", Number(e.target.value))}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    {isProgressionBingo && (
                      <div>
                        <label htmlFor="tier" className="block text-sm font-medium">
                          Tier
                        </label>
                        <Input
                          id="tier"
                          type="number"
                          min="0"
                          value={editedTile.tier?.toString() ?? "0"}
                          onChange={(e) => onEditTile("tier", Number(e.target.value))}
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Tier 0 is unlocked by default
                        </p>
                      </div>
                    )}
                    <div className="flex items-center space-x-2 h-full pt-6">
                      <Switch
                        id="isHidden"
                        checked={editedTile.isHidden ?? false}
                        onCheckedChange={handleIsHiddenChange}
                      />
                      <label htmlFor="isHidden" className="text-sm font-medium text-gray-700">
                        Hide Tile on Board
                      </label>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="headerImage" className="block text-sm font-medium text-gray-700">
                      Header Image URL
                    </label>
                    <div className="flex mt-1 gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="headerImage"
                          value={editedTile.headerImage ?? ""}
                          onChange={handleHeaderImageChange}
                          onPaste={handleHeaderImagePaste}
                          className={`${!isValidImage && editedTile.headerImage ? "border-red-500" : ""}`}
                        />
                        {!isValidImage && editedTile.headerImage && (
                          <p className="mt-1 text-sm text-red-500">
                            Please enter a valid image URL (starting with http:// or https://)
                          </p>
                        )}
                      </div>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="gap-2">
                            <Search className="h-4 w-4" />
                            <span>OSRS Wiki</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                          <DialogHeader>
                            <DialogTitle>Search OSRS Wiki Images</DialogTitle>
                          </DialogHeader>

                          <div className="flex gap-2 my-4">
                            <Input
                              placeholder="Search for images (e.g., 'abyssal whip')"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && searchOSRSWikiImages()}
                            />
                            <Button onClick={searchOSRSWikiImages} disabled={isSearching}>
                              {isSearching ? "Searching..." : "Search"}
                            </Button>
                          </div>

                          <ScrollArea className="h-[300px] border rounded-md p-2">
                            {searchResults.length === 0 && !isSearching ? (
                              <div className="flex items-center justify-center h-full text-gray-500">
                                {searchQuery ? "No results found" : "Search for OSRS images"}
                              </div>
                            ) : (
                              <div className="grid grid-cols-3 gap-3">
                                {searchResults.map((image) => (
                                  <div
                                    key={image.title}
                                    className={`
                                      border rounded-md p-2 cursor-pointer hover:bg-gray-100 transition-colors
                                      ${selectedImage?.url === image.url ? "ring-2 ring-primary" : ""}
                                    `}
                                    onClick={() => handleImageSelect(image)}
                                  >
                                    <div className="aspect-square relative mb-1">
                                      <Image
                                        src={image.thumbnail || getRandomFrog()}
                                        alt={image.title}
                                        fill
                                        className="object-contain"
                                      />
                                    </div>
                                    <p className="text-xs truncate" title={image.title}>
                                      {image.title}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>

                          <DialogFooter className="flex justify-between items-center">
                            <a
                              href="https://oldschool.runescape.wiki/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-500 flex items-center gap-1"
                            >
                              Images from OSRS Wiki
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <div className="flex gap-2">
                              <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button onClick={applySelectedImage} disabled={!selectedImage}>
                                  Use Selected Image
                                </Button>
                              </DialogClose>
                            </div>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <div className="mt-1 border rounded-md">
                      <ForwardRefEditor
                        onChange={onEditorChange}
                        markdown={editedTile.description ?? ""}
                        contentEditableClassName="prose max-w-full p-2"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={onUpdateTile}>Save Changes</Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span className="font-medium">{selectedTile?.weight} XP</span>
                    </div>
                    {selectedTile?.isHidden && (
                      <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-md text-gray-500">
                        <EyeOff className="h-4 w-4" />
                        <span className="font-medium">Hidden</span>
                      </div>
                    )}
                  </div>
                  <div className="prose max-w-none">
                    <Markdown>{selectedTile?.description ?? ""}</Markdown>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Team Progress</h3>
          <TileProgress
            selectedTile={selectedTile}
            teams={teams}
            onUpdateProgress={onUpdateProgress}
            userRole={userRole}
          />
        </div>
      </div>
    </div>
  )
}

function TileProgress({
  selectedTile,
  teams,
  onUpdateProgress,
  userRole,
}: {
  selectedTile: Tile | null
  teams: Team[]
  onUpdateProgress: (goalId: string, teamId: string, newValue: number) => void
  userRole: "admin" | "management" | "participant"
}) {
  if (!selectedTile?.goals || selectedTile.goals.length === 0) {
    return (
      <div className="text-center py-6 bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">No goals have been set for this tile yet.</p>
      </div>
    )
  }

  // Calculate goal progress based on submissions
  const calculateGoalProgress = (goalId: string, teamId: string): GoalProgress => {
    // Find all submissions for this team and tile
    const teamSubmissions = selectedTile.teamTileSubmissions?.find((tts) => tts.teamId === teamId)
    if (!teamSubmissions) return { approved: 0, total: 0 }

    // Get submissions assigned to this goal
    const goalSubmissions = teamSubmissions.submissions.filter((sub) => sub.goalId === goalId)
    const approvedSubmissions = goalSubmissions.filter((sub) => sub.status === "approved")

    // Sum the submission values instead of counting submissions
    const approvedSum = approvedSubmissions.reduce((sum, sub) => sum + (sub.submissionValue || 0), 0)
    const totalSum = goalSubmissions.reduce((sum, sub) => sum + (sub.submissionValue || 0), 0)

    return {
      approved: approvedSum,
      total: totalSum,
    }
  }

  return (
    <div className="space-y-6">
      {teams.map((team) => {
        const completedGoals = (selectedTile.goals ?? []).filter((goal) => {
          const progress = calculateGoalProgress(goal.id, team.id)
          return progress.approved >= goal.targetValue
        }).length
        const totalGoals = (selectedTile.goals ?? []).length
        const completionPercentage = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0

        return (
          <div key={team.id} className="border border-border rounded-lg p-6 shadow-sm transition-all hover:shadow-md bg-card team-progress-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="h-4 w-4 rounded-full shadow-sm"
                  style={{
                    backgroundColor: `hsl(${(team.name.charCodeAt(0) * 10) % 360}, 70%, 50%)`,
                  }}
                />
                <h4 className="font-semibold text-lg text-foreground">{team.name}</h4>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">
                  {completedGoals} / {totalGoals} goals
                </div>
                <div className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  {completionPercentage.toFixed(0)}% complete
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {selectedTile.goals?.map((goal) => {
                // Get progress based on submissions
                const progress = calculateGoalProgress(goal.id, team.id)
                const approvedProgress = progress.approved
                const totalProgress = progress.total

                // Calculate percentages based on submission values
                const approvedPercentage =
                  goal.targetValue > 0 ? Math.min(100, (approvedProgress / goal.targetValue) * 100) : 0

                const virtualPercentage =
                  goal.targetValue > 0 ? Math.min(100, (totalProgress / goal.targetValue) * 100) : 0

                const isCompleted = approvedProgress >= goal.targetValue

                return (
                  <div key={goal.id} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-foreground">{goal.description}</div>
                        {isCompleted && (
                          <div className="px-2 py-1 bg-green-500 text-foreground text-xs rounded-full font-medium">
                            Completed
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Target: <span className="font-medium text-foreground">{goal.targetValue}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Official Progress (Approved Submissions) */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 min-w-[80px]">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  <span className="text-sm text-muted-foreground">Approved</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Progress based on sum of approved submission values</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <AnimatedProgress
                            value={approvedPercentage}
                            className="h-3 flex-1 bg-muted"
                            indicatorClassName="bg-green-500"
                            aria-label={`Approved progress for ${team.name} on ${goal.description}`}
                          />
                          <span className="text-sm font-medium min-w-[80px] text-right text-foreground">
                            {approvedProgress} / {goal.targetValue}
                          </span>
                        </div>
                        <div className="text-xs text-right text-muted-foreground">
                          {approvedPercentage.toFixed(0)}% complete
                        </div>
                      </div>

                      {/* Virtual Progress (All Submissions) */}
                      {totalProgress > approvedProgress && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 min-w-[80px]">
                                    <Clock className="h-4 w-4 text-yellow-500" />
                                    <span className="text-sm text-muted-foreground">Virtual</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Progress including sum of all submission values (pending and in-review)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <AnimatedProgress
                              value={virtualPercentage}
                              className="h-3 flex-1 bg-muted"
                              indicatorClassName="bg-yellow-500"
                              aria-label={`Virtual progress for ${team.name} on ${goal.description}`}
                            />
                            <span className="text-sm font-medium min-w-[80px] text-right text-foreground">
                              {totalProgress} / {goal.targetValue}
                            </span>
                          </div>
                          <div className="text-xs text-right text-muted-foreground">
                            {virtualPercentage.toFixed(0)}% potential
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary section */}
            {totalGoals > 0 && (
              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-foreground">Overall Progress</span>
                  <div className="flex items-center gap-2">
                    <AnimatedProgress value={completionPercentage} className="h-2 w-24 bg-muted" indicatorClassName="bg-blue-500" />
                    <span className="text-sm font-medium min-w-[40px] text-foreground">
                      {completionPercentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
