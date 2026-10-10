"use client"

import { Crown, Eye } from "lucide-react"
import { useWorkspaceParams } from "@/components/event-workspace/use-workspace-params"
import type { LeaderboardRow } from "@/lib/leaderboard"
import { cn } from "@/lib/utils"

interface TeamLeaderboardProps {
  rows: LeaderboardRow[]
  /** The caller's own Team (highlighted). */
  ownTeamId: string | undefined
  /** The Team whose progress the Board currently shows. */
  viewedTeamId: string | undefined
  /** Clicking a row sets ?teamId= (managers and the public view). */
  canSelect: boolean
}

/**
 * XP leaderboard. Rows are buttons when the viewer may switch the viewed Team
 * (managers "view as", public view), plain rows otherwise.
 */
export function TeamLeaderboard({
  rows,
  ownTeamId,
  viewedTeamId,
  canSelect,
}: TeamLeaderboardProps) {
  const { setTeamId } = useWorkspaceParams()

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No teams have been created yet.</p>
    )
  }

  return (
    <ol aria-label="Team leaderboard" className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const isOwn = row.teamId === ownTeamId
        const isViewed = row.teamId === viewedTeamId
        const content = (
          <>
            <span
              className={cn(
                "osrs-qty w-6 shrink-0 text-center text-base",
                row.rank === 1 && "text-osrs-gold"
              )}
              aria-label={`Rank ${row.rank}`}
            >
              {row.rank === 1 ? (
                <Crown aria-hidden="true" className="mx-auto h-4 w-4" />
              ) : (
                row.rank
              )}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">
              {row.name}
              {isOwn && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  (your team)
                </span>
              )}
            </span>
            {isViewed && !isOwn && (
              <Eye
                aria-label="Viewing this team"
                className="h-3.5 w-3.5 shrink-0 text-primary"
              />
            )}
            <span className="shrink-0 tabular-nums">
              <span className="font-display text-base text-primary">
                {row.xp}
              </span>{" "}
              <span className="text-xs text-muted-foreground">XP</span>
            </span>
          </>
        )

        const className = cn(
          "osrs-panel-inset flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
          isOwn && "border-primary",
          isViewed && "ring-1 ring-primary ring-inset"
        )

        return (
          <li key={row.teamId}>
            {canSelect ? (
              <button
                type="button"
                aria-pressed={isViewed}
                title={`View ${row.name}'s progress`}
                onClick={() => setTeamId(isOwn ? null : row.teamId)}
                className={cn(
                  className,
                  "hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                )}
              >
                {content}
              </button>
            ) : (
              <div className={className}>{content}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
