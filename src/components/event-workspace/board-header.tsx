"use client"

import { useId, useState } from "react"
import Link from "next/link"
import {
  FileJson,
  LayoutGrid,
  Link as LinkIcon,
  ListChecks,
  ListFilter,
  Lock,
  MoreVertical,
  Pencil,
  Ship,
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
import { Toggle } from "@/components/ui/toggle"
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
import { BoardHealthIndicator } from "@/components/event-workspace/board-health-indicator"
import { BattleshipMarkBadge } from "@/components/battleship-mark-badge"
import { OwnShipGlyph } from "@/components/own-ship-glyph"
import { ShortcutsHelp } from "@/components/event-workspace/shortcuts-help"
import { TeamSelector } from "@/components/team-selector"
import { TrackerSettingsModal } from "@/components/tracker-settings-modal"
import {
  placeShipsTeamId,
  type BattleshipWorkspaceInfo,
} from "@/lib/battleship-workspace"
import { MARK_LABEL } from "@/lib/battleship-marks"
import type { TileFilter, TileFilterContext } from "@/lib/tile-filter"
import type { BoardStats } from "@/lib/tile-status"
import { cn } from "@/lib/utils"
import type { Bingo, Team, Tile } from "@/types/model"

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
  /** The tracker settings modal is open; owned by the workspace so the Goals tab can open it too. */
  trackerOpen: boolean
  onTrackerOpenChange: (open: boolean) => void
  filters: {
    context: TileFilterContext
    active: TileFilter | null
    counts: Record<TileFilter, number>
    onChange: (filter: TileFilter | null) => void
  }
  /**
   * The "N tiles have no goals" hint. Only pass it to people who can manage
   * Goals: for everyone else the hint is not shown at all.
   */
  goalHealth?: {
    tiles: Tile[]
    selectedTileId: string | null
    onSelectTile: (tileId: string) => void
  }
  /**
   * Opens the board-level goal setup view. Only pass it to people who can
   * manage Goals, and not while that view is already open.
   */
  onSetUpGoals?: () => void
  /**
   * The active Board is a battleship Board: its fleet rules, whether the Event
   * started and the Team the viewer leads. Absent for other Boards and in the
   * public view.
   */
  battleship?: BattleshipWorkspaceInfo | null
  /**
   * Battleship: the "My ships" toggle (own ships drawn on the Board). The
   * toggle is only offered when this handler is given, the Event has started
   * and the viewer's own Team is on screen.
   */
  showOwnShips?: boolean
  onShowOwnShipsChange?: (show: boolean) => void
}

const BATTLESHIP_LEGEND = ["hit", "miss", "sunk"] as const

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
  trackerOpen,
  onTrackerOpenChange,
  filters,
  goalHealth,
  onSetUpGoals,
  battleship,
  showOwnShips = false,
  onShowOwnShipsChange,
}: BoardHeaderProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [importExportOpen, setImportExportOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const noShipsId = useId()

  const showTeamStats = !!effectiveTeamId
  const useSelect = bingos.length > MAX_PILLS

  // Ships can be placed before the Event starts, by the leader of a Team (for
  // that Team) and by managers (for the Team they look at).
  const boardBattleship =
    !readOnly &&
    activeBingo.bingoType === "battleship" &&
    battleship?.bingoId === activeBingo.id
      ? battleship
      : null
  const placeTeamId =
    boardBattleship && !boardBattleship.started
      ? placeShipsTeamId({
          isManagement,
          ledTeamId: boardBattleship.ledTeamId,
          viewedTeamId: effectiveTeamId,
          teamIds: teams.map((t) => t.id),
        })
      : null

  // The own ships are the viewer's own Team's: only offered while that Team is
  // the one on screen (a manager looking at another Team never sees them).
  const ownShips = boardBattleship?.ownShips ?? []
  const viewingOwnTeam = !!ownTeam && ownTeam.id === effectiveTeamId
  const canToggleOwnShips =
    !!boardBattleship?.started && viewingOwnTeam && !!onShowOwnShipsChange
  const hasOwnShips = ownShips.length > 0
  const ownShipsOn = canToggleOwnShips && hasOwnShips && showOwnShips
  const ownShipTiles = ownShips.reduce(
    (total, ship) => total + ship.tileIds.length,
    0
  )

  // After the start the Place ships link is gone. Managers (on a Team or not)
  // can still read every fleet on the read-only ships page, which authorizes
  // them itself; the link only offers the route.
  const viewFleetsTeamId =
    effectiveTeamId && teams.some((t) => t.id === effectiveTeamId)
      ? effectiveTeamId
      : null
  const viewFleetsHref =
    boardBattleship?.started && isManagement
      ? `/events/${eventId}/bingos/${activeBingo.id}/ships${
          viewFleetsTeamId
            ? `?teamId=${encodeURIComponent(viewFleetsTeamId)}`
            : ""
        }`
      : null

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
              selectedTeamId={effectiveTeamId}
              onTeamChange={(id) =>
                onTeamChange(id && id !== ownTeam?.id ? id : null)
              }
            />
          )}

          {placeTeamId && (
            <Link
              href={`/events/${eventId}/bingos/${activeBingo.id}/ships?teamId=${encodeURIComponent(placeTeamId)}`}
              className="osrs-btn focus-visible:ring-ring inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:outline-hidden pointer-coarse:min-h-11"
            >
              <Ship aria-hidden="true" className="size-4" />
              Place ships
            </Link>
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
                <DropdownMenuItem onSelect={() => onTrackerOpenChange(true)}>
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
        {goalHealth && <BoardHealthIndicator {...goalHealth} />}
        {onSetUpGoals && (
          <button
            type="button"
            onClick={onSetUpGoals}
            className="border-border text-foreground hover:border-primary focus-visible:ring-ring inline-flex min-h-6 items-center gap-1.5 rounded-sm border px-2 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden pointer-coarse:min-h-11"
          >
            <ListChecks aria-hidden="true" className="h-3.5 w-3.5" />
            Set up goals
          </button>
        )}
        {boardBattleship && !boardBattleship.started && !placeTeamId && (
          <span className="text-muted-foreground flex items-center gap-1 font-medium">
            <Ship aria-hidden="true" className="h-3 w-3" />
            Battleship: team leaders place their ships before the event starts.
            The tiles stay blind until then.
          </span>
        )}
        {boardBattleship?.started && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ul
              role="list"
              aria-label="Battleship legend"
              className="flex items-center gap-3"
            >
              {BATTLESHIP_LEGEND.map((mark) => (
                <li
                  key={mark}
                  className="text-foreground flex items-center gap-1.5 font-medium"
                >
                  <BattleshipMarkBadge mark={mark} className="size-4" />
                  {MARK_LABEL[mark]}
                </li>
              ))}
              {ownShipsOn && (
                <li className="text-foreground flex items-center gap-1.5 font-medium">
                  <OwnShipGlyph />
                  Your ship
                  <span className="text-muted-foreground font-normal">
                    Your fleet: {ownShips.length}{" "}
                    {ownShips.length === 1 ? "ship" : "ships"}, {ownShipTiles}{" "}
                    {ownShipTiles === 1 ? "tile" : "tiles"}
                  </span>
                </li>
              )}
            </ul>
            {canToggleOwnShips && (
              <>
                <Toggle
                  variant="outline"
                  size="sm"
                  pressed={ownShipsOn}
                  onPressedChange={onShowOwnShipsChange}
                  disabled={!hasOwnShips}
                  aria-describedby={hasOwnShips ? undefined : noShipsId}
                  className="h-7 gap-1.5 px-2 text-xs pointer-coarse:min-h-11"
                >
                  <Ship aria-hidden="true" className="size-3.5" />
                  My ships
                </Toggle>
                {!hasOwnShips && (
                  <span id={noShipsId} className="text-muted-foreground">
                    Your team has no ships placed
                  </span>
                )}
              </>
            )}
            {viewFleetsHref && (
              <Link
                href={viewFleetsHref}
                className="osrs-btn focus-visible:ring-ring inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-xs whitespace-nowrap focus-visible:ring-2 focus-visible:outline-hidden pointer-coarse:min-h-11"
              >
                <Ship aria-hidden="true" className="size-3.5" />
                View fleets
              </Link>
            )}
            <span className="text-muted-foreground">
              You learn whether you hit when a tile is approved. Only your own
              team&apos;s results are shown.
            </span>
          </div>
        )}
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
            battleship={
              boardBattleship
                ? {
                    rules: boardBattleship.rules,
                    started: boardBattleship.started,
                  }
                : undefined
            }
          />
          <TrackerSettingsModal
            bingoId={activeBingo.id}
            womCompetitionId={activeBingo.womCompetitionId}
            womVerificationCode={activeBingo.womVerificationCode}
            isOpen={trackerOpen}
            onClose={() => onTrackerOpenChange(false)}
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
