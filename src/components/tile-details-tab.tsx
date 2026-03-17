/* eslint-disable */
"use client"

import { useCallback } from "react"
import { useState, useEffect } from "react"
import type React from "react"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ForwardRefEditor } from "./forward-ref-editor"
import type { Tile, Team } from "@/app/actions/events"
import { Progress } from "@/components/ui/progress"
import { AnimatedProgress } from "@/components/ui/animated-progress"
import {
  Pencil,
  X,
  Zap,
  EyeOff,
  Search,
  ExternalLink,
  CheckCircle2,
  Clock,
  Network,
  List,
  Package,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import getRandomFrog from "@/lib/getRandomFrog"
import { GoalProgressTree } from "./goal-progress-tree"
import { getGoalTreeWithProgress } from "@/app/actions/goal-groups"

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
  gameType: "osrs" | "rs3"
  isProgressionBingo?: boolean
  onEditTile: <K extends keyof EditableTileFields>(
    field: K,
    value: EditableTileFields[K]
  ) => void
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
  gameType,
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

  // Helper to get wiki API URL based on game type
  const getWikiApiUrl = useCallback(() => {
    return gameType === "osrs"
      ? "https://oldschool.runescape.wiki/api.php"
      : "https://runescape.wiki/api.php"
  }, [gameType])

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

  const searchOSRSWikiImages = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchResults([])

    try {
      const wikiApiUrl = getWikiApiUrl()
      // Using the Wiki API to search for images
      const apiUrl = `${wikiApiUrl}?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&srnamespace=6&format=json&origin=*`
      const response = await fetch(apiUrl)

      const data = await response.json()

      if (data.query && data.query.search) {
        const imagePromises = data.query.search.map(async (result: any) => {
          const title = result.title.replace("File:", "")

          // Get image info including URL
          const imageInfoResponse = await fetch(
            `${wikiApiUrl}?action=query&titles=${encodeURIComponent(
              result.title
            )}&prop=imageinfo&iiprop=url|thumburl&iiurlwidth=100&format=json&origin=*`
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

        const images = (await Promise.all(imagePromises)).filter(
          Boolean
        ) as WikiImage[]
        setSearchResults(images)
      }
    } catch (error) {
      console.error("Error searching Wiki:", error)
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
    <div className="max-h-[60vh] space-y-6 overflow-y-auto bg-background pr-4 text-foreground">
      <div className="space-y-6 p-4">
        <div className="flex flex-col items-start gap-6 md:flex-row">
          <div className="relative aspect-square w-full md:w-1/3">
            {isEditing && imagePreview && isValidImage ? (
              <Image
                src={imagePreview || getRandomFrog()}
                alt="Header image preview"
                fill
                className="rounded-md object-contain"
              />
            ) : selectedTile?.headerImage &&
              isValidImageUrl(selectedTile.headerImage) ? (
              <Image
                src={selectedTile.headerImage || getRandomFrog()}
                alt={selectedTile.title}
                fill
                className="rounded-md object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-md bg-gray-200">
                <span className="text-gray-400">
                  {isEditing && !isValidImage
                    ? "Invalid image URL"
                    : "No image"}
                </span>
              </div>
            )}
          </div>
          <div className="w-full space-y-4 md:w-2/3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selectedTile?.title}</h3>
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
                      className="block text-sm font-medium text-gray-700"
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
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label htmlFor="xp" className="block text-sm font-medium">
                        XP
                      </label>
                      <div className="relative mt-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Zap className="h-4 w-4 text-gray-400" />
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
                        className="text-sm font-medium text-gray-700"
                      >
                        Hide Tile on Board
                      </label>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="headerImage"
                      className="block text-sm font-medium text-gray-700"
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
                          className={`${!isValidImage && editedTile.headerImage ? "border-red-500" : ""}`}
                        />
                        {!isValidImage && editedTile.headerImage && (
                          <p className="mt-1 text-sm text-red-500">
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

                          <ScrollArea className="h-[300px] rounded-md border p-2">
                            {searchResults.length === 0 && !isSearching ? (
                              <div className="flex h-full items-center justify-center text-gray-500">
                                {searchQuery
                                  ? "No results found"
                                  : "Search for OSRS images"}
                              </div>
                            ) : (
                              <div className="grid grid-cols-3 gap-3">
                                {searchResults.map((image) => (
                                  <div
                                    key={image.title}
                                    className={`cursor-pointer rounded-md border p-2 transition-colors hover:bg-gray-100 ${selectedImage?.url === image.url ? "ring-2 ring-primary" : ""} `}
                                    onClick={() => handleImageSelect(image)}
                                  >
                                    <div className="relative mb-1 aspect-square">
                                      <Image
                                        src={image.thumbnail || getRandomFrog()}
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
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>

                          <DialogFooter className="flex items-center justify-between">
                            <a
                              href="https://oldschool.runescape.wiki/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-gray-500"
                            >
                              Images from OSRS Wiki
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <div className="flex gap-2">
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
                      className="block text-sm font-medium text-gray-700"
                    >
                      Description
                    </label>
                    <div className="mt-1 rounded-md border">
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
                    <div className="flex items-center gap-2 rounded-md px-3 py-1.5">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span className="font-medium">
                        {selectedTile?.weight} XP
                      </span>
                    </div>
                    {selectedTile?.isHidden && (
                      <div className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1.5 text-gray-500">
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
          <h3 className="mb-4 text-lg font-semibold">Team Progress</h3>
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
  const [teamTreeData, setTeamTreeData] = useState<
    Map<string, { tree: any[]; teamProgress: any[] }>
  >(new Map())

  useEffect(() => {
    if (!selectedTile?.id) return

    // Load tree data for all teams
    const loadTreeData = async () => {
      const newData = new Map()
      for (const team of teams) {
        const data = await getGoalTreeWithProgress(selectedTile.id, team.id)
        newData.set(team.id, data)
      }
      setTeamTreeData(newData)
    }

    void loadTreeData()
  }, [
    selectedTile?.id,
    teams,
    selectedTile?.teamTileSubmissions,
    selectedTile?.goals,
  ])

  if (!selectedTile?.goals || selectedTile.goals.length === 0) {
    return (
      <div className="rounded-lg bg-muted/30 py-6 text-center">
        <p className="text-muted-foreground">
          No goals have been set for this tile yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* <h4 className="font-semibold text-lg">Team Progress</h4> */}

      <div className="space-y-6">
        {teams.map((team) => {
          const data = teamTreeData.get(team.id)
          if (!data) return null

          const teamColor = `hsl(${(team.name.charCodeAt(0) * 10) % 360}, 70%, 50%)`

          return (
            <GoalProgressTree
              key={team.id}
              tree={data.tree}
              teamId={team.id}
              teamProgress={data.teamProgress}
              teamName={team.name}
              teamColor={teamColor}
            />
          )
        })}
      </div>
    </div>
  )
}
