import React from 'react'
import Image from 'next/image'
import { Check, Clock, Send, X, Trash2 } from 'lucide-react'
import { type Tile } from '@/app/actions/events'
import { Button } from "@/components/ui/button"

interface BingoTileProps {
  tile: Tile
  onClick: (tile: Tile) => void
  onDelete: (tileId: string) => void
  userRole: 'participant' | 'management' | 'admin'
  currentTeamId?: string
  isLocked: boolean
}

export function BingoTile({ tile, onClick, onDelete, userRole, currentTeamId, isLocked }: BingoTileProps) {
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

  const renderStatusIcon = (status: 'accepted' | 'requires_interaction' | 'declined' | 'pending' | undefined) => {
    switch (status) {
      case 'accepted':
        return <Check className="h-6 w-6 text-green-500" />
      case 'requires_interaction':
        return <Clock className="h-6 w-6 text-yellow-500" />
      case 'declined':
        return <X className="h-6 w-6 text-red-500" />
      case 'pending':
        return <Send className='h-6 w-6 text-blue-500' />
      default:
        return null
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(tile.id)
  }

  return (
    <div
      className="relative rounded overflow-hidden cursor-pointer border-2 border-primary transition-transform duration-300 ease-in-out hover:scale-105 aspect-square"
      onClick={() => onClick(tile)}
    >
      {tile.headerImage ? (
        <Image
          unoptimized
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
      {currentTeamSubmission && (
        <div className="absolute top-2 left-2 z-10">
          {renderStatusIcon(currentTeamSubmission.status)}
        </div>
      )}
      {!isLocked && isManagement && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 z-20 h-8 w-8"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete</span>
        </Button>
      )}
    </div>
  )
}
