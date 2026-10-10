"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ListFilter, Lock } from "lucide-react"
import BingoGrid from "@/components/bingogrid"
import { EventTimeDisplay } from "@/components/event-time-display"
import { QuickSubmissionModal } from "@/components/quick-submission-modal"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BoardHeader } from "@/components/event-workspace/board-header"
import { LayoutToolbar } from "@/components/event-workspace/layout-toolbar"
import { TierLadderView } from "@/components/event-workspace/tier-ladder-view"
import { TilePanel } from "@/components/event-workspace/tile-panel"
import { useIsDesktop } from "@/components/event-workspace/use-is-desktop"
import { useTileWorkspace } from "@/components/event-workspace/use-tile-workspace"
import {
  isPanelTab,
  useWorkspaceParams,
  type PanelTab,
} from "@/components/event-workspace/use-workspace-params"
import { reorderTiles } from "@/app/actions/bingo"
import type { EventRole } from "@/app/actions/events"
import { toast } from "@/hooks/use-toast"
import { getBoardStats } from "@/lib/tile-status"
import { getTileTierLock, type BoardTierData } from "@/lib/tiers"
import { resolveWorkspaceSelection } from "@/lib/workspace-selection"
import type { Bingo, SelectableUser, Team, Tile } from "@/types/model"

/** What the workspace needs from an Event (the public view has no full Event). */
export interface WorkspaceEvent {
  id: string
  startDate: Date
  timezone: string
  gameType: "osrs" | "rs3"
  bingos?: Bingo[]
  teams?: Team[]
}

interface EventWorkspaceProps {
  event: WorkspaceEvent
  userRole: EventRole
  /** The caller's own Team in this Event. */
  currentTeam: { id: string; name: string } | null
  selectableUsers: SelectableUser[]
  /** Tier unlock data for the active Board (progression Boards only). */
  tierData: BoardTierData | null
  /** Server-rendered panels. */
  teamsPanel: ReactNode
  prizePanel: ReactNode
  infoPanel: ReactNode
  /** Server-rendered summary bar above the workspace. */
  summaryBar?: ReactNode
  /** Public view: read-only Tile panel and leaderboard, no submissions. */
  readOnly?: boolean
}

const MOBILE_SNAP_POINTS = ["96px", 0.6, 0.92] as const

/**
 * The Event workspace: Board on the left (fits the viewport), tabbed side
 * panel on the right (Tile | Teams | Prize | Info). On small screens the
 * Board sits on top, Teams/Prize/Info below, and a Tile opens in a bottom
 * drawer. All shareable state lives in the URL (see use-workspace-params).
 */
export function EventWorkspace({
  event,
  userRole,
  currentTeam,
  selectableUsers,
  tierData,
  teamsPanel,
  prizePanel,
  infoPanel,
  summaryBar,
  readOnly = false,
}: EventWorkspaceProps) {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const { params, selectTile, setPanel, setBoard, setTeamId } =
    useWorkspaceParams()

  const isManagement =
    !readOnly && (userRole === "admin" || userRole === "management")

  const teams: Team[] = useMemo(() => event.teams ?? [], [event.teams])

  const { bingos, bingo, effectiveTeamId } = useMemo(
    () =>
      resolveWorkspaceSelection({
        bingos: event.bingos,
        teams,
        isManagement,
        readOnly,
        ownTeamId: currentTeam?.id,
        board: params.board,
        teamId: params.teamId,
      }),
    [
      event.bingos,
      teams,
      isManagement,
      readOnly,
      currentTeam?.id,
      params.board,
      params.teamId,
    ]
  )

  const tiles = useMemo(() => bingo?.tiles ?? [], [bingo?.tiles])

  // ?tile= must point at a Tile of this Board; hidden Tiles are ignored for
  // players.
  const selectedTile: Tile | null = useMemo(() => {
    if (!params.tile) return null
    const tile = tiles.find((t) => t.id === params.tile)
    if (!tile) return null
    if (tile.isHidden && !isManagement) return null
    return tile
  }, [params.tile, tiles, isManagement])

  const [editLayout, setEditLayout] = useState(false)
  const [highlightedTiles, setHighlightedTiles] = useState<number[]>([])
  const [quickSubmitOpen, setQuickSubmitOpen] = useState(false)
  const [snap, setSnap] = useState<number | string | null>(0.6)

  const activePanelTab = params.panel
  const panelOnTile = activePanelTab === "tile"

  const workspace = useTileWorkspace({
    tile: selectedTile,
    bingo: bingo ?? { locked: false },
    currentTeamId: effectiveTeamId,
    selectableUsers,
    pasteEnabled: !readOnly && !!selectedTile && isDesktop && panelOnTile,
  })

  const stats = useMemo(
    () => getBoardStats(tiles, effectiveTeamId),
    [tiles, effectiveTeamId]
  )

  const pendingSubmissionCount = useMemo(() => {
    let count = 0
    for (const tile of tiles) {
      for (const tts of tile.teamTileSubmissions ?? []) {
        count += tts.submissions.filter((s) => s.status === "pending").length
      }
    }
    return count
  }, [tiles])

  const isUpcoming = !!bingo && bingo.locked && !bingo.visible
  const unlockDate = bingo
    ? bingo.scheduledUnlockDate
      ? new Date(bingo.scheduledUnlockDate)
      : new Date(event.startDate)
    : null

  const tierLock = useMemo(
    () =>
      selectedTile
        ? getTileTierLock(selectedTile, tiles, effectiveTeamId, tierData)
        : null,
    [selectedTile, tiles, effectiveTeamId, tierData]
  )

  // Keyboard: [ and ] switch Boards (ignored while typing or in a dialog).
  useEffect(() => {
    if (bingos.length < 2) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "[" && event.key !== "]") return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return
      }
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        return
      }
      const index = bingos.findIndex((b) => b.id === bingo?.id)
      const next =
        event.key === "]"
          ? (index + 1) % bingos.length
          : (index - 1 + bingos.length) % bingos.length
      const nextBingo = bingos[next]
      if (nextBingo) setBoard(nextBingo.id)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [bingos, bingo?.id, setBoard])

  const refresh = useCallback(() => router.refresh(), [router])

  const handleReorderTiles = useCallback(
    async (reordered: Tile[]) => {
      const result = await reorderTiles(
        reordered.map((tile, index) => ({ id: tile.id, index }))
      )
      if (result.success) {
        toast({
          title: "Tiles reordered",
          description: "The tiles have been successfully reordered and saved.",
        })
        refresh()
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to reorder tiles",
          variant: "destructive",
        })
      }
    },
    [refresh]
  )

  const handleSelectTile = useCallback(
    (tileId: string | null) => {
      selectTile(tileId)
      if (tileId) setSnap(0.6)
    },
    [selectTile]
  )

  const handleSelectBoard = useCallback(
    (bingoId: string) => {
      setEditLayout(false)
      setBoard(bingoId)
    },
    [setBoard]
  )

  const panelTabValue: PanelTab =
    !isDesktop && activePanelTab === "tile" ? "teams" : activePanelTab

  const tilePanel = bingo ? (
    <TilePanel
      tile={selectedTile}
      bingo={bingo}
      workspace={workspace}
      userRole={userRole}
      teams={teams}
      currentTeamId={effectiveTeamId}
      eventId={event.id}
      gameType={event.gameType}
      isProgressionBingo={bingo.bingoType === "progression"}
      tierLock={tierLock}
      readOnly={readOnly}
      onSelectTile={handleSelectTile}
      onClose={selectedTile ? () => handleSelectTile(null) : undefined}
    />
  ) : null

  return (
    <div className="flex flex-col gap-3 px-3 pb-3 sm:px-4 lg:h-[calc(100dvh-var(--nav-h)-var(--nav-gap))] lg:overflow-hidden">
      {summaryBar}

      {!bingo ? (
        <EmptyBoards isManagement={isManagement} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(360px,30vw,480px)]">
          <section
            aria-label="Board"
            className="flex min-h-0 min-w-0 flex-col gap-2"
          >
            <BoardHeader
              eventId={event.id}
              bingos={bingos}
              activeBingo={bingo}
              onSelectBoard={handleSelectBoard}
              stats={stats}
              teams={teams}
              isManagement={isManagement}
              readOnly={readOnly}
              ownTeam={currentTeam}
              effectiveTeamId={effectiveTeamId}
              onTeamChange={setTeamId}
              pendingSubmissionCount={pendingSubmissionCount}
              editLayout={editLayout}
              onToggleEditLayout={() => setEditLayout((v) => !v)}
              onQuickSubmit={() => setQuickSubmitOpen(true)}
              isUpcoming={isUpcoming}
            />

            {editLayout && isManagement && (
              <LayoutToolbar
                bingoId={bingo.id}
                tiles={tiles}
                columns={bingo.columns}
                onHighlight={setHighlightedTiles}
                onDone={() => {
                  setEditLayout(false)
                  setHighlightedTiles([])
                }}
              />
            )}

            <div className="flex min-h-0 flex-1 flex-col">
              {isUpcoming && !isManagement ? (
                <LockedBoard
                  unlockDate={unlockDate}
                  timezone={event.timezone || "UTC"}
                />
              ) : bingo.bingoType === "progression" &&
                !(editLayout && isManagement) &&
                tierData ? (
                <TierLadderView
                  key={bingo.id}
                  tiles={tiles}
                  columns={bingo.columns}
                  tierData={tierData}
                  userRole={readOnly ? "participant" : userRole}
                  currentTeamId={effectiveTeamId}
                  selectedTileId={selectedTile?.id ?? null}
                  onSelectTile={handleSelectTile}
                />
              ) : (
                <BingoGrid
                  key={bingo.id}
                  bingo={bingo}
                  userRole={readOnly ? "participant" : userRole}
                  currentTeamId={effectiveTeamId}
                  tierData={tierData}
                  isLayoutLocked={!(editLayout && isManagement)}
                  onReorderTiles={handleReorderTiles}
                  highlightedTiles={highlightedTiles}
                  onTileUpdated={refresh}
                  selectedTileId={selectedTile?.id ?? null}
                  onSelectTile={handleSelectTile}
                  readOnly={readOnly}
                />
              )}
            </div>
          </section>

          <aside
            aria-label="Event details"
            className="osrs-panel flex min-h-0 flex-col rounded-sm lg:h-full"
          >
            <Tabs
              value={panelTabValue}
              onValueChange={(value) => {
                if (isPanelTab(value)) setPanel(value)
              }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="m-2 grid shrink-0 grid-cols-3 lg:grid-cols-4">
                <TabsTrigger value="tile" className="hidden lg:inline-flex">
                  Tile
                </TabsTrigger>
                <TabsTrigger value="teams">Teams</TabsTrigger>
                <TabsTrigger value="prize">Prize</TabsTrigger>
                <TabsTrigger value="info">Info</TabsTrigger>
              </TabsList>
              <div className="min-h-0 flex-1 px-3 pb-3 lg:overflow-y-auto">
                {isDesktop && (
                  <TabsContent value="tile" className="mt-0">
                    {tilePanel}
                  </TabsContent>
                )}
                <TabsContent value="teams" className="mt-0">
                  {teamsPanel}
                </TabsContent>
                <TabsContent value="prize" className="mt-0">
                  {prizePanel}
                </TabsContent>
                <TabsContent value="info" className="mt-0">
                  {infoPanel}
                </TabsContent>
              </div>
            </Tabs>
          </aside>
        </div>
      )}

      {/* Mobile: non-modal drawer with the same Tile panel. */}
      {!isDesktop && bingo && (
        <Drawer
          open={!!selectedTile}
          onOpenChange={(open) => {
            if (!open) handleSelectTile(null)
          }}
          modal={false}
          shouldScaleBackground={false}
          snapPoints={[...MOBILE_SNAP_POINTS]}
          activeSnapPoint={snap}
          setActiveSnapPoint={setSnap}
        >
          <DrawerContent className="h-full max-h-[97%]">
            <DrawerTitle className="sr-only">
              {selectedTile?.title ?? "Tile details"}
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              Tile details, goals and submissions
            </DrawerDescription>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-8">
              {tilePanel}
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Quick submission (players with a Team) */}
      {!readOnly && bingo && currentTeam && (
        <QuickSubmissionModal
          isOpen={quickSubmitOpen}
          onClose={() => setQuickSubmitOpen(false)}
          bingo={bingo}
          currentTeamId={currentTeam.id}
          currentTeam={teams.find((t) => t.id === currentTeam.id)}
          eventId={event.id}
          onSubmissionComplete={refresh}
        />
      )}
    </div>
  )
}

function EmptyBoards({ isManagement }: { isManagement: boolean }) {
  return (
    <div className="osrs-panel flex flex-1 flex-col items-center justify-center rounded-sm px-6 py-12 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-sm bg-muted">
        <ListFilter aria-hidden="true" className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="osrs-heading mb-2 text-xl">No bingo boards available</h2>
      <p className="max-w-md text-muted-foreground">
        {isManagement
          ? "Create your first bingo from the Admin menu to get started with this event."
          : "The event organizers haven't created any bingo boards yet. Check back later!"}
      </p>
    </div>
  )
}

function LockedBoard({
  unlockDate,
  timezone,
}: {
  unlockDate: Date | null
  timezone: string
}) {
  return (
    <div className="osrs-panel flex flex-1 flex-col items-center justify-center rounded-sm p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-sm bg-muted">
        <Lock aria-hidden="true" className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="osrs-heading mb-2 text-xl">Board Locked</h2>
      <p className="mb-4 max-w-md text-muted-foreground">
        This bingo board is currently locked and will become available at:
      </p>
      {unlockDate && (
        <div className="osrs-panel-inset rounded-sm px-4 py-3 text-lg font-medium">
          <EventTimeDisplay date={unlockDate} label="Unlocks" eventTz={timezone} />
        </div>
      )}
    </div>
  )
}
