import React from 'react'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, Check, Clock, X } from 'lucide-react'
import { type Tile, type Team } from '@/app/actions/events'

interface SubmissionsTabProps {
  selectedTile: Tile | null
  currentTeamId: string | undefined
  teams: Team[]
  hasSufficientRights: boolean
  selectedImage: File | null
  pastedImage: File | null
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onImageSubmit: () => void
  onFullSizeImageView: (src: string, alt: string) => void
  onTeamTileSubmissionStatusUpdate: (teamTileSubmissionId: string | undefined, newStatus: 'accepted' | 'requires_interaction' | 'declined') => void
}

export function SubmissionsTab({
  selectedTile,
  currentTeamId,
  teams,
  hasSufficientRights,
  selectedImage,
  pastedImage,
  onImageChange,
  onImageSubmit,
  onFullSizeImageView,
  onTeamTileSubmissionStatusUpdate
}: SubmissionsTabProps) {
  if (!selectedTile) {
    return <p>No tile selected</p>
  }

  const teamSubmissions = selectedTile.teamTileSubmissions?.find(tts => tts.teamId === currentTeamId)?.submissions ?? []

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
      <h3 className="text-lg font-semibold sticky top-0 bg-background z-10 py-2">Submissions</h3>
      {currentTeamId ? (
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer"
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <p>Click to select an image or paste an image here</p>
            {(selectedImage ?? pastedImage) && (
              <p className="mt-2 text-sm text-green-600">Image ready to submit</p>
            )}
          </div>
          <Input
            id="file-input"
            type="file"
            accept="image/*"
            onChange={onImageChange}
            className="hidden"
          />
          <Button onClick={onImageSubmit} disabled={!selectedImage && !pastedImage}>
            <Upload className="mr-2 h-4 w-4" />
            Submit Image
          </Button>
          <div className="grid grid-cols-2 gap-4">
            {teamSubmissions.map(submission => (
              <div key={submission.id} className="border rounded-md p-4">
                <div className="relative w-full h-48">
                  <Image
                    src={submission.image.path}
                    alt={`Submission for ${selectedTile.title}`}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-md cursor-pointer"
                    onClick={() => onFullSizeImageView(submission.image.path, `Submission for ${selectedTile.title}`)}
                  />
                </div>
                <p className="mt-2 text-sm">Submitted: {new Date(submission.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p>You need to be part of a team to submit images.</p>
      )}

      {hasSufficientRights && (
        <div className="mt-8 space-y-4">
          <h4 className="text-lg font-semibold sticky top-12 bg-background z-10 py-2">All Team Submissions</h4>
          {teams.map(team => {
            const teamTileSubmission = selectedTile?.teamTileSubmissions?.find(tts => tts.teamId === team.id)
            const hasSubmissions = teamTileSubmission?.submissions.length ?? 0 > 0
            return (
              <div key={team.id} className="space-y-2">
                <h5 className="font-medium sticky top-24 bg-background z-10 py-2">{team.name}</h5>
                <div className="flex items-center space-x-2 mb-2 sticky top-32 bg-background z-10 py-2">
                  <p className="text-sm">Status: {teamTileSubmission?.status ?? 'No submission'}</p>
                  {hasSubmissions && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, 'accepted')}
                      >
                        <Check className="h-4 w-4 text-green-500" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, 'requires_interaction')}
                      >
                        <Clock className="h-4 w-4 text-yellow-500" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, 'declined')}
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {teamTileSubmission?.submissions.map(submission => (
                    <div key={submission.id} className="border rounded-md p-4">
                      <Image
                        src={submission.image.path}
                        alt={`Submission for ${selectedTile?.title} by ${team.name}`}
                        width={200}
                        height={200}
                        className="object-cover rounded-md cursor-pointer"
                        onClick={() => onFullSizeImageView(submission.image.path, `Submission for ${selectedTile?.title} by ${team.name}`)}
                      />
                      <p className="mt-2 text-sm">Submitted: {new Date(submission.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
