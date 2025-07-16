"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Team {
  id: string
  name: string
}

interface TeamSelectorProps {
  teams: Team[]
  currentTeamId?: string
  userRole: string
  selectedTeamId?: string
  onTeamChange: (teamId: string | undefined) => void
}

export function TeamSelector({ teams, currentTeamId, userRole, selectedTeamId, onTeamChange }: TeamSelectorProps) {
  const isAdminOrManagement = userRole === "admin" || userRole === "management"

  // Only show team selector for admins/management
  if (!isAdminOrManagement) {
    return null
  }

  const handleTeamChange = (value: string) => {
    if (value === "current") {
      onTeamChange(currentTeamId)
    } else {
      onTeamChange(value)
    }
  }

  const getSelectValue = () => {
    if (selectedTeamId === currentTeamId) return "current"
    return selectedTeamId ?? "current"
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-muted-foreground">View Team:</span>
      <Select value={getSelectValue()} onValueChange={handleTeamChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select team to view" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="current">
            My Team{" "}
            {currentTeamId && teams.find((t) => t.id === currentTeamId)?.name
              ? `(${teams.find((t) => t.id === currentTeamId)?.name})`
              : ""}
          </SelectItem>
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
