/* eslint-disable */
"use client"

import { useRouter } from "next/navigation"
import { syncTrackerProgress } from "@/app/actions/tracker"
import { searchWikiImages } from "@/app/actions/wiki-image-search"
import { toast } from "@/hooks/use-toast"

import { useCallback, useMemo } from "react"
import { useState } from "react"
import type React from "react"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ForwardRefEditor } from "./forward-ref-editor"

import {
  Pencil,
  X,
  Zap,
  EyeOff,
  Search,
  ExternalLink,
  RefreshCw,
} from "lucide-react"
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
import getRandomFrog from "@/lib/getRandomFrog"
import { GoalProgressTree } from "./goal-progress-tree"
import { CompactGoalTree } from "./compact-goal-tree"
import { buildGoalTree, getTeamGoalProgress } from "@/lib/goal-tree"
import type { Tile, Team } from "@/types/model"
import type { WikiImage } from "@/lib/wiki-image-search"
import { getOptimizedImageUrl } from "@/lib/utils"

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
  /** May edit the Tile and sync tracker data (`board:manage`). */
  canEdit: boolean
  teams: Team[]
  gameType: "osrs" | "rs3"
  eventId?: string
  isProgressionBingo?: boolean
  /**
   * Rendered inside the Tile side panel: the panel header already shows the
   * image and title, and the panel body scrolls, so drop those here.
   */
  embedded?: boolean
  onEditTile: <K extends keyof EditableTileFields>(
    field: K,
    value: EditableTileFields[K]
  ) => void
  onUpdateTile: () => void
  onEditorChange: (content: string) => void
  onUpdateProgress: (goalId: string, teamId: string, newValue: number) => void
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
  canEdit,
  teams,
  gameType,
  eventId,
  isProgressionBingo = false,
  embedded = false,
  onEditTile,
  onUpdateTile,
  onEditorChange,
  onUpdateProgress,
}: TileDetailsTabProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isValidImage, setIsValidImage] = useState(true)

  // Wiki image search
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
    [onEditTile]
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
    [onEditTile]
  )

  const handleIsHiddenChange = useCallback(
    (checked: boolean) => {
      onEditTile("isHidden", checked)
    },
    [onEditTile]
  )

  // The search runs on the server (`searchWikiImages`): cached, rate limited
  // and with the wiki host fixed by the game. The browser never calls the wiki.
  const searchOSRSWikiImages = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchResults([])

    try {
      const result = await searchWikiImages(searchQuery, gameType)
      if (result.success) {
        setSearchResults(result.images)
      } else {
        toast({
          title: "Wiki search failed",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error searching Wiki:", error)
      toast({
        title: "Wiki search failed",
        description: "An unexpected error occurred.",
        variant: "destructive",
      })
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
    <div
      className={
        embedded
          ? "space-y-4 text-foreground"
          : "max-h-[60vh] space-y-6 overflow-y-auto bg-background pr-4 text-foreground"
      }
    >
      <div className={embedded ? "space-y-4" : "space-y-6 p-4"}>
        <div
          className={
            embedded
              ? "flex flex-col items-start gap-4"
              : "flex flex-col items-start gap-6 md:flex-row"
          }
        >
          <div
            className={
              embedded
                ? isEditing
                  ? "relative aspect-square w-32"
                  : "hidden"
                : "relative aspect-square w-full md:w-1/3"
            }
          >
            {isEditing && imagePreview && isValidImage ? (
              <Image
                src={getOptimizedImageUrl(imagePreview)}
                alt="Header image preview"
                fill
                className="rounded-sm object-contain"
              />
            ) : selectedTile?.headerImage &&
              isValidImageUrl(selectedTile.headerImage) ? (
              <Image
                src={getOptimizedImageUrl(
                  selectedTile.headerImage || getRandomFrog()
                )}
                alt={selectedTile.title}
                fill
                className="rounded-sm object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-sm bg-muted">
                <span className="text-muted-foreground">
                  {isEditing && !isValidImage
                    ? "Invalid image URL"
                    : "No image"}
                </span>
              </div>
            )}
          </div>
          <div className={embedded ? "w-full space-y-4" : "w-full space-y-4 md:w-2/3"}>
            <div className="flex items-center justify-between">
              <h3 className={embedded ? "sr-only" : "text-lg font-semibold"}>
                {selectedTile?.title}
              </h3>
              {canEdit && (
                <Button
                  onClick={() => toggleEdit(isEditing)}
                  variant="outline"
                  size="sm"
                >
                  {isEditing ? (
                    <X className="mr-2 h-4 w-4" />
                  ) : (
                    <Pencil className="mr-2 h-4 w-4" />
                  )}
                  {isEditing ? "Cancel" : "Edit"}
                </Button>
              )}
            </div>
            {isEditing ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="title"
                      className="block text-sm font-medium text-muted-foreground"
                    >
                      Title
                    </label>
                    <Input
                      id="title"
                      value={editedTile.title ?? ""}
                      onChange={(e) => onEditTile("title", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 @md:grid-cols-3">
                    <div>
                      <label htmlFor="xp" className="block text-sm font-medium">
                        XP
                      </label>
                      <div className="relative mt-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Zap className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Input
                          id="xp"
                          type="number"
                          value={editedTile.weight?.toString() ?? ""}
                          onChange={(e) =>
                            onEditTile("weight", Number(e.target.value))
                          }
                          className="pl-10"
                        />
                      </div>
                    </div>
                    {isProgressionBingo && (
                      <div>
                        <label
                          htmlFor="tier"
                          className="block text-sm font-medium"
                        >
                          Tier
                        </label>
                        <Input
                          id="tier"
                          type="number"
                          min="0"
                          value={editedTile.tier?.toString() ?? "0"}
                          onChange={(e) =>
                            onEditTile("tier", Number(e.target.value))
                          }
                          className="mt-1"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Tier 0 is unlocked by default
                        </p>
                      </div>
                    )}
                    <div className="flex h-full items-center space-x-2 pt-6">
                      <Switch
                        id="isHidden"
                        checked={editedTile.isHidden ?? false}
                        onCheckedChange={handleIsHiddenChange}
                      />
                      <label
                        htmlFor="isHidden"
                        className="text-sm font-medium text-muted-foreground"
                      >
                        Hide Tile on Board
                      </label>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="headerImage"
                      className="block text-sm font-medium text-muted-foreground"
                    >
                      Header Image URL
                    </label>
                    <div className="mt-1 flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="headerImage"
                          value={editedTile.headerImage ?? ""}
                          onChange={handleHeaderImageChange}
                          onPaste={handleHeaderImagePaste}
                          className={`${!isValidImage && editedTile.headerImage ? "border-destructive" : ""}`}
                        />
                        {!isValidImage && editedTile.headerImage && (
                          <p className="mt-1 text-sm text-danger">
                            Please enter a valid image URL (starting with
                            http:// or https://)
                          </p>
                        )}
                      </div>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="gap-2">
                            <Search className="h-4 w-4" />
                            <span>
                              {gameType === "osrs" ? "OSRS" : "RS3"} Wiki
                            </span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                          <DialogHeader>
                            <DialogTitle>
                              Search {gameType === "osrs" ? "OSRS" : "RS3"} Wiki
                              Images
                            </DialogTitle>
                          </DialogHeader>

                          <div className="my-4 flex gap-2">
                            <Input
                              placeholder="Search for images (e.g., 'abyssal whip')"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && searchOSRSWikiImages()
                              }
                            />
                            <Button
                              onClick={searchOSRSWikiImages}
                              disabled={isSearching}
                            >
                              {isSearching ? "Searching..." : "Search"}
                            </Button>
                          </div>

                          <ScrollArea className="h-[min(300px,40dvh)] rounded-sm border p-2">
                            {searchResults.length === 0 && !isSearching ? (
                              <div className="flex h-full items-center justify-center text-muted-foreground">
                                {searchQuery
                                  ? "No results found"
                                  : "Search for OSRS images"}
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {searchResults.map((image) => (
                                  <button
                                    type="button"
                                    key={image.title}
                                    className={`cursor-pointer rounded-sm border p-2 text-left transition-colors hover:bg-muted ${selectedImage?.url === image.url ? "ring-2 ring-primary" : ""} `}
                                    onClick={() => handleImageSelect(image)}
                                    aria-pressed={selectedImage?.url === image.url}
                                  >
                                    <div className="relative mb-1 aspect-square">
                                      <Image
                                        src={getOptimizedImageUrl(
                                          image.thumbnail || getRandomFrog()
                                        )}
                                        alt={image.title}
                                        fill
                                        className="object-contain"
                                      />
                                    </div>
                                    <p
                                      className="truncate text-xs"
                                      title={image.title}
                                    >
                                      {image.title}
                                    </p>
                                  </button>
                                ))}
                              </div>
                            )}
                          </ScrollArea>

                          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <a
                              href="https://oldschool.runescape.wiki/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-muted-foreground"
                            >
                              Images from OSRS Wiki
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <div className="flex flex-wrap gap-2">
                              <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button
                                  onClick={applySelectedImage}
                                  disabled={!selectedImage}
                                >
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
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-muted-foreground"
                    >
                      Description
                    </label>
                    <div className="mt-1 rounded-sm border">
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
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 rounded-sm px-3 py-1.5">
                      <Zap className="h-4 w-4 text-warning" />
                      <span className="font-medium">
                        {selectedTile?.weight} XP
                      </span>
                    </div>
                    {selectedTile?.isHidden && (
                      <div className="flex items-center gap-2 rounded-sm bg-muted px-3 py-1.5 text-muted-foreground">
                        <EyeOff className="h-4 w-4" />
                        <span className="font-medium">Hidden</span>
                      </div>
                    )}
                  </div>
                  <div className="prose max-w-none break-words [&_img]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto">
                    <Markdown>{selectedTile?.description ?? ""}</Markdown>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className={embedded ? "mt-2" : "mt-6"}>
          <h3 className="mb-4 text-lg font-semibold">Team Progress</h3>
          <TileProgress
            selectedTile={selectedTile}
            teams={teams}
            onUpdateProgress={onUpdateProgress}
            canEdit={canEdit}
            eventId={eventId}
          />
        </div>
      </div>
    </div>
  )
}

function TileProgress({
  selectedTile,
  teams,
  canEdit,
}: {
  selectedTile: Tile | null
  teams: Team[]
  onUpdateProgress: (goalId: string, teamId: string, newValue: number) => void
  canEdit: boolean
  eventId?: string
}) {
  const router = useRouter()
  const [isSyncing, setIsSyncing] = useState(false)

  // The Goal tree and every Team's progress come from the Tile that the Event
  // page already loaded: no client-side fetching.
  const tree = useMemo(
    () => buildGoalTree(selectedTile?.goals, selectedTile?.goalGroups),
    [selectedTile?.goals, selectedTile?.goalGroups]
  )

  if (!selectedTile?.goals || selectedTile.goals.length === 0) {
    return (
      <div className="rounded-sm bg-muted/30 py-6 text-center">
        <p className="text-muted-foreground">
          No goals have been set for this tile yet.
        </p>
      </div>
    )
  }

  // No Team selected (public view): show the Goals without progress.
  if (teams.length === 0) {
    return (
      <CompactGoalTree tree={tree} teamProgress={[]} showProgress={false} />
    )
  }

  const hasMetricGoals = selectedTile?.goals?.some(
    (g: any) => g.goalType === "metric"
  )
  const canSync =
    hasMetricGoals &&
    selectedTile?.bingoId &&
    canEdit

  const handleSync = async () => {
    if (!selectedTile?.bingoId) return
    setIsSyncing(true)

    const { id, update } = toast({
      title: (
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Syncing Tracker Data...</span>
        </div>
      ),
      description:
        "Fetching progress from WiseOldMan. This may take a few seconds.",
      duration: 60000,
    })

    try {
      const result = await syncTrackerProgress(selectedTile.bingoId)
      if (result.success) {
        update({
          id,
          title: "Sync complete",
          description:
            result.message || "Tracker data synchronized successfully.",
          variant: "default",
          duration: 5000,
        })
        router.refresh()
      } else {
        update({
          id,
          title: "Sync failed",
          description: result.error || "Failed to synchronize tracker data.",
          variant: "destructive",
          duration: 5000,
        })
      }
    } catch (error) {
      update({
        id,
        title: "Error",
        description: "An unexpected error occurred during sync.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      {canSync && (
        <div className="flex justify-end">
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            variant="outline"
            size="sm"
          >
            {isSyncing ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {isSyncing ? "Syncing..." : "Sync Tracker Data"}
          </Button>
        </div>
      )}

      <div className="space-y-6">
        {teams.map((team) => {
          const teamColor = `hsl(${(team.name.charCodeAt(0) * 10) % 360}, 70%, 50%)`

          return (
            <GoalProgressTree
              key={team.id}
              tree={tree}
              teamId={team.id}
              teamProgress={getTeamGoalProgress(selectedTile.goals, team.id)}
              teamName={team.name}
              teamColor={teamColor}
            />
          )
        })}
      </div>
    </div>
  )
}
