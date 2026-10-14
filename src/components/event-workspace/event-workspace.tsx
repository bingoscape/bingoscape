"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ListFilter, Lock, PanelRightClose } from "lucide-react"
import BingoGrid from "@/components/bingogrid"
import { EventTimeDisplay } from "@/components/event-time-display"
import { QuickSubmissionModal } from "@/components/quick-submission-modal"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BoardHeader } from "@/components/event-workspace/board-header"
import { GoalSetupView } from "@/components/goal-setup/goal-setup-view"
import { LayoutToolbar } from "@/components/event-workspace/layout-toolbar"
import { SideRail } from "@/components/event-workspace/side-rail"
import {
  isDialogOpen,
  shouldHandlePageShortcut,
} from "@/components/event-workspace/keyboard"
import { SplitHandle } from "@/components/event-workspace/split-handle"
import { TierLadderView } from "@/components/event-workspace/tier-ladder-view"
import {
  TilePanel,
  type TileSubTab,
} from "@/components/event-workspace/tile-panel"
import { useIsDesktop } from "@/components/event-workspace/use-is-desktop"
import { useTileWorkspace } from "@/components/event-workspace/use-tile-workspace"
import {
  isPanelTab,
  useWorkspaceParams,
  type PanelTab,
} from "@/components/event-workspace/use-workspace-params"
import { reorderTiles } from "@/app/actions/bingo"
import type { EventCapabilities } from "@/lib/authz/capabilities"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { getBoardStats } from "@/lib/tile-status"
import { getTileTierLock, type BoardTierData } from "@/lib/tiers"
import {
  countTilesByFilter,
  getDimmedTileIds,
  resolveTileFilter,
  type TileFilterContext,
} from "@/lib/tile-filter"
import { resolveWorkspaceSelection } from "@/lib/workspace-selection"
import {
  DEFAULT_WORKSPACE_PREFS,
  serializeWorkspacePrefsCookie,
  sideWidthCss,
  type WorkspacePrefs,
} from "@/lib/workspace-prefs"
import type { BattleshipWorkspaceInfo } from "@/lib/battleship-workspace"
import { SunkAnnouncement } from "@/components/event-workspace/sunk-announcement"
import {
  markForTile,
  marksForViewedTeam,
  shipSegmentsByTile,
  shipsForViewedTeam,
} from "@/lib/battleship-marks"
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
  /** What the viewer may do, computed on the server (nobody in the public view). */
  capabilities: EventCapabilities
  /** The caller's own Team in this Event. */
  currentTeam: { id: string; name: string } | null
  selectableUsers: SelectableUser[]
  /** Tier unlock data for the active Board (progression Boards only). */
  tierData: BoardTierData | null
  /** Fleet info of the active Board when it is a battleship Board. */
  battleship?: BattleshipWorkspaceInfo | null
  /** Server-rendered panels. */
  teamsPanel: ReactNode
  prizePanel: ReactNode
  infoPanel: ReactNode
  /** Server-rendered summary bar above the workspace. */
  summaryBar?: ReactNode
  /** Public view: read-only Tile panel and leaderboard, no submissions. */
  readOnly?: boolean
  /**
   * Saved split-view layout. Omit for a fixed layout (public view); pass it
   * to make the side panel resizable and collapsible on desktop.
   */
  layoutPrefs?: WorkspacePrefs
}

const MOBILE_SNAP_POINTS = ["96px", 0.6, 0.92] as const

/** Height of the drawer's handle / top bar above the scrolling panel. */
const DRAWER_TOP_BAR = "1.5rem"

/**
 * The Event workspace: Board on the left (fits the viewport), tabbed side
 * panel on the right (Tile | Teams | Prize | Info). On small screens the
 * Board sits on top, Teams/Prize/Info below, and a Tile opens in a bottom
 * drawer. All shareable state lives in the URL (see use-workspace-params).
 */
export function EventWorkspace({
  event,
  capabilities,
  currentTeam,
  selectableUsers,
  tierData,
  battleship,
  teamsPanel,
  prizePanel,
  infoPanel,
  summaryBar,
  readOnly = false,
  layoutPrefs,
}: EventWorkspaceProps) {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const {
    params,
    selectTile,
    setPanel,
    setFilter,
    setView,
    setBoard,
    setTeamId,
    isSwitching,
  } = useWorkspaceParams()

  const isManagement = !readOnly && capabilities.canEditBoard

  const resizable = !!layoutPrefs
  const [prefs, setPrefs] = useState(layoutPrefs ?? DEFAULT_WORKSPACE_PREFS)
  const gridRef = useRef<HTMLDivElement>(null)
  const sideRef = useRef<HTMLElement>(null)
  const sideId = useId()
  const railMode = resizable && isDesktop && prefs.collapsed

  const updatePrefs = useCallback((next: WorkspacePrefs) => {
    setPrefs(next)
    document.cookie = serializeWorkspacePrefsCookie(next)
  }, [])
  const resizeSide = useCallback((width: number) => {
    // Written straight to the DOM while dragging so the Board does not
    // re-render per pointer move; the width is committed to state on release.
    gridRef.current?.style.setProperty("--side-w", `${width}px`)
  }, [])
  const commitSideWidth = useCallback(
    (sideWidth: number) =>
      updatePrefs({ ...prefs, sideWidth, collapsed: false }),
    [prefs, updatePrefs]
  )
  const resetSide = useCallback(
    () =>
      updatePrefs({
        ...DEFAULT_WORKSPACE_PREFS,
        showOwnShips: prefs.showOwnShips,
      }),
    [prefs.showOwnShips, updatePrefs]
  )
  const setShowOwnShips = useCallback(
    (showOwnShips: boolean) => updatePrefs({ ...prefs, showOwnShips }),
    [prefs, updatePrefs]
  )
  const toggleCollapsed = useCallback(
    () => updatePrefs({ ...prefs, collapsed: !prefs.collapsed }),
    [prefs, updatePrefs]
  )

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

  // ?view=goals only means something to people who can manage Goals.
  const setupMode = isManagement && params.view === "goals" && !!bingo

  // ?tile= must point at a Tile of this Board; hidden Tiles are ignored for
  // players.
  const selectedTile: Tile | null = useMemo(() => {
    if (!params.tile) return null
    const tile = tiles.find((t) => t.id === params.tile)
    if (!tile) return null
    if (tile.isHidden && !isManagement) return null
    // Blind Tiles (battleship before the start) have nothing to show.
    if (tile.isBlind) return null
    return tile
  }, [params.tile, tiles, isManagement])

  // Hits, misses and sunk ships belong to the viewer's own Team and are only
  // drawn on that Team's view (see `marksForViewedTeam`).
  const battleshipBoard =
    !readOnly &&
    bingo?.bingoType === "battleship" &&
    battleship?.bingoId === bingo.id
      ? battleship
      : null
  const markSets = useMemo(
    () =>
      marksForViewedTeam(
        battleshipBoard?.marks,
        currentTeam?.id,
        effectiveTeamId
      ),
    [battleshipBoard, currentTeam?.id, effectiveTeamId]
  )

  // The viewer's own ships, as Tile segments, for the same Team only. Hidden
  // Tiles never carry a hull.
  const ownShipSegments = useMemo(
    () =>
      shipSegmentsByTile(
        shipsForViewedTeam(
          battleshipBoard?.ownShips,
          currentTeam?.id,
          effectiveTeamId
        ),
        bingo?.columns ?? 0,
        tiles.filter((tile) => !tile.isHidden && !tile.isBlind)
      ),
    [battleshipBoard, currentTeam?.id, effectiveTeamId, bingo?.columns, tiles]
  )

  const [editLayout, setEditLayout] = useState(false)
  const [highlightedTiles, setHighlightedTiles] = useState<number[]>([])
  const [quickSubmitOpen, setQuickSubmitOpen] = useState(false)
  const [trackerOpen, setTrackerOpen] = useState(false)
  const [snap, setSnap] = useState<number | string | null>(0.6)
  // Lives here (not in the Tile panel) so moving between Tiles keeps the
  // reviewer on the same sub-tab.
  const [tileSubTab, setTileSubTab] = useState<TileSubTab>("details")

  const activePanelTab = params.panel
  const panelOnTile = activePanelTab === "tile"

  const workspace = useTileWorkspace({
    tile: selectedTile,
    bingo: bingo ?? { locked: false },
    currentTeamId: effectiveTeamId,
    selectableUsers,
    pasteEnabled:
      !readOnly && !!selectedTile && isDesktop && panelOnTile && !railMode,
  })

  const filterContext = useMemo<TileFilterContext>(
    () => ({ teamId: effectiveTeamId, isManagement }),
    [effectiveTeamId, isManagement]
  )
  const activeFilter = resolveTileFilter(params.filter, filterContext)
  const filterCounts = useMemo(
    () => countTilesByFilter(tiles, filterContext),
    [tiles, filterContext]
  )
  const dimmedTileIds = useMemo(
    () => getDimmedTileIds(tiles, activeFilter, filterContext),
    [tiles, activeFilter, filterContext]
  )

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
      if (!shouldHandlePageShortcut(event)) return
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

  // Keyboard: Ctrl/Cmd+\ collapses or expands the side panel.
  useEffect(() => {
    if (!resizable || !isDesktop) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "\\" || !(event.ctrlKey || event.metaKey)) return
      if (event.altKey || event.shiftKey) return
      if (isDialogOpen()) return
      event.preventDefault()
      toggleCollapsed()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [resizable, isDesktop, toggleCollapsed])

  // Keyboard: Esc closes the selected Tile (the drawer handles its own Esc).
  const hasSelectedTile = !!selectedTile
  useEffect(() => {
    if (!hasSelectedTile || !isDesktop) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (!shouldHandlePageShortcut(event)) return
      selectTile(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [hasSelectedTile, isDesktop, selectTile])

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
      // The Tile shows in the side panel, so bring it back from the rail.
      if (tileId && railMode) updatePrefs({ ...prefs, collapsed: false })
    },
    [selectTile, railMode, prefs, updatePrefs]
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

  // The drawer is 97% tall but only `snap` of the viewport is visible, so the
  // scroll container is limited to what is on screen (the rest of the panel is
  // reachable by scrolling it, not by dragging the drawer off-screen).
  const isPeek = typeof snap !== "number"
  const drawerScrollStyle: CSSProperties = isPeek
    ? { maxHeight: `calc(96px - ${DRAWER_TOP_BAR})`, overflowY: "hidden" }
    : {
        maxHeight: `calc(${snap} * 100dvh - ${DRAWER_TOP_BAR} - env(safe-area-inset-bottom))`,
      }

  const buildTilePanel = (mobile: boolean) =>
    bingo ? (
      <TilePanel
        scrollStyle={mobile ? drawerScrollStyle : undefined}
        scrollClassName={
          mobile ? "pb-[calc(env(safe-area-inset-bottom)+0.75rem)]" : undefined
        }
        tile={selectedTile}
        bingo={bingo}
        workspace={workspace}
        isManagement={isManagement}
        teams={teams}
        currentTeamId={effectiveTeamId}
        eventId={event.id}
        gameType={event.gameType}
        isProgressionBingo={bingo.bingoType === "progression"}
        tierLock={tierLock}
        battleshipMark={
          battleshipBoard && selectedTile
            ? markForTile(selectedTile.id, markSets)
            : null
        }
        ownShip={
          selectedTile ? ownShipSegments.get(selectedTile.id) : undefined
        }
        readOnly={readOnly}
        subTab={tileSubTab}
        onSubTabChange={setTileSubTab}
        onSelectTile={handleSelectTile}
        onClose={selectedTile ? () => handleSelectTile(null) : undefined}
        onOpenTrackerSettings={
          isManagement && !readOnly ? () => setTrackerOpen(true) : undefined
        }
      />
    ) : null

  return (
    <div className="flex flex-col gap-3 px-3 pb-3 sm:px-4 lg:h-[calc(100dvh-var(--nav-h)-var(--nav-gap))] lg:overflow-hidden">
      {summaryBar}

      {!bingo ? (
        <EmptyBoards isManagement={isManagement} />
      ) : (
        <div
          ref={gridRef}
          style={{ "--side-w": sideWidthCss(prefs) } as CSSProperties}
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-3 lg:grid",
            resizable
              ? "lg:grid-cols-[minmax(0,1fr)_0.75rem_var(--side-w)] lg:gap-0"
              : "lg:grid-cols-[minmax(0,1fr)_var(--side-w)]"
          )}
        >
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
              onToggleEditLayout={() => {
                // Editing the layout happens on the Board itself.
                if (!editLayout) setView(null)
                setEditLayout((v) => !v)
              }}
              onQuickSubmit={() => setQuickSubmitOpen(true)}
              isUpcoming={isUpcoming}
              isSwitching={isSwitching}
              canCollapsePanel={resizable}
              trackerOpen={trackerOpen}
              onTrackerOpenChange={setTrackerOpen}
              filters={{
                context: filterContext,
                active: activeFilter,
                counts: filterCounts,
                onChange: setFilter,
              }}
              battleship={battleship}
              showOwnShips={prefs.showOwnShips}
              onShowOwnShipsChange={setShowOwnShips}
              onSetUpGoals={
                isManagement && !setupMode ? () => setView("goals") : undefined
              }
              goalHealth={
                isManagement && !setupMode
                  ? {
                      tiles,
                      selectedTileId: selectedTile?.id ?? null,
                      onSelectTile: handleSelectTile,
                    }
                  : undefined
              }
            />

            {battleshipBoard && (
              <SunkAnnouncement
                key={battleshipBoard.bingoId}
                sunkTileIds={battleshipBoard.marks.sunkTileIds}
              />
            )}

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

            <div
              aria-busy={isSwitching}
              className={cn(
                "flex min-h-0 flex-1 flex-col transition-opacity",
                isSwitching && "opacity-60"
              )}
            >
              {setupMode ? (
                <GoalSetupView
                  key={bingo.id}
                  bingoId={bingo.id}
                  tiles={tiles}
                  womLinked={bingo.womCompetitionId != null}
                  onBack={() => setView(null)}
                  onOpenTile={handleSelectTile}
                  onRefresh={refresh}
                  onOpenTrackerSettings={() => setTrackerOpen(true)}
                />
              ) : isUpcoming && !isManagement ? (
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
                  isManagement={isManagement}
                  currentTeamId={effectiveTeamId}
                  selectedTileId={selectedTile?.id ?? null}
                  dimmedTileIds={dimmedTileIds}
                  onSelectTile={handleSelectTile}
                />
              ) : (
                <BingoGrid
                  key={bingo.id}
                  bingo={bingo}
                  isManagement={isManagement}
                  currentTeamId={effectiveTeamId}
                  tierData={tierData}
                  isLayoutLocked={!(editLayout && isManagement)}
                  onReorderTiles={handleReorderTiles}
                  highlightedTiles={highlightedTiles}
                  onTileUpdated={refresh}
                  selectedTileId={selectedTile?.id ?? null}
                  dimmedTileIds={dimmedTileIds}
                  onSelectTile={handleSelectTile}
                  readOnly={readOnly}
                  marks={battleshipBoard ? markSets : undefined}
                  ownShips={battleshipBoard ? ownShipSegments : undefined}
                  showOwnShips={prefs.showOwnShips}
                />
              )}
            </div>
          </section>

          {resizable && !railMode && (
            <SplitHandle
              containerRef={gridRef}
              sideRef={sideRef}
              controlsId={sideId}
              onResize={resizeSide}
              onCommit={commitSideWidth}
              onReset={resetSide}
              onToggleCollapse={toggleCollapsed}
            />
          )}
          {resizable && railMode && <div aria-hidden="true" />}

          <aside
            ref={sideRef}
            id={sideId}
            aria-label="Event details"
            className="osrs-panel flex min-h-0 min-w-0 flex-col rounded-sm lg:h-full"
          >
            {railMode ? (
              <SideRail
                activeTab={activePanelTab}
                onSelectTab={(tab) => {
                  setPanel(tab)
                  updatePrefs({ ...prefs, collapsed: false })
                }}
                onExpand={toggleCollapsed}
              />
            ) : (
              <Tabs
                value={panelTabValue}
                onValueChange={(value) => {
                  if (isPanelTab(value)) setPanel(value)
                }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex shrink-0 items-center">
                  <TabsList className="m-2 grid h-auto min-h-11 flex-1 grid-cols-3 lg:min-h-10 lg:grid-cols-4">
                    <TabsTrigger value="tile" className="hidden lg:inline-flex">
                      Tile
                    </TabsTrigger>
                    <TabsTrigger value="teams">Teams</TabsTrigger>
                    <TabsTrigger value="prize">Prize</TabsTrigger>
                    <TabsTrigger value="info">Info</TabsTrigger>
                  </TabsList>
                  {resizable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mr-2 hidden shrink-0 lg:inline-flex"
                      aria-label="Collapse side panel"
                      title="Collapse side panel (Ctrl/Cmd+\)"
                      onClick={toggleCollapsed}
                    >
                      <PanelRightClose aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <div className="min-h-0 flex-1 lg:overflow-y-auto">
                  {isDesktop && (
                    <TabsContent value="tile" className="mt-0 h-full">
                      {buildTilePanel(false)}
                    </TabsContent>
                  )}
                  <TabsContent value="teams" className="mt-0 px-3 pb-3">
                    {teamsPanel}
                  </TabsContent>
                  <TabsContent value="prize" className="mt-0 px-3 pb-3">
                    {prizePanel}
                  </TabsContent>
                  <TabsContent value="info" className="mt-0 px-3 pb-3">
                    {infoPanel}
                  </TabsContent>
                </div>
              </Tabs>
            )}
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
          <DrawerContent className="h-full max-h-[97%] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
            <DrawerTitle className="sr-only">
              {selectedTile?.title ?? "Tile details"}
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              Tile details, goals and submissions
            </DrawerDescription>
            {buildTilePanel(true)}
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
      <div className="bg-muted mb-4 flex h-20 w-20 items-center justify-center rounded-sm">
        <ListFilter
          aria-hidden="true"
          className="text-muted-foreground h-10 w-10"
        />
      </div>
      <h2 className="osrs-heading mb-2 text-xl">No bingo boards available</h2>
      <p className="text-muted-foreground max-w-md">
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
      <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-sm">
        <Lock aria-hidden="true" className="text-muted-foreground h-8 w-8" />
      </div>
      <h2 className="osrs-heading mb-2 text-xl">Board Locked</h2>
      <p className="text-muted-foreground mb-4 max-w-md">
        This bingo board is currently locked and will become available at:
      </p>
      {unlockDate && (
        <div className="osrs-panel-inset rounded-sm px-4 py-3 text-lg font-medium">
          <EventTimeDisplay
            date={unlockDate}
            label="Unlocks"
            eventTz={timezone}
          />
        </div>
      )}
    </div>
  )
}
