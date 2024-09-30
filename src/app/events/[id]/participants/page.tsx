'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { getEventParticipants, updateParticipantRole, assignParticipantToTeam } from '@/app/actions/events'
import { getTeamsByEventId } from '@/app/actions/team'

interface Participant {
  id: string
  runescapeName: string
  role: 'admin' | 'management' | 'participant'
  teamId: string | null
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [participantsData, teamsData] = await Promise.all([
          getEventParticipants(eventId as string),
          getTeamsByEventId(eventId as string)
        ])
        setParticipants(participantsData)
        setTeams(teamsData)
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
    fetchData()
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
      <Input
        type="text"
        placeholder="Search participants..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Runescape Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Team</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredParticipants.map((participant) => (
            <TableRow key={participant.id}>
              <TableCell>{participant.runescapeName}</TableCell>
              <TableCell>
                <Select
                  value={participant.role}
                  onValueChange={(value) => handleRoleChange(participant.id, value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="management">Management</SelectItem>
                    <SelectItem value="participant">Participant</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  value={participant.teamId || 'no-team'}
                  onValueChange={(value) => handleTeamAssignment(participant.id, value === 'no-team' ? null : value)}
                >
                  <SelectTrigger className="w-[180px]">
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
