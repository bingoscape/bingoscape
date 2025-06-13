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
import { Pencil, X, Zap, EyeOff, Search, ExternalLink } from "lucide-react"
import Markdown from "react-markdown"
import { Switch } from "@/components/ui/switch"
import { ProgressSlider } from "./progress-slider"
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

type EditableTileFields = {
  title: string
  description: string
  weight: number
  headerImage: string
  isHidden: boolean
}

interface TileDetailsTabProps {
  selectedTile: Tile | null
  editedTile: Partial<Tile>
  userRole: "admin" | "management" | "participant"
  teams: Team[]
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
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

  const canUpdateProgress = userRole === "admin" || userRole === "management"

  return (
    <div className="space-y-8">
      {teams.map((team) => (
        <div key={team.id} className="border rounded-lg p-4 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="h-3 w-3 rounded-full"
              style={{
                backgroundColor: `hsl(${(team.name.charCodeAt(0) * 10) % 360}, 70%, 50%)`,
              }}
            />
            <h4 className="font-semibold text-lg">{team.name}</h4>
          </div>

          <div className="space-y-5">
            {selectedTile.goals?.map((goal) => {
              const teamProgress = goal.teamProgress?.find((progress) => progress.teamId === team.id)
              const currentValue = teamProgress?.currentValue ?? 0
              const progressPercentage = (currentValue / goal.targetValue) * 100

              return (
                <div key={goal.id} className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <div className="font-medium">{goal.description}</div>
                    <div className="text-muted-foreground">
                      Target: <span className="font-medium">{goal.targetValue}</span>
                    </div>
                  </div>

                  {canUpdateProgress ? (
                    <div className="bg-muted/30 p-3 rounded-md">
                      <ProgressSlider
                        goalId={goal.id}
                        teamId={team.id}
                        currentValue={currentValue}
                        maxValue={goal.targetValue}
                        onUpdateProgress={onUpdateProgress}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Progress
                          value={progressPercentage}
                          className="h-2.5 flex-1"
                          aria-label={`Progress for ${team.name} on ${goal.description}`}
                        />
                        <span className="text-sm font-medium min-w-[80px] text-right">
                          {currentValue} / {goal.targetValue}
                        </span>
                      </div>

                      <div className="text-xs text-right text-muted-foreground">
                        {progressPercentage.toFixed(0)}% complete
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Summary section */}
          <div className="mt-4 pt-3 border-t">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">Overall completion</span>
              <span className="text-muted-foreground">
                {
                  (selectedTile.goals ?? []).filter((goal) => {
                    const teamProgress = goal.teamProgress?.find((p) => p.teamId === team.id)
                    return teamProgress?.currentValue === goal.targetValue
                  }).length
                }{" "}
                of {(selectedTile.goals ?? []).length} goals
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
