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
import { Edit2, Trash2, UserPlus, UserMinus, Shield, ShieldOff, Users, Shuffle, GripVertical, User, CheckCircle2, AlertCircle, TrendingUp, Target, Scale, Globe, ChevronDown, ChevronUp, Crown, Info, LayoutGrid, BarChart3 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DndContext, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core"
import { restrictToWindowEdges } from "@dnd-kit/modifiers"
import { AutoTeamGeneratorModal } from "./auto-team-generator-modal"
import { PlayerMetadataModal } from "./player-metadata-modal"
import { TeamComparisonView } from "./team-comparison-view"
import { getEventTeamStatistics, type EventTeamStatistics, type TeamStatistics } from "@/app/actions/team-statistics"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

  // Determine avatar ring color based on metadata status
  const avatarRingClass = member.user.hasMetadata
    ? "ring-2 ring-green-500 ring-offset-2 ring-offset-background"
    : "ring-2 ring-orange-400 ring-offset-2 ring-offset-background"

  return (
    <li
      className={`flex items-center justify-between py-2.5 px-2 border-b last:border-0 hover:bg-secondary/30 rounded-sm ${isDragging ? "opacity-50" : "opacity-100"}`}
    >
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        {/* Drag handle - only this part is draggable */}
        <div ref={setNodeRef} {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-secondary rounded-sm active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Clickable area for metadata - avatar and name */}
        <button
          onClick={onEditMetadata}
          className="flex items-center space-x-2 hover:bg-secondary/50 rounded-sm p-1 -ml-1 transition-colors group flex-1 min-w-0"
          title="Click to edit player metadata"
        >
          <div className="relative flex-shrink-0">
            <Avatar className={`h-8 w-8 ${avatarRingClass}`}>
              <AvatarImage src={member.user.image ?? undefined} alt={member.user.name ?? ""} />
              <AvatarFallback>{member.user.name?.[0] ?? "U"}</AvatarFallback>
            </Avatar>
            {member.isLeader && (
              <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-0.5">
                <Crown className="h-3 w-3 text-white" aria-label="Team Leader" />
              </div>
            )}
          </div>
          <span className="group-hover:text-primary truncate">{member.user.runescapeName ?? member.user.name}</span>
          <User className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </button>

        {/* Enhanced metadata indicator with tooltip */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onEditMetadata}
                className="flex-shrink-0 hover:scale-110 transition-transform"
              >
                {member.user.hasMetadata ? (
                  <Badge variant="default" className="text-xs px-1.5 py-0 h-5 bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="h-3 w-3" aria-label="Metadata complete" />
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5 bg-orange-500 hover:bg-orange-600">
                    <AlertCircle className="h-3 w-3" aria-label="Metadata incomplete" />
                  </Badge>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {member.user.hasMetadata
                ? "All metadata configured (EHP, EHB, Timezone, etc.)"
                : "Click to add missing metadata (EHP, EHB, Timezone, Combat Level, etc.)"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex space-x-1 flex-shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onToggleLeader} className="h-8 w-8">
                {member.isLeader ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{member.isLeader ? "Remove as Leader" : "Make Leader"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onRemove} className="h-8 w-8">
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

// Team Statistics Badge Component
function TeamStatBadge({
  icon: Icon,
  label,
  value,
  variant,
  tooltip
}: {
  icon: React.ElementType
  label: string
  value: string
  variant?: "default" | "secondary" | "destructive" | "outline"
  tooltip?: string
}) {
  const badge = (
    <Badge variant={variant ?? "secondary"} className="flex items-center gap-1.5 text-xs">
      <Icon className="h-3 w-3" />
      <span className="font-medium">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </Badge>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
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
  teamStats,
  eventAvgEHP,
  eventAvgEHB,
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
  teamStats?: TeamStatistics
  eventAvgEHP?: number
  eventAvgEHB?: number
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const availableParticipants = participants.filter((p) => !team.teamMembers.some((m) => m.user.id === p.id))

  // Make the team card a drop target
  const { setNodeRef, isOver } = useDroppable({
    id: `team-${team.id}`,
    data: {
      type: "team",
      teamId: team.id,
    },
  })

  // Calculate balance score
  const getBalanceInfo = () => {
    if (!eventAvgEHP || !eventAvgEHB || !teamStats?.averageEHP || !teamStats?.averageEHB) {
      return { label: "Unknown", variant: "secondary" as const, score: 0 }
    }

    const ehpDeviation = Math.abs(teamStats.averageEHP - eventAvgEHP) / eventAvgEHP
    const ehbDeviation = Math.abs(teamStats.averageEHB - eventAvgEHB) / eventAvgEHB

    if (ehpDeviation < 0.1 && ehbDeviation < 0.1) {
      return { label: "Excellent", variant: "default" as const, score: 95 }
    } else if (ehpDeviation < 0.2 && ehbDeviation < 0.2) {
      return { label: "Good", variant: "secondary" as const, score: 75 }
    } else {
      return { label: "Fair", variant: "destructive" as const, score: 50 }
    }
  }

  const balanceInfo = getBalanceInfo()

  // Avatar stack preview when collapsed
  const renderAvatarStack = () => {
    const displayMembers = team.teamMembers.slice(0, 4)
    const remainingCount = Math.max(0, team.teamMembers.length - 4)

    return (
      <div className="flex items-center -space-x-2">
        {displayMembers.map((member, idx) => (
          <Avatar key={member.user.id} className="h-7 w-7 border-2 border-background" style={{ zIndex: displayMembers.length - idx }}>
            <AvatarImage src={member.user.image ?? undefined} alt={member.user.name ?? ""} />
            <AvatarFallback className="text-xs">{member.user.name?.[0] ?? "U"}</AvatarFallback>
          </Avatar>
        ))}
        {remainingCount > 0 && (
          <div className="h-7 w-7 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-xs font-medium">
            +{remainingCount}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="overflow-hidden border-2 hover:shadow-md transition-shadow flex flex-col">
      <CardHeader className="pb-2 bg-secondary/30 flex-shrink-0">
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

      {/* Prominent Statistics Header Banner */}
      {teamStats && (
        <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border-b-2 border-border px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Team Size Badge */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 bg-background/80 px-2.5 py-1 rounded-full border">
                      <Users className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-sm font-semibold">{team.teamMembers.length}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Team members</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Timezone Variance */}
              {teamStats.timezoneDistribution.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant={
                          teamStats.timezoneHourVariance === 0
                            ? "default"
                            : teamStats.timezoneHourVariance <= 3
                            ? "secondary"
                            : "destructive"
                        }
                        className="flex items-center gap-1.5"
                      >
                        <Globe className="h-3 w-3" />
                        <span className="font-medium">
                          {teamStats.timezoneHourVariance === 0 ? "Same TZ" : `±${teamStats.timezoneHourVariance.toFixed(1)}h`}
                        </span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {teamStats.timezoneHourVariance === 0
                        ? "All members in same timezone - excellent for coordination!"
                        : `Timezone spread: ±${teamStats.timezoneHourVariance.toFixed(1)} hours across ${teamStats.timezoneDistribution.length} timezone${teamStats.timezoneDistribution.length !== 1 ? "s" : ""}`}
                      <br />
                      {teamStats.timezoneDistribution.map((tz) => `${tz.timezone} (${tz.count})`).join(", ")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Balance Score */}
              {eventAvgEHP && eventAvgEHB && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant={balanceInfo.variant} className="flex items-center gap-1.5 font-semibold">
                        <Scale className="h-3 w-3" />
                        {balanceInfo.label}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Team balance relative to event average</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Collapse/Expand Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-7 px-2 flex-shrink-0"
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
      <CardContent className="pt-0 flex-1 flex flex-col">
        {/* Collapsed View: Avatar Stack */}
        {isCollapsed ? (
          <div className="py-4 px-2 flex items-center justify-between">
            {renderAvatarStack()}
            <span className="text-sm text-muted-foreground">{team.teamMembers.length} members</span>
          </div>
        ) : (
          <>
            {/* Player List with Fixed Height and Scrolling */}
            <div
              ref={setNodeRef}
              className={`min-h-[100px] max-h-[400px] overflow-y-auto rounded-md p-2 mb-3 mt-4 transition-colors scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent ${
                isOver ? "bg-primary/10 border-2 border-dashed border-primary" : "bg-secondary/20"
              }`}
            >
              {team.teamMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground text-sm">
                  <Users className="h-10 w-10 mb-3 opacity-50" />
                  <span className="italic font-medium">Drag members here</span>
                  <span className="text-xs mt-1 opacity-75">or use the dropdown below</span>
                </div>
              ) : (
                <ul>
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
          </>
        )}

        {!isCollapsed && availableParticipants.length > 0 && (
          <div className="mt-auto flex items-center gap-2">
            <Select onValueChange={(value) => onAddUser(team.id, value)}>
              <SelectTrigger className="h-9 flex-1">
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
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Participant</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Collapsible Detailed Statistics Section */}
        {!isCollapsed && teamStats && (
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2 w-full"
            >
              <Info className="h-3.5 w-3.5" />
              <span>Detailed Statistics</span>
              {showDetails ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
            </button>

            {showDetails && (
              <div className="flex flex-wrap gap-2 pt-2">
                {/* Average EHP */}
                {teamStats?.averageEHP !== null && teamStats?.averageEHP !== undefined && (
                  <TeamStatBadge
                    icon={TrendingUp}
                    label="EHP"
                    value={teamStats.averageEHP.toFixed(0)}
                    variant={
                      eventAvgEHP && teamStats.averageEHP >= eventAvgEHP * 1.1
                        ? "default"
                        : eventAvgEHP && teamStats.averageEHP <= eventAvgEHP * 0.9
                        ? "destructive"
                        : "secondary"
                    }
                    tooltip={`Average Efficient Hours Played: ${teamStats.averageEHP.toFixed(0)}${eventAvgEHP ? ` (Event avg: ${eventAvgEHP.toFixed(0)})` : ""}`}
                  />
                )}

                {/* Average EHB */}
                {teamStats?.averageEHB !== null && teamStats?.averageEHB !== undefined && (
                  <TeamStatBadge
                    icon={Target}
                    label="EHB"
                    value={teamStats.averageEHB.toFixed(0)}
                    variant={
                      eventAvgEHB && teamStats.averageEHB >= eventAvgEHB * 1.1
                        ? "default"
                        : eventAvgEHB && teamStats.averageEHB <= eventAvgEHB * 0.9
                        ? "destructive"
                        : "secondary"
                    }
                    tooltip={`Average Efficient Hours Bossed: ${teamStats.averageEHB.toFixed(0)}${eventAvgEHB ? ` (Event avg: ${eventAvgEHB.toFixed(0)})` : ""}`}
                  />
                )}

                {/* Metadata Coverage */}
                <TeamStatBadge
                  icon={CheckCircle2}
                  label="coverage"
                  value={`${teamStats.metadataCoverage.toFixed(0)}%`}
                  variant={
                    teamStats.metadataCoverage >= 75
                      ? "default"
                      : teamStats.metadataCoverage >= 50
                      ? "secondary"
                      : "destructive"
                  }
                  tooltip={`${teamStats.membersWithMetadata} of ${teamStats.memberCount} members have complete metadata`}
                />
              </div>
            )}
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

  // Determine avatar ring color based on metadata status
  const avatarRingClass = participant.hasMetadata
    ? "ring-2 ring-green-500 ring-offset-2 ring-offset-background"
    : "ring-2 ring-orange-400 ring-offset-2 ring-offset-background"

  return (
    <li
      className={`flex items-center space-x-2 p-2 border rounded-md hover:bg-secondary/30 transition-all ${
        isDragging ? "opacity-50 scale-105" : "opacity-100"
      }`}
    >
      {/* Drag handle */}
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab p-1 hover:bg-secondary rounded-sm flex-shrink-0 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Clickable area for metadata - avatar and name */}
      <button
        onClick={onEditMetadata}
        className="flex items-center space-x-2 hover:bg-secondary/50 rounded-sm p-1 -ml-1 transition-colors group flex-1 min-w-0"
        title="Click to edit player metadata"
      >
        <Avatar className={`h-7 w-7 flex-shrink-0 ${avatarRingClass}`}>
          <AvatarImage src={participant.image ?? undefined} alt={participant.name ?? ""} />
          <AvatarFallback className="text-xs">{participant.name?.[0] ?? "U"}</AvatarFallback>
        </Avatar>
        <span className="text-sm truncate group-hover:text-primary font-medium">{participant.runescapeName ?? participant.name}</span>
        <User className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </button>

      {/* Enhanced metadata indicator */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={onEditMetadata} className="flex-shrink-0 hover:scale-110 transition-transform">
              {participant.hasMetadata ? (
                <Badge variant="default" className="text-xs px-1.5 py-0 h-5 bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-3 w-3" aria-label="Metadata complete" />
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5 bg-orange-500 hover:bg-orange-600">
                  <AlertCircle className="h-3 w-3" aria-label="Metadata incomplete" />
                </Badge>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            {participant.hasMetadata
              ? "All metadata configured (EHP, EHB, Timezone, etc.)"
              : "Click to add missing metadata (EHP, EHB, Timezone, Combat Level, etc.)"}
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
  const [statistics, setStatistics] = useState<EventTeamStatistics | null>(null)
  const [statisticsLoading, setStatisticsLoading] = useState(false)

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

      // Fetch statistics if teams exist
      if (fetchedTeams.length > 0) {
        void fetchStatistics()
      }
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

  const fetchStatistics = async () => {
    setStatisticsLoading(true)
    try {
      const stats = await getEventTeamStatistics(eventId)
      setStatistics(stats)
    } catch (error) {
      console.error("Failed to fetch team statistics:", error)
      setStatistics(null)
      // Don't show error toast for statistics - it's not critical
    } finally {
      setStatisticsLoading(false)
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
      const avatarRingClass = member.user.hasMetadata
        ? "ring-2 ring-green-500 ring-offset-2 ring-offset-background"
        : "ring-2 ring-orange-400 ring-offset-2 ring-offset-background"

      return (
        <div className="flex items-center space-x-2 p-3 bg-background border-2 border-primary rounded-lg shadow-2xl scale-105 animate-pulse">
          <GripVertical className="h-4 w-4 text-primary" />
          <div className="relative">
            <Avatar className={`h-8 w-8 ${avatarRingClass}`}>
              <AvatarImage src={member.user.image ?? undefined} alt={member.user.name ?? ""} />
              <AvatarFallback>{member.user.name?.[0] ?? "U"}</AvatarFallback>
            </Avatar>
            {member.isLeader && (
              <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-0.5">
                <Crown className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
          <span className="font-medium">{member.user.runescapeName ?? member.user.name}</span>
        </div>
      )
    }

    if (activeDragData.type === "unassigned") {
      const participant = activeDragData.participant
      const avatarRingClass = participant.hasMetadata
        ? "ring-2 ring-green-500 ring-offset-2 ring-offset-background"
        : "ring-2 ring-orange-400 ring-offset-2 ring-offset-background"

      return (
        <div className="flex items-center space-x-2 p-3 bg-background border-2 border-primary rounded-lg shadow-2xl scale-105 animate-pulse">
          <GripVertical className="h-4 w-4 text-primary" />
          <Avatar className={`h-7 w-7 ${avatarRingClass}`}>
            <AvatarImage src={participant.image ?? undefined} alt={participant.name ?? ""} />
            <AvatarFallback className="text-xs">{participant.name?.[0] ?? "U"}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{participant.runescapeName ?? participant.name}</span>
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

  // Calculate event averages
  const eventAvgEHP = statistics
    ? statistics.teams.reduce((sum, t) => sum + (t.averageEHP ?? 0), 0) /
      statistics.teams.filter((t) => t.averageEHP !== null).length
    : undefined
  const eventAvgEHB = statistics
    ? statistics.teams.reduce((sum, t) => sum + (t.averageEHB ?? 0), 0) /
      statistics.teams.filter((t) => t.averageEHB !== null).length
    : undefined

  // Create teamStats lookup
  const teamStatsMap = Object.fromEntries((statistics?.teams ?? []).map((s) => [s.teamId, s]))

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

        {/* View Toggle: Grid vs Comparison */}
        {teams.length > 0 && (
          <Tabs defaultValue="grid" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="grid" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Team Cards
              </TabsTrigger>
              <TabsTrigger value="comparison" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Comparison View
              </TabsTrigger>
            </TabsList>

            <TabsContent value="grid" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((team) => {
                  const teamStats = statistics?.teams.find((s) => s.teamId === team.id)

                  // Debug logging
                  if (team.teamMembers.length > 0 && !teamStats) {
                    console.log("Team has members but no stats:", team.id, team.name)
                    console.log(
                      "Available statistics:",
                      statistics?.teams.map((t) => t.teamId)
                    )
                  }

                  return (
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
                      teamStats={teamStats}
                      eventAvgEHP={eventAvgEHP}
                      eventAvgEHB={eventAvgEHB}
                    />
                  )
                })}
              </div>
            </TabsContent>

            <TabsContent value="comparison" className="mt-6">
              <TeamComparisonView
                teams={teams}
                teamStats={teamStatsMap}
                eventAvgEHP={eventAvgEHP}
                eventAvgEHB={eventAvgEHB}
              />
            </TabsContent>
          </Tabs>
        )}

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

