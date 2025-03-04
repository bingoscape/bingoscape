import { useCallback } from "react"
import { useState } from "react"
import type React from "react"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ForwardRefEditor } from "./forward-ref-editor"
import type { Tile, Team } from "@/app/actions/events"
import { Progress } from "@/components/ui/progress"
import { Pencil, X, Zap, EyeOff } from "lucide-react"
import Markdown from "react-markdown"
import { Switch } from "@/components/ui/switch"
import { ProgressSlider } from "./progress-slider"

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

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
      <div className="space-y-6 p-4">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3 relative aspect-square">
            {isEditing && imagePreview && isValidImage ? (
              <Image
                src={imagePreview || "/placeholder.svg"}
                alt="Header image preview"
                fill
                className="object-contain rounded-md"
              />
            ) : selectedTile?.headerImage && isValidImageUrl(selectedTile.headerImage) ? (
              <Image
                src={selectedTile.headerImage || "/placeholder.svg"}
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
                      <label htmlFor="xp" className="block text-sm font-medium text-gray-700">
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
                        Hidden
                      </label>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="headerImage" className="block text-sm font-medium text-gray-700">
                      Header Image URL
                    </label>
                    <Input
                      id="headerImage"
                      value={editedTile.headerImage ?? ""}
                      onChange={handleHeaderImageChange}
                      onPaste={handleHeaderImagePaste}
                      className={`mt-1 ${!isValidImage && editedTile.headerImage ? "border-red-500" : ""}`}
                    />
                    {!isValidImage && editedTile.headerImage && (
                      <p className="mt-1 text-sm text-red-500">
                        Please enter a valid image URL (starting with http:// or https://)
                      </p>
                    )}
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
  if (!selectedTile?.goals) return null

  const canUpdateProgress = userRole === "admin" || userRole === "management"

  return (
    <div className="space-y-6">
      {teams.map((team) => (
        <div key={team.id} className="space-y-2">
          <h4 className="font-medium">{team.name}</h4>
          {selectedTile.goals?.map((goal) => {
            const teamProgress = goal.teamProgress.find((progress) => progress.teamId === team.id)
            const currentValue = teamProgress?.currentValue ?? 0
            return (
              <div key={goal.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{goal.description}</span>
                </div>
                {canUpdateProgress ? (
                  <ProgressSlider
                    goalId={goal.id}
                    teamId={team.id}
                    currentValue={currentValue}
                    maxValue={goal.targetValue}
                    onUpdateProgress={onUpdateProgress}
                  />
                ) : (
                  <div className="flex flex-col space-y-1">
                    <Progress
                      value={(currentValue / goal.targetValue) * 100}
                      className="h-2"
                      aria-label={`Progress for ${team.name} on ${goal.description}`}
                    />
                    <span className="self-end ml-2 text-sm">
                      {currentValue} / {goal.targetValue}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

