'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { Loader2, CheckCircle, CircleAlert } from "lucide-react"
import { getEventParticipants, updateParticipantRole, assignParticipantToTeam, updateParticipantBuyIn } from '@/app/actions/events'
import { getTeamsByEventId } from '@/app/actions/team'
import { getEventById } from '@/app/actions/events'
import { formatRunescapeGold } from '@/lib/utils'

interface Participant {
  id: string
  runescapeName: string
  role: 'admin' | 'management' | 'participant'
  teamId: string | null
  buyIn: number
}

interface Team {
  id: string
  name: string
}

export default function EventParticipantPool() {
  const { id: eventId } = useParams()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [minimumBuyIn, setMinimumBuyIn] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [participantsData, teamsData, eventData] = await Promise.all([
          getEventParticipants(eventId as string),
          getTeamsByEventId(eventId as string),
          getEventById(eventId as string)
        ])
        setParticipants(participantsData)
        setTeams(teamsData)
        setMinimumBuyIn(eventData?.event.minimumBuyIn ?? 0)
      } catch (error) {
        console.error('Error fetching data:', error)
        toast({
          title: "Error",
          description: "Failed to load participants and teams",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
    fetchData().then(() => console.log("Done fetching data")).catch(err => console.error(err))
  }, [eventId])

  const handleRoleChange = async (participantId: string, newRole: string) => {
    try {
      await updateParticipantRole(eventId as string, participantId, newRole as 'admin' | 'management' | 'participant')
      setParticipants(participants.map(p =>
        p.id === participantId ? { ...p, role: newRole as 'admin' | 'management' | 'participant' } : p
      ))
      toast({
        title: "Success",
        description: "Participant role updated",
      })
    } catch (error) {
      console.error('Error updating role:', error)
      toast({
        title: "Error",
        description: "Failed to update participant role",
        variant: "destructive",
      })
    }
  }

  const handleBuyInChange = async (participantId: string, newBuyIn: number) => {
    try {
      await updateParticipantBuyIn(eventId as string, participantId, newBuyIn)
      setParticipants(participants.map(p =>
        p.id === participantId ? { ...p, buyIn: newBuyIn } : p
      ))
      toast({
        title: "Success",
        description: "Participant buy-in updated",
      })
    } catch (error) {
      console.error('Error updating buy-in:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update participant buy-in",
        variant: "destructive",
      })
    }
  }

  const handleTeamAssignment = async (participantId: string, teamId: string | null) => {
    try {
      await assignParticipantToTeam(eventId as string, participantId, teamId!)
      setParticipants(participants.map(p =>
        p.id === participantId ? { ...p, teamId } : p
      ))
      toast({
        title: "Success",
        description: teamId ? "Participant assigned to team" : "Participant removed from team",
      })
    } catch (error) {
      console.error('Error assigning team:', error)
      toast({
        title: "Error",
        description: "Failed to update participant's team",
        variant: "destructive",
      })
    }
  }

  const filteredParticipants = participants.filter(p =>
    p.runescapeName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredParticipants.map((participant) => (
              <TableRow key={participant.id}>
                <TableCell className="w-48">{participant.runescapeName}</TableCell>
                <TableCell className="w-40">
                  <Select
                    value={participant.role}
                    onValueChange={(value) => handleRoleChange(participant.id, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="management">Management</SelectItem>
                      <SelectItem value="participant">Participant</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="w-40">
                  <Select
                    value={participant.teamId ?? 'no-team'}
                    onValueChange={(value) => handleTeamAssignment(participant.id, value === 'no-team' ? null : value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Assign to team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-team">No Team</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="w-40">
                  <Input
                    type="number"
                    value={participant.buyIn}
                    onChange={(e) => handleBuyInChange(participant.id, Number(e.target.value))}
                    min={0}
                    className="w-full"
                  />
                </TableCell>
                <TableCell className="w-40">
                  <span className="text-sm font-medium">
                    {formatRunescapeGold(participant.buyIn)} GP
                  </span>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
