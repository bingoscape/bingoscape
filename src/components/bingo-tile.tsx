import React from 'react'
import Image from 'next/image'
import { Check, Clock, X } from 'lucide-react'

interface Submission {
  id: string
  imagePath: string
  createdAt: Date
}

interface TeamTileSubmission {
  id: string
  teamId: string
  teamName: string
  status: 'pending' | 'accepted' | 'requires_interaction' | 'declined'
  submissions: Submission[]
}

interface Tile {
  id: string
  title: string
  headerImage: string | null
  description: string
  weight: number
  index: number
  teamTileSubmissions?: TeamTileSubmission[]
}

interface BingoTileProps {
  tile: Tile
  onClick: (tile: Tile) => void
  userRole: 'participant' | 'management' | 'admin'
  currentTeamId?: string
}

export function BingoTile({ tile, onClick, userRole, currentTeamId }: BingoTileProps) {
  const isManagement = userRole === 'management' || userRole === 'admin'

  const submissionCounts = React.useMemo(() => {
    if (!isManagement || !tile.teamTileSubmissions) return null

    return tile.teamTileSubmissions.reduce(
      (acc, tts) => {
        acc[tts.status]++
        return acc
      },
      { accepted: 0, pending: 0, requires_interaction: 0, declined: 0 }
    )
  }, [isManagement, tile.teamTileSubmissions])

  const currentTeamSubmission = React.useMemo(() => {
    if (!currentTeamId || !tile.teamTileSubmissions) return null
    return tile.teamTileSubmissions.find(tts => tts.teamId === currentTeamId)
  }, [currentTeamId, tile.teamTileSubmissions])

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Check className="h-6 w-6 text-green-500" />
      case 'requires_interaction':
        return <Clock className="h-6 w-6 text-yellow-500" />
      case 'declined':
        return <X className="h-6 w-6 text-red-500" />
      default:
        return null
    }
  }

  return (
    <div
      className="relative rounded-lg overflow-hidden cursor-pointer border-2 border-primary transition-transform duration-300 ease-in-out hover:scale-105 aspect-square"
      onClick={() => onClick(tile)}
    >
      {tile.headerImage ? (
        <Image
          src={tile.headerImage}
          alt={tile.title}
          fill
          className="object-contain transition-transform duration-300 ease-in-out hover:scale-110"
        />
      ) : (
        <div className="w-full h-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-lg font-semibold">{tile.title}</span>
        </div>
      )}
      <div className="absolute inset-0 flex flex-col justify-between p-2">
        {isManagement && submissionCounts && (
          <div className="flex justify-between text-xs text-white">
            <span>A: {submissionCounts.accepted}</span>
            <span>P: {submissionCounts.pending}</span>
            <span>R: {submissionCounts.requires_interaction}</span>
          </div>
        )}
      </div>
      {currentTeamSubmission && (
        <div className="absolute top-2 right-2 z-10">
          {renderStatusIcon(currentTeamSubmission.status)}
        </div>
      )}
    </div>
  )
}
