import Link from "next/link"
import { Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TeamLeaderboard } from "@/components/event-workspace/team-leaderboard"
import {
  TeamRoster,
  type RosterTeam,
} from "@/components/event-workspace/team-roster"
import { getEventStats } from "@/server/queries/stats"
import { getTeamsByEventId } from "@/app/actions/team"
import { buildLeaderboard } from "@/lib/leaderboard"

interface TeamsPanelProps {
  eventId: string
  /** The caller's own Team. */
  ownTeamId: string | undefined
  /** The Team whose progress the Board shows. */
  viewedTeamId: string | undefined
  isManagement: boolean
  /** Public view: leaderboard only (no rosters), rows select the viewed Team. */
  readOnly?: boolean
  currentUser: { id: string; runescapeName: string | null } | null
}

/**
 * Leaderboard (XP per Team, own Team highlighted, click to view a Team) and
 * the roster of the viewed Team. Managers get a link to team management.
 */
export async function TeamsPanel({
  eventId,
  ownTeamId,
  viewedTeamId,
  isManagement,
  readOnly = false,
  currentUser,
}: TeamsPanelProps) {
  const [teams, stats] = await Promise.all([
    getTeamsByEventId(eventId),
    getEventStats(eventId),
  ])

  const rows = buildLeaderboard(
    teams.map((t) => ({
      id: t.id,
      name: t.name,
      memberCount: t.teamMembers.length,
    })),
    stats.eventTeamPoints
  )

  const rosterTeam = teams.find((t) => t.id === (viewedTeamId ?? ownTeamId))

  return (
    <div className="space-y-5">
      <section aria-label="Leaderboard">
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Leaderboard
        </h3>
        <TeamLeaderboard
          rows={rows}
          ownTeamId={ownTeamId}
          viewedTeamId={viewedTeamId}
          canSelect={isManagement || readOnly}
        />
      </section>

      {!readOnly && rosterTeam && (
        <TeamRoster
          eventId={eventId}
          team={rosterTeam as RosterTeam}
          currentUser={currentUser}
        />
      )}

      {isManagement && !readOnly && (
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/events/${eventId}/teams`}>
            <Settings2 aria-hidden="true" className="mr-2 h-4 w-4" />
            Manage teams
          </Link>
        </Button>
      )}
    </div>
  )
}
