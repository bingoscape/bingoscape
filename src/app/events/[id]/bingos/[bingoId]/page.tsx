import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import BingoGrid from '@/components/bingogrid'
import { getEventById, getUserRole } from '@/app/actions/events'
import { getTeamsByEventId, getCurrentTeamForUser } from '@/app/actions/team'
import { Skeleton } from '@/components/ui/skeleton'
import { type UUID } from 'crypto'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { Button } from '@/components/ui/button'
import { Lock, Unlock, PlusSquare } from 'lucide-react'
import { addRowOrColumn, reorderTiles } from '@/app/actions/bingo'
import { toast } from '@/hooks/use-toast'
import BingoGridWrapper from '@/components/bingo-grid-wrapper'

export default async function BingoDetailPage({ params }: { params: { id: UUID; bingoId: string } }) {
  const { id: eventId, bingoId } = params
  const data = await getEventById(eventId)
  const teams = await getTeamsByEventId(eventId)
  const currentTeam = await getCurrentTeamForUser(eventId)

  if (!data) {
    notFound()
  }

  const { event } = data
  const bingo = event.bingos!.find(b => b.id == bingoId)!

  const userRole = await getUserRole(eventId)

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Events', href: '/events' },
    { label: data.event.title, href: `/events/${eventId}` },
    { label: bingo.title, href: `/events/${eventId}/bingo/${bingoId}` },
  ]

  const handleToggleLock = async () => {
    // Implement the logic to toggle the lock state
    // This should update the bingo's locked state in the database
    // For now, we'll just show a toast
    toast({
      title: bingo.locked ? "Bingo board unlocked" : "Bingo board locked",
      description: bingo.locked ? "You can now edit the bingo board." : "The bingo board is now locked.",
    })
  }

  const handleAddRow = async () => {
    try {
      const result = await addRowOrColumn(bingoId, 'row')
      if (result.success) {
        toast({
          title: "Row added",
          description: "A new row has been added to the bingo board.",
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error adding row:", error)
      toast({
        title: "Error",
        description: "Failed to add row",
        variant: "destructive",
      })
    }
  }

  const handleAddColumn = async () => {
    try {
      const result = await addRowOrColumn(bingoId, 'column')
      if (result.success) {
        toast({
          title: "Column added",
          description: "A new column has been added to the bingo board.",
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error adding column:", error)
      toast({
        title: "Error",
        description: "Failed to add column",
        variant: "destructive",
      })
    }
  }

  const handleReorderTiles = async (reorderedTiles: Tile[]) => {
    const updatedTiles = reorderedTiles.map((tile, index) => ({
      id: tile.id,
      index
    }))

    const result = await reorderTiles(updatedTiles)
    if (result.success) {
      toast({
        title: "Tiles reordered",
        description: "The tiles have been successfully reordered and saved.",
      })
    } else {
      toast({
        title: "Error",
        description: result.error ?? "Failed to reorder tiles",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbItems} />
      <h1 className="text-3xl font-bold mb-6">{bingo.title}</h1>
      {userRole === 'admin' || userRole === 'management' ? (
        <div className="flex space-x-4 mb-4">
          <Button onClick={handleToggleLock}>
            {bingo.locked ? <Unlock className="mr-2" /> : <Lock className="mr-2" />}
            {bingo.locked ? 'Unlock Board' : 'Lock Board'}
          </Button>
          <Button onClick={handleAddRow}>
            <PlusSquare className="mr-2" />
            Add Row
          </Button>
          <Button onClick={handleAddColumn}>
            <PlusSquare className="mr-2" />
            Add Column
          </Button>
        </div>
      ) : null}
      <div className="aspect-square w-full max-w-[80vh] mx-auto">
        <Suspense fallback={<Skeleton className="w-full h-full" />}>
          <BingoGridWrapper
            bingo={bingo}
            userRole={userRole}
            currentTeamId={currentTeam?.id}
            teams={teams}
          />
        </Suspense>
      </div>
    </div>
  )
}
