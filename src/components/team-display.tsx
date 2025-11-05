'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getTeamsByEventId } from "@/app/actions/team"
import { getEventParticipants } from "@/app/actions/events"
import { toast } from "@/hooks/use-toast"
import { Shield, Edit, Users } from "lucide-react"
import { useSession } from "next-auth/react"
import { PlayerMetadataModal } from "./player-metadata-modal"

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
  runescapeName: string
  role: string
  teamId: string | null
  teamName: string | null
}

export function TeamDisplay({ eventId }: { eventId: string }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [metadataModalOpen, setMetadataModalOpen] = useState(false)
  const { data: session } = useSession()

  // Get current user info for metadata editing
  const currentUser = participants.find(p => p.id === session?.user?.id)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [fetchedTeams, fetchedParticipants] = await Promise.all([
          getTeamsByEventId(eventId),
          getEventParticipants(eventId), // Gets ALL participants with their team info
        ])
        setTeams(fetchedTeams)
        setParticipants(fetchedParticipants)
      } catch (error) {
        console.error(error)
        toast({
          title: "Error",
          description: "Failed to fetch teams and participants",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData().then(() => console.log("done fetching data")).catch(e => console.error(e));
  }, [eventId])

  // Filter to get only unassigned participants (those without a team)
  const unassignedParticipants = participants.filter(p => !p.teamId)

  if (loading) {
    return <div>Loading teams...</div>
  }

  const renderMember = (member: TeamMember) => {
    const isCurrentUser = member.user.id === session?.user?.id

    return (
      <li key={member.user.id} className="flex items-center justify-between space-x-2 py-1">
        <div className="flex items-center space-x-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={member.user.image ?? undefined} alt={member.user.runescapeName ?? ''} />
            <AvatarFallback>{member.user.runescapeName?.[0] ?? 'U'}</AvatarFallback>
          </Avatar>
          <span>{member.user.runescapeName ?? member.user.name}</span>
          {member.isLeader && (
            <Shield className="h-4 w-4 text-yellow-500" aria-label="Team Leader" />
          )}
          {isCurrentUser && (
            <Badge variant="outline" className="text-xs">You</Badge>
          )}
        </div>
        {isCurrentUser && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMetadataModalOpen(true)}
            className="h-7 text-xs"
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit Metadata
          </Button>
        )}
      </li>
    )
  }

  const renderUnassignedParticipant = (participant: Participant) => {
    const isCurrentUser = participant.id === session?.user?.id

    return (
      <li key={participant.id} className="flex items-center justify-between space-x-2 py-1">
        <div className="flex items-center space-x-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{participant.runescapeName[0] ?? 'U'}</AvatarFallback>
          </Avatar>
          <span>{participant.runescapeName}</span>
          {isCurrentUser && (
            <Badge variant="outline" className="text-xs">You</Badge>
          )}
        </div>
        {isCurrentUser && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMetadataModalOpen(true)}
            className="h-7 text-xs"
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit Metadata
          </Button>
        )}
      </li>
    )
  }

  return (
    <div className="space-y-6">
      {/* Unassigned Participants */}
      {unassignedParticipants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Unassigned Participants ({unassignedParticipants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {unassignedParticipants.map(renderUnassignedParticipant)}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => {
          const leader = team.teamMembers.find(member => member.isLeader)
          const members = team.teamMembers.filter(member => !member.isLeader)

          return (
            <Card key={team.id}>
              <CardHeader>
                <CardTitle>{team.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {leader && renderMember(leader)}
                  {members.map(renderMember)}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Player Metadata Modal - Self-Editing */}
      {currentUser && (
        <PlayerMetadataModal
          isOpen={metadataModalOpen}
          onClose={() => setMetadataModalOpen(false)}
          eventId={eventId}
          userId={currentUser.id}
          userName={null}
          runescapeName={currentUser.runescapeName}
          isSelfEditing={true}
          onMetadataUpdated={async () => {
            // Refresh data to show updated metadata
            try {
              const [fetchedTeams, fetchedParticipants] = await Promise.all([
                getTeamsByEventId(eventId),
                getEventParticipants(eventId),
              ])
              setTeams(fetchedTeams)
              setParticipants(fetchedParticipants)
            } catch (error) {
              console.error("Error refreshing data:", error)
            }
          }}
        />
      )}
    </div>
  )
}
