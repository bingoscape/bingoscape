"use client"

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import type { Team } from "@/app/actions/events"
import { Badge } from "@/components/ui/badge"
import { Eye } from "lucide-react"

interface TeamSelectorProps {
  teams: Team[]
  currentTeamId?: string
  userRole: "admin" | "management" | "participant"
}

export function TeamSelector({ teams, currentTeamId, userRole }: TeamSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Get the teamId from the URL or use the current team as default
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(searchParams.get("teamId") ?? currentTeamId)

  // Update the URL when the selected team changes
  useEffect(() => {
    if (selectedTeamId) {
      const params = new URLSearchParams(searchParams.toString())
      params.set("teamId", selectedTeamId)
      router.push(`${pathname}?${params.toString()}`)
    }
  }, [selectedTeamId, pathname, router, searchParams])

  // Only admin and management users can select teams
  if (userRole !== "admin" && userRole !== "management") {
    return null
  }

  // If there are no teams, don't show the selector
  if (!teams || teams.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="flex items-center gap-1">
        <Eye className="h-3 w-3" />
        <span>Viewing as</span>
      </Badge>
      <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select team" />
        </SelectTrigger>
        <SelectContent>
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name} {team.id === currentTeamId && "(Your Team)"}
            </SelectItem>
          ))}
          {currentTeamId && <SelectItem value={currentTeamId}>Your Team</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  )
}

