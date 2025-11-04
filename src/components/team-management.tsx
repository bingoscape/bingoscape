/* eslint-disable */
"use client"

import { useState, useEffect, useMemo } from "react"
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
import { Edit2, Trash2, UserPlus, UserMinus, Shield, ShieldOff, Users, Shuffle, GripVertical, User, CheckCircle2, AlertCircle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DndContext, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core"
import { restrictToWindowEdges } from "@dnd-kit/modifiers"
import { AutoTeamGeneratorModal } from "./auto-team-generator-modal"
import { PlayerMetadataModal } from "./player-metadata-modal"

type TeamMember = {
  user: {
    id: string
    name: string | null
    runescapeName: string | null
    image: string | null
    hasMetadata?: boolean
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
  hasMetadata?: boolean
}

// Draggable Team Member component
function DraggableMember({
  member,
  teamId,
  onToggleLeader,
  onRemove,
  onEditMetadata,
}: {
  member: TeamMember
  teamId: string
  onToggleLeader: () => void
  onRemove: () => void
  onEditMetadata: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `member-${member.user.id}`,
    data: {
      type: "member",
      member,
      teamId,
    },
  })

  return (
    <li
      className={`flex items-center justify-between py-2 border-b last:border-0 hover:bg-secondary/30 rounded-sm px-2 ${isDragging ? "opacity-50" : "opacity-100"}`}
    >
      <div className="flex items-center space-x-2 flex-1">
        {/* Drag handle - only this part is draggable */}
        <div ref={setNodeRef} {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-secondary rounded-sm">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Clickable area for metadata - avatar and name */}
        <button
          onClick={onEditMetadata}
          className="flex items-center space-x-2 hover:bg-secondary/50 rounded-sm p-1 -ml-1 transition-colors group"
          title="Click to edit player metadata"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={member.user.image ?? undefined} alt={member.user.name ?? ""} />
            <AvatarFallback>{member.user.name?.[0] ?? "U"}</AvatarFallback>
          </Avatar>
          <span className="group-hover:text-primary">{member.user.runescapeName ?? member.user.name}</span>
          <User className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        {member.isLeader && <Shield className="h-4 w-4 text-yellow-500" aria-label="Team Leader" />}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex-shrink-0">
                {member.user.hasMetadata ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Metadata configured" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-500" aria-label="Metadata missing" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {member.user.hasMetadata ? "Player metadata configured" : "Player metadata not configured"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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

// Droppable Team Card component
function TeamCard({
  team,
  participants,
  onEditName,
  onSaveName,
  onDelete,
  onAddUser,
  onRemoveUser,
  onToggleLeader,
  onEditMetadata,
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
  onEditMetadata: (userId: string, userName: string | null, runescapeName: string | null) => void
  editingTeamId: string | null
  editedTeamName: string
  setEditedTeamName: (name: string) => void
}) {
  const availableParticipants = participants.filter((p) => !team.teamMembers.some((m) => m.user.id === p.id))

  // Make the team card a drop target
  const { setNodeRef, isOver } = useDroppable({
    id: `team-${team.id}`,
    data: {
      type: "team",
      teamId: team.id,
    },
  })

  return (
    <Card className="overflow-hidden border-2 hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 bg-secondary/30">
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
              <span className="font-semibold">{team.name}</span>
              <Button variant="ghost" size="icon" onClick={() => onEditName(team.id, team.name)} className="h-6 w-6">
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={() => onDelete(team.id)} className="h-6 w-6 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div
          ref={setNodeRef}
          className={`min-h-[100px] rounded-md p-2 mb-3 transition-colors ${isOver ? "bg-primary/10 border-2 border-dashed border-primary" : "bg-secondary/20"
            }`}
        >
          {team.teamMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
              <Users className="h-8 w-8 mb-2 opacity-50" />
              <span className="italic">Drag members here</span>
            </div>
          ) : (
            <ul className="divide-y">
              {team.teamMembers.map((member) => (
                <DraggableMember
                  key={member.user.id}
                  member={member}
                  teamId={team.id}
                  onToggleLeader={() => onToggleLeader(team.id, member.user.id, member.isLeader)}
                  onRemove={() => onRemoveUser(team.id, member.user.id)}
                  onEditMetadata={() => onEditMetadata(member.user.id, member.user.name, member.user.runescapeName)}
                />
              ))}
            </ul>
          )}
        </div>

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

// Unassigned participants pool
function UnassignedParticipantsPool({
  participants,
  onEditMetadata,
}: {
  participants: Participant[]
  onEditMetadata: (userId: string, userName: string | null, runescapeName: string | null) => void
}) {
  // Make the unassigned pool a drop target
  const { setNodeRef, isOver } = useDroppable({
    id: "unassigned-pool",
    data: {
      type: "unassigned-pool",
    },
  })

  if (participants.length === 0) {
    return (
      <Card className="mb-6 border-dashed border-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Unassigned Participants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              All participants have been assigned to teams
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Unassigned Participants
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={setNodeRef}
          className={`rounded-md p-2 transition-colors ${isOver ? "bg-primary/10 border-2 border-dashed border-primary" : "bg-secondary/20"
            }`}
        >
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {participants.map((participant) => (
              <DraggableUnassignedParticipant
                key={participant.id}
                participant={participant}
                onEditMetadata={() => onEditMetadata(participant.id, participant.name, participant.runescapeName)}
              />
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

function DraggableUnassignedParticipant({
  participant,
  onEditMetadata,
}: {
  participant: Participant
  onEditMetadata: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unassigned-${participant.id}`,
    data: {
      type: "unassigned",
      participant,
    },
  })

  return (
    <li
      className={`flex items-center space-x-2 p-2 border rounded-md hover:bg-secondary/30 ${isDragging ? "opacity-50" : "opacity-100"}`}
    >
      {/* Drag handle */}
      <div ref={setNodeRef} {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-secondary rounded-sm flex-shrink-0">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Clickable area for metadata - avatar and name */}
      <button
        onClick={onEditMetadata}
        className="flex items-center space-x-2 hover:bg-secondary/50 rounded-sm p-1 -ml-1 transition-colors group flex-1 min-w-0"
        title="Click to edit player metadata"
      >
        <Avatar className="h-6 w-6 flex-shrink-0">
          <AvatarImage src={participant.image ?? undefined} alt={participant.name ?? ""} />
          <AvatarFallback>{participant.name?.[0] ?? "U"}</AvatarFallback>
        </Avatar>
        <span className="text-sm truncate group-hover:text-primary">{participant.runescapeName ?? participant.name}</span>
        <User className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </button>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex-shrink-0">
              {participant.hasMetadata ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Metadata configured" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-500" aria-label="Metadata missing" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {participant.hasMetadata ? "Player metadata configured" : "Player metadata not configured"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </li>
  )
}

export function TeamManagement({ eventId }: { eventId: string }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [newTeamName, setNewTeamName] = useState("")
  const [loading, setLoading] = useState(true)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editedTeamName, setEditedTeamName] = useState("")
  const [activeDragData, setActiveDragData] = useState<any>(null)
  const [isAutoTeamModalOpen, setIsAutoTeamModalOpen] = useState(false)
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<{
    userId: string
    userName: string | null
    runescapeName: string | null
  } | null>(null)

  // Get unassigned participants
  const unassignedParticipants = useMemo(() => {
    return participants.filter((p) => !teams.some((team) => team.teamMembers.some((m) => m.user.id === p.id)))
  }, [participants, teams])

  useEffect(() => {
    fetchTeamsAndParticipants()
      .then(() => console.log("done fetching teams"))
      .catch((e) => console.error(e))
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

  const handleEditMetadata = (userId: string, userName: string | null, runescapeName: string | null) => {
    setSelectedPlayer({ userId, userName, runescapeName })
    setIsMetadataModalOpen(true)
  }

  const handleMetadataUpdated = async () => {
    // Refresh teams and participants to update any metadata indicators
    await fetchTeamsAndParticipants()
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

  const handleDragStart = (event: any) => {
    setActiveDragData(event.active.data.current)
  }

  const handleDragEnd = async (event: any) => {
    const { active, over } = event

    if (!over) {
      setActiveDragData(null)
      return
    }

    // Extract data from the active and over elements
    const activeData = active.data.current
    const overId = over.id as string
    const overData = over.data.current

    // Handle dropping a team member onto a team
    if (activeData.type === "member" && overData.type === "team") {
      const targetTeamId = overData.teamId

      // Don't do anything if dropped on the same team
      if (targetTeamId === activeData.teamId) {
        setActiveDragData(null)
        return
      }

      try {
        // Remove from current team and add to new team
        await removeUserFromTeam(activeData.teamId, activeData.member.user.id)
        await addUserToTeam(targetTeamId, activeData.member.user.id)
        await fetchTeamsAndParticipants()
        toast({ title: "Member moved to new team" })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to move team member",
          variant: "destructive",
        })
      }
    }
    // Handle dropping an unassigned participant onto a team
    else if (activeData.type === "unassigned" && overData.type === "team") {
      const targetTeamId = overData.teamId

      try {
        await addUserToTeam(targetTeamId, activeData.participant.id)
        await fetchTeamsAndParticipants()
        toast({ title: "Participant added to team" })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to add participant to team",
          variant: "destructive",
        })
      }
    }
    // Handle dropping a team member to unassigned pool
    else if (activeData.type === "member" && overData.type === "unassigned-pool") {
      try {
        await removeUserFromTeam(activeData.teamId, activeData.member.user.id)
        await fetchTeamsAndParticipants()
        toast({ title: "Member removed from team" })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to remove team member",
          variant: "destructive",
        })
      }
    }

    setActiveDragData(null)
  }

  const renderDragOverlay = () => {
    if (!activeDragData) return null

    if (activeDragData.type === "member") {
      const member = activeDragData.member
      return (
        <div className="flex items-center space-x-2 p-2 bg-background border rounded-md shadow-md">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <Avatar className="h-8 w-8">
            <AvatarImage src={member.user.image ?? undefined} alt={member.user.name ?? ""} />
            <AvatarFallback>{member.user.name?.[0] ?? "U"}</AvatarFallback>
          </Avatar>
          <span>{member.user.runescapeName ?? member.user.name}</span>
          {member.isLeader && <Shield className="h-4 w-4 text-yellow-500" />}
        </div>
      )
    }

    if (activeDragData.type === "unassigned") {
      const participant = activeDragData.participant
      return (
        <div className="flex items-center space-x-2 p-2 bg-background border rounded-md shadow-md">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <Avatar className="h-6 w-6">
            <AvatarImage src={participant.image ?? undefined} alt={participant.name ?? ""} />
            <AvatarFallback>{participant.name?.[0] ?? "U"}</AvatarFallback>
          </Avatar>
          <span>{participant.runescapeName ?? participant.name}</span>
        </div>
      )
    }

    return null
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton for team creation */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="h-10 w-40 bg-muted rounded-md animate-pulse" />
            <div className="h-10 w-20 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="h-10 w-40 bg-muted rounded-md animate-pulse" />
        </div>

        {/* Loading skeleton for unassigned participants */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Unassigned Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/20 rounded-md p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading skeleton for team cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="h-6 bg-muted rounded-md animate-pulse" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-24 bg-muted/20 rounded-md animate-pulse mb-3" />
                <div className="h-8 bg-muted rounded-md animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Input
              placeholder="Enter team name (e.g., 'Team Alpha')"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
              className="max-w-xs"
            />
            <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>
              Create Team
            </Button>
          </div>

          <Button variant="outline" className="flex items-center gap-2" onClick={() => setIsAutoTeamModalOpen(true)}>
            <Shuffle className="h-4 w-4" />
            Auto-Generate Teams
          </Button>
        </div>

        {/* Unassigned participants pool */}
        <UnassignedParticipantsPool participants={unassignedParticipants} onEditMetadata={handleEditMetadata} />

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
              onEditMetadata={handleEditMetadata}
              editingTeamId={editingTeamId}
              editedTeamName={editedTeamName}
              setEditedTeamName={setEditedTeamName}
            />
          ))}
        </div>

        <DragOverlay modifiers={[restrictToWindowEdges]}>{renderDragOverlay()}</DragOverlay>
      </div>

      <AutoTeamGeneratorModal
        isOpen={isAutoTeamModalOpen}
        onClose={() => setIsAutoTeamModalOpen(false)}
        eventId={eventId}
        participants={participants}
        existingTeams={teams}
        onTeamsGenerated={fetchTeamsAndParticipants}
      />

      {selectedPlayer && (
        <PlayerMetadataModal
          isOpen={isMetadataModalOpen}
          onClose={() => {
            setIsMetadataModalOpen(false)
            setSelectedPlayer(null)
          }}
          eventId={eventId}
          userId={selectedPlayer.userId}
          userName={selectedPlayer.userName}
          runescapeName={selectedPlayer.runescapeName}
          onMetadataUpdated={handleMetadataUpdated}
        />
      )}
    </DndContext>
  )
}

