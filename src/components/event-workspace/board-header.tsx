"use client"

import { useState } from "react"
import Link from "next/link"
import {
  FileJson,
  LayoutGrid,
  Link as LinkIcon,
  ListFilter,
  Lock,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react"
import type { UUID } from "crypto"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BingoImportExportModal } from "@/components/bingo-import-export-modal"
import { BingoInfoModal } from "@/components/bingo-info-modal"
import { DeleteBingoButton } from "@/components/delete-bingo-button"
import { EditBingoModal } from "@/components/edit-bingo-modal"
import { QuickSubmissionButton } from "@/components/quick-submission-button"
import { BoardFilters } from "@/components/event-workspace/board-filters"
import { ShortcutsHelp } from "@/components/event-workspace/shortcuts-help"
import { TeamSelector } from "@/components/team-selector"
import { TrackerSettingsModal } from "@/components/tracker-settings-modal"
import type { TileFilter, TileFilterContext } from "@/lib/tile-filter"
import type { BoardStats } from "@/lib/tile-status"
import { cn } from "@/lib/utils"
import type { Bingo, Team } from "@/types/model"

/** More Boards than this switch from pills to a Select. */
const MAX_PILLS = 6

interface BoardHeaderProps {
  eventId: string
  bingos: Bingo[]
  activeBingo: Bingo
  onSelectBoard: (bingoId: string) => void
  stats: BoardStats
  teams: Team[]
  isManagement: boolean
  /** Public / read-only view: no actions, no Team selector. */
  readOnly?: boolean
  /** The caller's own Team (for Quick submit and "My Team"). */
  ownTeam: { id: string; name: string } | null
  /** The Team whose progress is shown. */
  effectiveTeamId: string | undefined
  onTeamChange: (teamId: string | null) => void
  pendingSubmissionCount: number
  editLayout: boolean
  onToggleEditLayout: () => void
  onQuickSubmit: () => void
  /** Board is locked and not yet visible to players ("upcoming"). */
  isUpcoming: boolean
  /** A Board / Team switch is waiting for the server. */
  isSwitching?: boolean
  /** The side panel can be collapsed (shown in the shortcuts list). */
  canCollapsePanel?: boolean
  filters: {
    context: TileFilterContext
    active: TileFilter | null
    counts: Record<TileFilter, number>
    onChange: (filter: TileFilter | null) => void
  }
}

/**
 * One dense header above the Board: Board pills, progress and counters, the
 * "view as" Team (managers) and the actions. Admin actions live in a kebab.
 */
export function BoardHeader({
  eventId,
  bingos,
  activeBingo,
  onSelectBoard,
  stats,
  teams,
  isManagement,
  readOnly = false,
  ownTeam,
  effectiveTeamId,
  onTeamChange,
  pendingSubmissionCount,
  editLayout,
  onToggleEditLayout,
  onQuickSubmit,
  isUpcoming,
  isSwitching = false,
  canCollapsePanel = false,
  filters,
}: BoardHeaderProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [trackerOpen, setTrackerOpen] = useState(false)
  const [importExportOpen, setImportExportOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const showTeamStats = !!effectiveTeamId
  const useSelect = bingos.length > MAX_PILLS

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Boards */}
        {bingos.length > 1 &&
          (useSelect ? (
            <Select value={activeBingo.id} onValueChange={onSelectBoard}>
              <SelectTrigger className="h-9 w-56" aria-label="Board">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bingos.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.locked && !b.visible ? "🔒 " : ""}
                    {b.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <nav
              aria-label="Boards"
              className="-mx-1 flex max-w-full min-w-0 gap-1 overflow-x-auto px-1 pb-1"
            >
              {bingos.map((b) => {
                const active = b.id === activeBingo.id
                const upcoming = b.locked && !b.visible
                return (
                  <button
                    key={b.id}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => onSelectBoard(b.id)}
                    className={cn(
                      "osrs-btn focus-visible:ring-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm px-3 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:outline-hidden",
                      active &&
                        "osrs-bevel-inset !text-osrs-yellow translate-y-px"
                    )}
                  >
                    {upcoming && (
                      <Lock aria-label="Locked" className="h-3 w-3" />
                    )}
                    {b.title}
                  </button>
                )
              })}
            </nav>
          ))}
        {bingos.length === 1 && (
          <h2 className="osrs-heading text-foreground text-lg">
            {activeBingo.title}
          </h2>
        )}

        {isSwitching && <Spinner aria-label="Loading board" />}

        {/* Progress */}
        {showTeamStats && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm font-medium tabular-nums">
              {stats.percent}%
            </span>
            <Progress
              value={stats.percent}
              aria-label={`Board progress ${stats.percent}%`}
              className="h-3 w-28"
            />
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isManagement && !readOnly && teams.length > 0 && (
            <TeamSelector
              teams={teams}
              currentTeamId={ownTeam?.id}
              userRole="admin"
              selectedTeamId={effectiveTeamId}
              onTeamChange={(id) =>
                onTeamChange(id && id !== ownTeam?.id ? id : null)
              }
            />
          )}

          {!readOnly && (
            <QuickSubmissionButton
              currentTeamId={ownTeam?.id}
              isSubmissionsLocked={activeBingo.locked || false}
              onClick={onQuickSubmit}
              className="h-9"
            />
          )}

          <BingoInfoModal bingo={activeBingo} />

          <ShortcutsHelp
            hasMultipleBoards={bingos.length > 1}
            canCollapsePanel={canCollapsePanel}
          />

          {isManagement && !readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical aria-hidden="true" className="h-4 w-4" />
                  <span className="sr-only">Board actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil aria-hidden="true" className="mr-2 h-4 w-4" />
                  Edit Board
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onToggleEditLayout}>
                  <LayoutGrid aria-hidden="true" className="mr-2 h-4 w-4" />
                  {editLayout ? "Done editing layout" : "Edit layout"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTrackerOpen(true)}>
                  <LinkIcon aria-hidden="true" className="mr-2 h-4 w-4" />
                  Tracker settings
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setImportExportOpen(true)}>
                  <FileJson aria-hidden="true" className="mr-2 h-4 w-4" />
                  Import / Export
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-danger focus:text-danger"
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                  Delete Board
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {showTeamStats && (
          <>
            <Counter tone="success" label="done" value={stats.completed} />
            {stats.pending > 0 && (
              <Counter tone="info" label="pending" value={stats.pending} />
            )}
            {stats.needsReview > 0 && (
              <Counter
                tone="warning"
                label="changes requested"
                value={stats.needsReview}
              />
            )}
            <Counter tone="muted" label="remaining" value={stats.remaining} />
          </>
        )}
        <BoardFilters {...filters} />
        {isUpcoming && isManagement && (
          <span className="text-muted-foreground flex items-center gap-1 font-medium">
            <Lock aria-hidden="true" className="h-3 w-3" />
            Upcoming (locked for players)
          </span>
        )}
        {isManagement && !readOnly && (
          <Link
            href={`/events/${eventId}/bingos/${activeBingo.id}/submissions`}
            className="text-primary ml-auto inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
          >
            <ListFilter aria-hidden="true" className="h-3 w-3" />
            Submissions
            {pendingSubmissionCount > 0 && (
              <span className="bg-pending text-pending-foreground rounded-sm px-1 text-[10px]">
                {pendingSubmissionCount} pending
              </span>
            )}
          </Link>
        )}
      </div>

      {isManagement && !readOnly && (
        <>
          <EditBingoModal
            bingo={activeBingo}
            isOpen={editOpen}
            onClose={() => setEditOpen(false)}
          />
          <TrackerSettingsModal
            bingoId={activeBingo.id}
            womCompetitionId={activeBingo.womCompetitionId}
            womVerificationCode={activeBingo.womVerificationCode}
            isOpen={trackerOpen}
            onClose={() => setTrackerOpen(false)}
          />
          <BingoImportExportModal
            eventId={eventId}
            bingoId={activeBingo.id}
            bingoTitle={activeBingo.title}
            isOpen={importExportOpen}
            onClose={() => setImportExportOpen(false)}
          />
          <DeleteBingoButton
            bingoId={activeBingo.id as UUID}
            hideTrigger
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
          />
        </>
      )}
    </div>
  )
}

function Counter({
  tone,
  label,
  value,
}: {
  tone: "success" | "info" | "warning" | "muted"
  label: string
  value: number
}) {
  const dot =
    tone === "success"
      ? "bg-success"
      : tone === "info"
        ? "bg-info"
        : tone === "warning"
          ? "bg-warning"
          : "bg-muted-foreground"
  const text =
    tone === "success"
      ? "text-success"
      : tone === "info"
        ? "text-info"
        : tone === "warning"
          ? "text-warning"
          : "text-muted-foreground"
  return (
    <span className={cn("flex items-center gap-1.5 font-medium", text)}>
      <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", dot)} />
      {value} {label}
    </span>
  )
}
