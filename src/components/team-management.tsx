'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createTeam, getTeamsByEventId, addUserToTeam, removeUserFromTeam, deleteTeam, getEventParticipants, updateTeamMember } from "@/app/actions/team"
import { toast } from "@/hooks/use-toast"

type TeamMember = {
  user: {
    id: string
    name: string | null
    runescapeName: string | null
    image: string | null
  }
  isLeader: boolean
}

type Team = {
  id: string
  name: string
  teamMembers: TeamMember[]
}

type Participant = {
  id: string
  name: string | null
  runescapeName: string | null
  image: string | null
}

export function TeamManagement({ eventId }: { eventId: string }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [newTeamName, setNewTeamName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTeamsAndParticipants().then(() => console.log("Done fetching participants")).catch(err => console.error(err))
  }, [eventId])

  const fetchTeamsAndParticipants = async () => {
    setLoading(true)
    try {
      const [fetchedTeams, fetchedParticipants] = await Promise.all([
        getTeamsByEventId(eventId),
        getEventParticipants(eventId)
      ])
      setTeams(fetchedTeams)
      setParticipants(fetchedParticipants)
    } catch (_) {
      toast({
        title: "Error",
        description: "Failed to fetch teams and participants",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return
    try {
      await createTeam(eventId, newTeamName)
      setNewTeamName('')
      await fetchTeamsAndParticipants()
      toast({
        title: "Team created",
        description: `Team "${newTeamName}" has been created successfully.`,
      })
    } catch (_) {
      toast({
        title: "Error",
        description: "Failed to create team",
        variant: "destructive",
      })
    }
  }

  const handleAddUserToTeam = async (teamId: string, userId: string) => {
    try {
      await addUserToTeam(teamId, userId)
      await fetchTeamsAndParticipants()
      toast({
        title: "User added",
        description: "User has been added to the team successfully.",
      })
    } catch (_) {
      toast({
        title: "Error",
        description: "Failed to add user to team",
        variant: "destructive",
      })
    }
  }

  const handleRemoveUserFromTeam = async (teamId: string, userId: string) => {
    try {
      await removeUserFromTeam(teamId, userId)
      await fetchTeamsAndParticipants()
      toast({
        title: "User removed",
        description: "User has been removed from the team successfully.",
      })
    } catch (_) {
      toast({
        title: "Error",
        description: "Failed to remove user from team",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTeam = async (teamId: string) => {
    try {
      await deleteTeam(teamId)
      await fetchTeamsAndParticipants()
      toast({
        title: "Team deleted",
        description: "Team has been deleted successfully.",
      })
    } catch (_) {
      toast({
        title: "Error",
        description: "Failed to delete team",
        variant: "destructive",
      })
    }
  }

  const handleToggleTeamLeader = async (teamId: string, userId: string, currentIsLeader: boolean) => {
    try {
      await updateTeamMember(teamId, userId, !currentIsLeader)
      await fetchTeamsAndParticipants()
      toast({
        title: "Team leader updated",
        description: `User has been ${currentIsLeader ? 'removed as' : 'set as'} team leader.`,
      })
    } catch (_) {
      toast({
        title: "Error",
        description: "Failed to update team leader",
        variant: "destructive",
      })
    }
  }

  const renderMember = (team: Team, member: TeamMember) => (
    <li key={member.user.id} className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={member.user.image ?? undefined} alt={member.user.name ?? ''} />
          <AvatarFallback>{member.user.name?.[0] ?? 'U'}</AvatarFallback>
        </Avatar>
        <span>{member.user.runescapeName ?? member.user.name}</span>
        {member.isLeader && <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full ml-2">Leader</span>}
      </div>
      <div className="space-x-2">
        <Button variant="outline" size="sm" onClick={() => handleToggleTeamLeader(team.id, member.user.id, member.isLeader)}>
          {member.isLeader ? 'Remove Leader' : 'Make Leader'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleRemoveUserFromTeam(team.id, member.user.id)}>Remove</Button>
      </div>
    </li>
  )

  if (loading) {
    return <div>Loading teams...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Input
          id="nexTeam"
          type="text"
          placeholder="New team name"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
        />
        <Button onClick={handleCreateTeam}>Create Team</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => {
          const leader = team.teamMembers.find(member => member.isLeader)
          const members = team.teamMembers.filter(member => !member.isLeader)

          return (
            <Card key={team.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  {team.name}
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteTeam(team.id)}>Delete</Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {leader && renderMember(team, leader)}
                  {members.map(member => renderMember(team, member))}
                </ul>
                <div className="mt-4">
                  <select
                    className="w-full p-2 border rounded"
                    onChange={(e) => handleAddUserToTeam(team.id, e.target.value)}
                    value=""
                  >
                    <option value="" disabled>Add participant</option>
                    {participants
                      .filter((p) => !team.teamMembers.some((m) => m.user.id === p.id))
                      .map((participant) => (
                        <option key={participant.id} value={participant.id}>
                          {participant.runescapeName ?? participant.name}
                        </option>
                      ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
