'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getTeamsByEventId } from "@/app/actions/team"
import { toast } from "@/hooks/use-toast"
import { Crown } from "lucide-react"

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

export function TeamDisplay({ eventId }: { eventId: string }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true)
      try {
        const fetchedTeams = await getTeamsByEventId(eventId)
        setTeams(fetchedTeams)
      } catch (error) {
        console.error(error)
        toast({
          title: "Error",
          description: "Failed to fetch teams",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchTeams().then(() => console.log("done fetching teams")).catch(e => console.error(e));
  }, [eventId])

  if (loading) {
    return <div>Loading teams...</div>
  }

  const renderMember = (member: TeamMember) => (
    <li key={member.user.id} className="flex items-center space-x-2">
      <Avatar className="h-8 w-8">
        <AvatarImage src={member.user.image ?? undefined} alt={member.user.runescapeName ?? ''} />
        <AvatarFallback>{member.user.runescapeName?.[0] ?? 'U'}</AvatarFallback>
      </Avatar>
      <span>{member.user.runescapeName ?? member.user.name}</span>
      {member.isLeader && (
        <Crown className="h-4 w-4 text-yellow-500" aria-label="Team Leader" />
      )}
    </li>
  )

  return (
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
  )
}

