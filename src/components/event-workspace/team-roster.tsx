"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Crown,
  Edit,
  Shield,
  Sprout,
  Sword,
  Target,
  Users,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlayerMetadataModal } from "@/components/player-metadata-modal"
import { cn } from "@/lib/utils"

export interface RosterMember {
  isLeader: boolean
  user: {
    id: string
    name: string | null
    runescapeName: string | null
    image: string | null
    hasOverride?: boolean
    originalRunescapeName?: string | null
    skillLevel?: string | null
  }
}

export interface RosterTeam {
  id: string
  name: string
  teamMembers: RosterMember[]
}

interface TeamRosterProps {
  eventId: string
  team: RosterTeam
  /** Signed-in user (to mark "You" and allow editing own metadata). */
  currentUser: { id: string; runescapeName: string | null } | null
}

function getSkillLevelDetails(level?: string | null) {
  switch (level) {
    case "beginner":
      return {
        label: "Beginner",
        icon: Sprout,
        color: "border-success/40 bg-success/10 text-success",
      }
    case "intermediate":
      return {
        label: "Intermediate",
        icon: Sword,
        color: "border-pending/40 bg-pending/10 text-pending",
      }
    case "advanced":
      return {
        label: "Advanced",
        icon: Target,
        color: "border-info/40 bg-info/10 text-info",
      }
    case "expert":
      return {
        label: "Expert",
        icon: Shield,
        color: "border-danger/40 bg-danger/10 text-danger",
      }
    case "pvmgod":
      return {
        label: "PvM God",
        icon: Crown,
        color: "border-warning/40 bg-warning/10 text-warning",
      }
    default:
      return null
  }
}

/** Roster of one Team: leader first, skill badges, edit own metadata. */
export function TeamRoster({ eventId, team, currentUser }: TeamRosterProps) {
  const router = useRouter()
  const [metadataOpen, setMetadataOpen] = useState(false)

  const members = [
    ...team.teamMembers.filter((m) => m.isLeader),
    ...team.teamMembers.filter((m) => !m.isLeader),
  ]

  return (
    <section aria-label={`${team.name} roster`}>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users aria-hidden="true" className="h-4 w-4" />
        {team.name} ({members.length})
      </h3>
      <ul className="space-y-1">
        {members.map((member) => {
          const isCurrentUser = member.user.id === currentUser?.id
          const skill = getSkillLevelDetails(member.user.skillLevel)
          const SkillIcon = skill?.icon
          return (
            <li
              key={member.user.id}
              className="flex items-center justify-between gap-2 py-1"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Avatar className="h-7 w-7 shrink-0 rounded-sm">
                  <AvatarImage
                    src={member.user.image ?? undefined}
                    alt={member.user.runescapeName ?? ""}
                  />
                  <AvatarFallback className="rounded-sm">
                    {member.user.runescapeName?.[0] ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium">
                  {member.user.hasOverride && member.user.originalRunescapeName
                    ? `${member.user.runescapeName} (${member.user.originalRunescapeName})`
                    : (member.user.runescapeName ?? member.user.name)}
                </span>
                {member.isLeader && (
                  <Shield
                    className="h-4 w-4 shrink-0 text-primary"
                    aria-label="Team Leader"
                  />
                )}
                {skill && SkillIcon && (
                  <Badge
                    variant="outline"
                    className={cn("h-5 gap-1 px-1.5 text-[10px]", skill.color)}
                  >
                    <SkillIcon aria-hidden="true" className="h-3 w-3" />
                    {skill.label}
                  </Badge>
                )}
                {isCurrentUser && (
                  <Badge variant="outline" className="text-xs">
                    You
                  </Badge>
                )}
              </div>
              {isCurrentUser && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMetadataOpen(true)}
                  className="h-7 shrink-0 px-2 text-xs"
                >
                  <Edit aria-hidden="true" className="mr-1 h-3 w-3" />
                  Edit
                  <span className="sr-only"> metadata</span>
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {currentUser && (
        <PlayerMetadataModal
          isOpen={metadataOpen}
          onClose={() => setMetadataOpen(false)}
          eventId={eventId}
          userId={currentUser.id}
          userName={null}
          runescapeName={currentUser.runescapeName ?? ""}
          isSelfEditing={true}
          onMetadataUpdated={() => router.refresh()}
        />
      )}
    </section>
  )
}
