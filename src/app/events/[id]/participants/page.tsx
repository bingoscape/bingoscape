"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { Loader2, CheckCircle, CircleAlert, UserMinus } from "lucide-react"
import {
  getEventParticipants,
  updateParticipantRole,
  assignParticipantToTeam,
  updateParticipantBuyIn,
  removeParticipantFromEvent,
} from "@/app/actions/events"
import { getTeamsByEventId } from "@/app/actions/team"
import { getEventById } from "@/app/actions/events"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import type { UUID } from "crypto"
import { Breadcrumbs } from "@/components/breadcrumbs"
import debounce from "lodash/debounce"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useSession } from "next-auth/react"

interface RemoveParticipantDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  participantName: string
}

function RemoveParticipantDialog({ isOpen, onClose, onConfirm, participantName }: RemoveParticipantDialogProps) {
  const [isRemoving, setIsRemoving] = useState(false)

  const handleConfirm = async () => {
    setIsRemoving(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error("Error removing participant:", error)
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Participant</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove {participantName} from this event? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
            disabled={isRemoving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isRemoving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserMinus className="h-4 w-4 mr-2" />}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface Participant {
  id: string
  runescapeName: string
  role: "admin" | "management" | "participant"
  teamId: string | null
  buyIn: number
}

interface Team {
  id: string
  name: string
}

export default function EventParticipantPool({ params }: { params: { id: UUID } }) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [minimumBuyIn, setMinimumBuyIn] = useState(0)
  const [eventName, setEventName] = useState("")
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [participantToRemove, setParticipantToRemove] = useState<Participant | null>(null)
  const { data, status } = useSession()
  const [isEditable, setIsEditable] = useState(false)

  const handleRemoveParticipant = async () => {
    if (!participantToRemove) return

    try {
      await removeParticipantFromEvent(params.id as string, participantToRemove.id)

      setParticipants(participants.filter((p) => p.id !== participantToRemove.id))

      toast({
        title: "Success",
        description: `${participantToRemove.runescapeName} has been removed from the event`,
      })
    } catch (error) {
      console.error("Error removing participant:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove participant",
        variant: "destructive",
      })
    }
  }

  const openRemoveDialog = (participant: Participant) => {
    setParticipantToRemove(participant)
    setRemoveDialogOpen(true)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [participantsData, teamsData, eventData] = await Promise.all([
          getEventParticipants(params.id as string),
          getTeamsByEventId(params.id as string),
          getEventById(params.id as string),
        ])
        const userRole = participantsData.find((p) => p.id === data?.user.id)?.role
        setIsEditable(userRole === "admin" || eventData?.event.creatorId === data?.user.id)
        setParticipants(participantsData)

        setTeams(teamsData)
        setMinimumBuyIn(eventData?.event.minimumBuyIn ?? 0)
        setEventName(eventData?.event.title ?? "")
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to load participants and teams",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    setLoading(true)
    fetchData()
      .then(() => console.log("Done fetching data"))
      .catch((err) => console.error(err))
  }, [params.id])

  const handleRoleChange = async (participantId: string, newRole: string) => {
    try {
      await updateParticipantRole(params.id as string, participantId, newRole as "admin" | "management" | "participant")
      setParticipants(
        participants.map((p) =>
          p.id === participantId ? { ...p, role: newRole as "admin" | "management" | "participant" } : p,
        ),
      )
      toast({
        title: "Success",
        description: "Participant role updated",
      })
    } catch (error) {
      console.error("Error updating role:", error)
      toast({
        title: "Error",
        description: "Failed to update participant role",
        variant: "destructive",
      })
    }
  }

  const debouncedBuyInChange = useCallback(
    debounce(async (participantId: string, newBuyIn: number) => {
      try {
        await updateParticipantBuyIn(params.id as string, participantId, newBuyIn)
        setParticipants((participants) =>
          participants.map((p) => (p.id === participantId ? { ...p, buyIn: newBuyIn } : p)),
        )
        toast({
          title: "Success",
          description: "Participant buy-in updated",
        })
      } catch (error) {
        console.error("Error updating buy-in:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to update participant buy-in",
          variant: "destructive",
        })
      }
    }, 500),
    [params.id],
  )

  const handleBuyInChange = (participantId: string, newBuyIn: number) => {
    // Update the local state immediately for a responsive UI
    setParticipants(participants.map((p) => (p.id === participantId ? { ...p, buyIn: newBuyIn } : p)))
    // Debounce the API call
    debouncedBuyInChange(participantId, newBuyIn)
      ?.then(() => console.log("done"))
      .catch((err) => console.error(err))
  }

  const handleTeamAssignment = async (participantId: string, teamId: string | null) => {
    try {
      await assignParticipantToTeam(params.id as string, participantId, teamId!)

      // Refresh the participants list after team assignment
      const updatedParticipants = await getEventParticipants(params.id as string)
      setParticipants(updatedParticipants)

      toast({
        title: "Success",
        description: teamId ? "Participant assigned to team" : "Participant removed from team",
      })
    } catch (error) {
      console.error("Error assigning team:", error)
      toast({
        title: "Error",
        description: "Failed to update participant's team",
        variant: "destructive",
      })
    }
  }

  const filteredParticipants = participants.filter((p) =>
    p.runescapeName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Events", href: "/" },
    { label: eventName, href: `/events/${params.id}` },
    { label: "Participants", href: `/events/${params.id}/participants` },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbItems} />
      <h1 className="text-2xl font-bold mb-4">Event Participant Pool</h1>
      <p className="mb-4">Minimum Buy-In: {formatRunescapeGold(minimumBuyIn)} GP</p>
      <Input
        type="text"
        placeholder="Search participants..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4"
      />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">Runescape Name</TableHead>
              <TableHead className="w-40">Role</TableHead>
              <TableHead className="w-40">Team</TableHead>
              <TableHead className="w-40">Buy-In (GP)</TableHead>
              <TableHead className="w-40"></TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredParticipants.map((participant) => (
              <TableRow key={participant.id}>
                <TableCell className="w-48">{participant.runescapeName}</TableCell>
                <TableCell className="w-40">
                  {isEditable ? (
                    <Select value={participant.role} onValueChange={(value) => handleRoleChange(participant.id, value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="management">Management</SelectItem>
                        <SelectItem value="participant">Participant</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : <span className="text-sm font-medium">{participant.role}</span>}
                </TableCell>
                <TableCell className="w-40">
                  {isEditable ? (
                    <Select
                      value={participant.teamId ?? "no-team"}
                      onValueChange={(value) => handleTeamAssignment(participant.id, value === "no-team" ? null : value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Assign to team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no-team">No Team</SelectItem>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : <span className="text-sm font-medium">{participant.teamId ? teams.find((team) => team.id === participant.teamId)?.name : "No Team"}</span>}
                </TableCell>
                <TableCell className="w-40">
                  {isEditable && (
                    <Input
                      type="number"
                      value={participant.buyIn}
                      onChange={(e) => handleBuyInChange(participant.id, Number(e.target.value))}
                      min={0}
                      className="w-full"
                    />
                  )}
                </TableCell>
                <TableCell className="w-40">
                  <span className="text-sm font-medium">{formatRunescapeGold(participant.buyIn)} GP</span>
                </TableCell>
                <TableCell className="w-20">
                  <div className="flex items-center justify-center">
                    {participant.buyIn < minimumBuyIn ? (
                      <CircleAlert className="text-yellow-500 h-5 w-5" />
                    ) : (
                      <CheckCircle className="text-green-500 h-5 w-5" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="w-20">
                  {isEditable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openRemoveDialog(participant)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {
        participantToRemove && (
          <RemoveParticipantDialog
            isOpen={removeDialogOpen}
            onClose={() => setRemoveDialogOpen(false)}
            onConfirm={handleRemoveParticipant}
            participantName={participantToRemove.runescapeName}
          />
        )
      }
    </div >
  )
}

