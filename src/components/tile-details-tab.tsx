import React, { useState, useCallback } from 'react'
import Image from 'next/image'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ForwardRefEditor } from './forward-ref-editor'
import { type Tile, type Team } from '@/app/actions/events'
import { Progress } from "@/components/ui/progress"
import { Pencil, X } from 'lucide-react'
import Markdown from 'react-markdown'

// Define a type for the editable fields of a Tile
type EditableTileFields = {
  title: string;
  description: string;
  weight: number;
  headerImage: string;
}

interface TileDetailsTabProps {
  selectedTile: Tile | null
  editedTile: Partial<Tile>
  userRole: 'admin' | 'management' | 'participant'
  teams: Team[]
  onEditTile: <K extends keyof EditableTileFields>(field: K, value: EditableTileFields[K]) => void
  onUpdateTile: () => void
  onEditorChange: (content: string) => void
}

function isValidImageUrl(url: string): boolean {
  try {
    const res = new URL(url);
    return !!res
  } catch {
    return false;
  }
}

export function TileDetailsTab({
  selectedTile,
  editedTile,
  userRole,
  teams,
  onEditTile,
  onUpdateTile,
  onEditorChange
}: TileDetailsTabProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isValidImage, setIsValidImage] = useState(true)
  const canEdit = userRole === 'admin' || userRole === 'management'

  const toggleEdit = () => {
    setIsEditing(!isEditing)
    if (isEditing) {
      onUpdateTile()
    } else {
      const headerImage = editedTile.headerImage ?? null
      setImagePreview(headerImage)
      setIsValidImage(headerImage ? isValidImageUrl(headerImage) : true)
    }
  }

  const handleHeaderImageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value
    onEditTile('headerImage', newValue)
    setImagePreview(newValue)
    setIsValidImage(isValidImageUrl(newValue))
  }, [onEditTile])

  const handleHeaderImagePaste = useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pastedData = event.clipboardData.getData('text')
    if (pastedData) {
      onEditTile('headerImage', pastedData)
      setImagePreview(pastedData)
      setIsValidImage(isValidImageUrl(pastedData))
    }
  }, [onEditTile])

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/3 relative aspect-square">
          {isEditing && imagePreview && isValidImage ? (
            <Image
              src={imagePreview}
              alt="Header image preview"
              fill
              className="object-contain rounded-md"
            />
          ) : selectedTile?.headerImage && isValidImageUrl(selectedTile.headerImage) ? (
            <Image
              src={selectedTile.headerImage}
              alt={selectedTile.title}
              fill
              className="object-contain rounded-md"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 rounded-md flex items-center justify-center">
              <span className="text-gray-400">
                {isEditing && !isValidImage ? 'Invalid image URL' : 'No image'}
              </span>
            </div>
          )}
        </div>
        <div className="w-full md:w-2/3 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{selectedTile?.title}</h3>
            {canEdit && (
              <Button onClick={toggleEdit} variant="outline" size="sm">
                {isEditing ? <X className="h-4 w-4 mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                {isEditing ? 'Cancel' : 'Edit'}
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
                    value={editedTile.title ?? ''}
                    onChange={(e) => onEditTile('title', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <div className="mt-1 border rounded-md">
                    <ForwardRefEditor
                      onChange={onEditorChange}
                      markdown={editedTile.description ?? ''}
                      contentEditableClassName="prose max-w-full p-2"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="weight" className="block text-sm font-medium text-gray-700">
                    Weight
                  </label>
                  <Input
                    id="weight"
                    type="number"
                    value={editedTile.weight?.toString() ?? ''}
                    onChange={(e) => onEditTile('weight', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="headerImage" className="block text-sm font-medium text-gray-700">
                    Header Image URL
                  </label>
                  <Input
                    id="headerImage"
                    value={editedTile.headerImage ?? ''}
                    onChange={handleHeaderImageChange}
                    onPaste={handleHeaderImagePaste}
                    className={`mt-1 ${!isValidImage && editedTile.headerImage ? 'border-red-500' : ''}`}
                  />
                  {!isValidImage && editedTile.headerImage && (
                    <p className="mt-1 text-sm text-red-500">
                      Please enter a valid image URL (starting with http:// or https://)
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={onUpdateTile}>Save Changes</Button>
              </div>
            </>
          ) : (
            <>
              <p>Weight: {selectedTile?.weight}</p>
              <Markdown>{selectedTile?.description ?? ''}</Markdown>
            </>
          )}
        </div>
      </div>
      <TileProgress selectedTile={selectedTile} teams={teams} />
    </div>
  )
}

function TileProgress({ selectedTile, teams }: { selectedTile: Tile | null, teams: Team[] }) {
  if (!selectedTile?.goals) return null

  return (
    <div className="space-y-6 mt-6">
      <h3 className="text-lg font-semibold">Team Progress</h3>
      {teams.map(team => (
        <div key={team.id} className="space-y-2">
          <h4 className="font-medium">{team.name}</h4>
          {selectedTile.goals?.map(goal => {
            const teamProgress = goal.teamProgress.find(progress => progress.teamId === team.id)
            return (
              <div key={goal.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{goal.description}</span>
                  <span>{teamProgress?.currentValue ?? 0} / {goal.targetValue}</span>
                </div>
                <Progress
                  value={(teamProgress?.currentValue ?? 0) / goal.targetValue * 100}
                  className="h-2"
                  aria-label={`Progress for ${team.name} on ${goal.description}`}
                />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
