"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  createTeam,
  getTeamsByEventId,
  addUserToTeam,
  removeUserFromTeam,
  deleteTeam,
  getEventParticipants,
  updateTeamMember,
  updateTeamName,
} from "@/app/actions/team"
import { toast } from "@/hooks/use-toast"
import { Edit2, Trash2, UserPlus, UserMinus, Shield, ShieldOff } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

// Team Member component to reduce repetition
function TeamMemberItem({
  member,
  onToggleLeader,
  onRemove,
}: {
  member: TeamMember
  onToggleLeader: () => void
  onRemove: () => void
}) {
  return (
    <li className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center space-x-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={member.user.image ?? undefined} alt={member.user.name ?? ""} />
          <AvatarFallback>{member.user.name?.[0] ?? "U"}</AvatarFallback>
        </Avatar>
        <span>{member.user.runescapeName ?? member.user.name}</span>
        {member.isLeader && <Shield className="h-4 w-4 text-yellow-500" aria-label="Team Leader" />}
      </div>
      <div className="flex space-x-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onToggleLeader}>
                {member.isLeader ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{member.isLeader ? "Remove as Leader" : "Make Leader"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onRemove}>
                <UserMinus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove from Team</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </li>
  )
}

// Team Card component
function TeamCard({
  team,
  participants,
  onEditName,
  onSaveName,
  onDelete,
  onAddUser,
  onRemoveUser,
  onToggleLeader,
  editingTeamId,
  editedTeamName,
  setEditedTeamName,
}: {
  team: Team
  participants: Participant[]
  onEditName: (id: string, name: string) => void
  onSaveName: (id: string) => void
  onDelete: (id: string) => void
  onAddUser: (teamId: string, userId: string) => void
  onRemoveUser: (teamId: string, userId: string) => void
  onToggleLeader: (teamId: string, userId: string, isLeader: boolean) => void
  editingTeamId: string | null
  editedTeamName: string
  setEditedTeamName: (name: string) => void
}) {
  const availableParticipants = participants.filter((p) => !team.teamMembers.some((m) => m.user.id === p.id))

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex justify-between items-center text-base">
          {editingTeamId === team.id ? (
            <Input
              value={editedTeamName}
              onChange={(e) => setEditedTeamName(e.target.value)}
              onBlur={() => onSaveName(team.id)}
              onKeyDown={(e) => e.key === "Enter" && onSaveName(team.id)}
              className="h-8"
            />
          ) : (
            <div className="flex items-center gap-2">
              {team.name}
              <Button variant="ghost" size="icon" onClick={() => onEditName(team.id, team.name)} className="h-6 w-6">
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={() => onDelete(team.id)} className="h-6 w-6 text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y">
          {team.teamMembers.map((member) => (
            <TeamMemberItem
              key={member.user.id}
              member={member}
              onToggleLeader={() => onToggleLeader(team.id, member.user.id, member.isLeader)}
              onRemove={() => onRemoveUser(team.id, member.user.id)}
            />
          ))}
        </ul>

        {availableParticipants.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <Select onValueChange={(value) => onAddUser(team.id, value)}>
              <SelectTrigger className="h-8 flex-1">
                <SelectValue placeholder="Add participant" />
              </SelectTrigger>
              <SelectContent>
                {availableParticipants.map((participant) => (
                  <SelectItem key={participant.id} value={participant.id}>
                    {participant.runescapeName ?? participant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Participant</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function TeamManagement({ eventId }: { eventId: string }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [newTeamName, setNewTeamName] = useState("")
  const [loading, setLoading] = useState(true)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editedTeamName, setEditedTeamName] = useState("")

  useEffect(() => {
    fetchTeamsAndParticipants().then(() => console.log("done fetching teams")).catch(e => console.error(e));
  }, [])

  const fetchTeamsAndParticipants = async () => {
    setLoading(true)
    try {
      const [fetchedTeams, fetchedParticipants] = await Promise.all([
        getTeamsByEventId(eventId),
        getEventParticipants(eventId),
      ])
      setTeams(fetchedTeams)
      setParticipants(fetchedParticipants)
    } catch (error) {
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
      setNewTeamName("")
      await fetchTeamsAndParticipants()
      toast({ title: "Team created successfully" })
    } catch (error) {
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
      toast({ title: "User added to team" })
    } catch (error) {
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
      toast({ title: "User removed from team" })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove user from team",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to delete this team?")) return

    try {
      await deleteTeam(teamId)
      await fetchTeamsAndParticipants()
      toast({ title: "Team deleted successfully" })
    } catch (error) {
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
        title: currentIsLeader ? "Team leader removed" : "Team leader assigned",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update team leader",
        variant: "destructive",
      })
    }
  }

  const handleEditTeamName = (teamId: string, currentName: string) => {
    setEditingTeamId(teamId)
    setEditedTeamName(currentName)
  }

  const handleSaveTeamName = async (teamId: string) => {
    if (!editedTeamName.trim()) return
    try {
      await updateTeamName(teamId, editedTeamName)
      await fetchTeamsAndParticipants()
      setEditingTeamId(null)
      toast({ title: "Team name updated" })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update team name",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading teams...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Input
          placeholder="New team name"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
          className="max-w-xs"
        />
        <Button onClick={handleCreateTeam}>Create Team</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            participants={participants}
            onEditName={handleEditTeamName}
            onSaveName={handleSaveTeamName}
            onDelete={handleDeleteTeam}
            onAddUser={handleAddUserToTeam}
            onRemoveUser={handleRemoveUserFromTeam}
            onToggleLeader={handleToggleTeamLeader}
            editingTeamId={editingTeamId}
            editedTeamName={editedTeamName}
            setEditedTeamName={setEditedTeamName}
          />
        ))}
      </div>
    </div>
  )
}
