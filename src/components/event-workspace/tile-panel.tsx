"use client"

import { useMemo } from "react"
import type { CSSProperties } from "react"
import type React from "react"
import Image from "next/image"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  EyeOff,
  ImageIcon,
  Info,
  Lock,
  Target,
  Users,
  X,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { FullSizeImageDialog } from "@/components/full-size-image-dialog"
import { GoalsTab } from "@/components/goals-tab"
import { SubmissionsTab } from "@/components/submissions-tab"
import { TileDetailsTab } from "@/components/tile-details-tab"
import type { TileWorkspace } from "@/components/event-workspace/use-tile-workspace"
import type { EventRole } from "@/app/actions/events"
import {
  getAttentionTiles,
  getBoardStats,
  getTileTeamStatus,
} from "@/lib/tile-status"
import getRandomFrog from "@/lib/getRandomFrog"
import type { Bingo, Team, Tile } from "@/types/model"

export interface TierLockInfo {
  tier: number
  /** XP the viewed Team still needs in the previous Tier to unlock this one. */
  xpNeeded: number
}

interface TilePanelProps {
  tile: Tile | null
  bingo: Bingo
  workspace: TileWorkspace
  userRole: EventRole
  teams: Team[]
  /** The Team whose progress is shown / submitted for (effective Team). */
  currentTeamId: string | undefined
  eventId: string
  gameType: "osrs" | "rs3"
  isProgressionBingo: boolean
  /** Set when the selected Tile's Tier is still locked for the viewed Team. */
  tierLock?: TierLockInfo | null
  /** Public view: description and progress only, no submissions or editing. */
  readOnly?: boolean
  /** Active sub-tab; owned by the caller so it survives Tile changes. */
  subTab: TileSubTab
  onSubTabChange: (subTab: TileSubTab) => void
  onSelectTile: (tileId: string) => void
  onClose?: () => void
  /** Extra classes for the scroll container (the mobile drawer limits its height). */
  scrollClassName?: string
  scrollStyle?: CSSProperties
}

export type TileSubTab = "details" | "submissions" | "goals"

/**
 * The panel's single scroll owner and its size container: every responsive
 * rule inside the panel keys off this container's width (`@sm/tile:` ...), not
 * the viewport, because the panel is 360-480px wide at any desktop width.
 * Nothing inside may add a nested vertical scroller.
 */
function TilePanelScroll({
  className,
  style,
  children,
}: {
  className?: string
  style?: CSSProperties
  children: React.ReactNode
}) {
  return (
    <div
      data-tile-scroll
      style={style}
      className={cn(
        "@container/tile flex h-full min-h-0 flex-1 [scrollbar-gutter:stable] flex-col overflow-y-auto overscroll-contain px-3 pb-3",
        // Touch: every control in the panel is at least 44px tall.
        "pointer-coarse:[&_button:not([role=checkbox]):not([role=switch]):not([role=radio])]:min-h-11",
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Content of the Tile side panel (desktop) and bottom drawer (mobile): what
 * used to be the Tile details dialog. The Tile always comes from server props;
 * `workspace` (useTileWorkspace) owns the transient edit/upload state.
 */
export function TilePanel({
  tile,
  bingo,
  workspace,
  userRole,
  teams,
  currentTeamId,
  eventId,
  gameType,
  isProgressionBingo,
  tierLock,
  readOnly = false,
  subTab,
  onSubTabChange,
  onSelectTile,
  onClose,
  scrollClassName,
  scrollStyle,
}: TilePanelProps) {
  const canEdit =
    !readOnly && (userRole === "admin" || userRole === "management")

  if (!tile) {
    return (
      <TilePanelScroll className={scrollClassName} style={scrollStyle}>
        <TilePanelEmpty
          bingo={bingo}
          currentTeamId={currentTeamId}
          teams={teams}
          onSelectTile={onSelectTile}
          readOnly={readOnly}
        />
      </TilePanelScroll>
    )
  }

  return (
    <TilePanelScroll className={scrollClassName} style={scrollStyle}>
      <TilePanelBody
        key={tile.id}
        tile={tile}
        bingo={bingo}
        workspace={workspace}
        userRole={userRole}
        teams={teams}
        currentTeamId={currentTeamId}
        eventId={eventId}
        gameType={gameType}
        isProgressionBingo={isProgressionBingo}
        tierLock={tierLock}
        readOnly={readOnly}
        canEdit={canEdit}
        subTab={subTab}
        onSubTabChange={onSubTabChange}
        onClose={onClose}
      />
    </TilePanelScroll>
  )
}

function TilePanelBody({
  tile,
  bingo,
  workspace,
  userRole,
  teams,
  currentTeamId,
  eventId,
  gameType,
  isProgressionBingo,
  tierLock,
  readOnly,
  canEdit,
  subTab: requestedSubTab,
  onSubTabChange,
  onClose,
}: Omit<
  TilePanelProps,
  "onSelectTile" | "tile" | "scrollClassName" | "scrollStyle"
> & {
  tile: Tile
  canEdit: boolean
}) {
  const isManagement = userRole === "admin" || userRole === "management"
  const { completion, submissionState } = getTileTeamStatus(tile, currentTeamId)

  const pendingCount = useMemo(() => {
    return (
      tile.teamTileSubmissions?.reduce((acc, teamSub) => {
        if (!isManagement && teamSub.teamId !== currentTeamId) return acc
        return (
          acc +
          teamSub.submissions.filter(
            (sub) => sub.status === "pending" || sub.status === "needs_review"
          ).length
        )
      }, 0) ?? 0
    )
  }, [tile.teamTileSubmissions, isManagement, currentTeamId])

  // Public view: progress for the selected Team only.
  const progressTeams = useMemo(
    () => (readOnly ? teams.filter((t) => t.id === currentTeamId) : teams),
    [readOnly, teams, currentTeamId]
  )

  // A remembered sub-tab this view does not offer falls back to Details.
  const subTab: TileSubTab =
    (requestedSubTab === "submissions" && readOnly) ||
    (requestedSubTab === "goals" && !canEdit)
      ? "details"
      : requestedSubTab

  const showJoinBanner = !readOnly && !isManagement && !currentTeamId

  return (
    <div className="flex shrink-0 flex-col gap-3 pt-3">
      <header className="flex items-start gap-3">
        <div className="osrs-slot relative size-10 shrink-0 overflow-hidden rounded-sm @sm/tile:size-16">
          {tile.headerImage ? (
            <Image
              unoptimized
              src={tile.headerImage || getRandomFrog()}
              alt=""
              fill
              sizes="(min-width: 384px) 64px, 40px"
              className="object-contain"
            />
          ) : (
            <div className="bg-secondary text-muted-foreground flex h-full w-full items-center justify-center text-xs">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2
            title={tile.title || undefined}
            className="osrs-heading text-foreground line-clamp-4 text-base leading-tight wrap-break-word @sm/tile:text-lg"
          >
            {tile.title || "Hidden tile"}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="gap-1">
              <Zap aria-hidden="true" className="text-warning h-3 w-3" />
              {tile.weight} XP
            </Badge>
            {currentTeamId && completion === "completed" && (
              <Badge variant="success">
                <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                Completed
              </Badge>
            )}
            {currentTeamId &&
              completion !== "completed" &&
              submissionState === "needs_review" && (
                <Badge variant="warning">
                  <AlertCircle aria-hidden="true" className="h-3 w-3" />
                  Changes requested
                </Badge>
              )}
            {currentTeamId &&
              completion !== "completed" &&
              submissionState === "pending" && (
                <Badge variant="pending">
                  <Clock aria-hidden="true" className="h-3 w-3" />
                  Pending review
                </Badge>
              )}
            {currentTeamId &&
              completion !== "completed" &&
              submissionState === "approved" && (
                <Badge variant="info">In progress</Badge>
              )}
            {tile.isHidden && (
              <Badge variant="secondary">
                <EyeOff aria-hidden="true" className="h-3 w-3" />
                Hidden
              </Badge>
            )}
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="-mt-1 -mr-1 size-9 shrink-0 pointer-coarse:size-11"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Close tile details</span>
          </Button>
        )}
      </header>

      {tierLock && (
        <Notice
          tone="warning"
          icon={<Lock aria-hidden="true" className="h-4 w-4" />}
        >
          Locked: need {tierLock.xpNeeded} more XP in Tier {tierLock.tier - 1}{" "}
          to unlock Tier {tierLock.tier}.
        </Notice>
      )}

      {showJoinBanner && (
        <Notice
          tone="info"
          icon={<Users aria-hidden="true" className="h-4 w-4" />}
        >
          Join a team to submit. Ask an event organizer to add you to one.
        </Notice>
      )}

      <Tabs
        value={subTab}
        onValueChange={(v) => onSubTabChange(v as TileSubTab)}
        className="flex min-h-0 flex-col"
      >
        <div className="bg-card sticky top-0 z-10 -mx-3 px-3 pt-1 pb-2">
          <TabsList variant="scrollable" className="h-auto">
            <SubTabTrigger
              value="details"
              label="Details"
              icon={<Info aria-hidden="true" className="size-4 shrink-0" />}
              active={subTab === "details"}
            />
            {!readOnly && (
              <SubTabTrigger
                value="submissions"
                label="Submissions"
                icon={
                  <ImageIcon aria-hidden="true" className="size-4 shrink-0" />
                }
                active={subTab === "submissions"}
                badge={
                  pendingCount > 0 ? (
                    <span
                      aria-label={`${pendingCount} pending`}
                      className="bg-info text-info-foreground flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm px-1 text-[10px] font-medium"
                    >
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  ) : null
                }
              />
            )}
            {canEdit && (
              <SubTabTrigger
                value="goals"
                label="Goals"
                accessibleLabel="Goals (edit)"
                icon={<Target aria-hidden="true" className="size-4 shrink-0" />}
                active={subTab === "goals"}
              />
            )}
          </TabsList>
        </div>

        <TabsContent value="details" className="mt-3">
          <TileDetailsTab
            embedded
            selectedTile={tile}
            editedTile={workspace.editedTile}
            userRole={readOnly ? "participant" : userRole}
            teams={progressTeams}
            eventId={eventId}
            gameType={gameType}
            isProgressionBingo={isProgressionBingo}
            onEditTile={workspace.onEditTile}
            onUpdateTile={workspace.onUpdateTile}
            onEditorChange={workspace.onEditorChange}
            onUpdateProgress={workspace.onUpdateProgress}
          />
        </TabsContent>

        {!readOnly && (
          <TabsContent value="submissions" className="mt-3">
            <SubmissionsTab
              stacked
              teamTileSubmissions={tile.teamTileSubmissions ?? []}
              selectedTile={tile}
              currentTeamId={currentTeamId}
              teams={teams}
              hasSufficientRights={isManagement}
              selectedImage={workspace.selectedImage}
              pastedImage={workspace.pastedImage}
              isSubmissionsLocked={bingo.locked || false}
              isUploadingImage={workspace.isUploadingImage}
              onImageChange={workspace.onImageChange}
              onImageSubmit={workspace.onImageSubmit}
              onFullSizeImageView={(src, alt) =>
                workspace.setFullSizeImage({ src, alt })
              }
              onTeamTileSubmissionStatusUpdate={
                workspace.onTeamTileSubmissionStatusUpdate
              }
              onSubmissionStatusUpdate={workspace.onSubmissionStatusUpdate}
              onDeleteSubmission={workspace.onDeleteSubmission}
              selectableUsers={workspace.selectableUsers}
              selectedUserId={workspace.selectedUserId}
              onUserSelect={workspace.onUserSelect}
            />
          </TabsContent>
        )}

        {canEdit && (
          <TabsContent value="goals" className="mt-3">
            <GoalsTab
              embedded
              selectedTile={tile}
              newGoal={workspace.newGoal}
              hasSufficientRights={isManagement}
              onDeleteGoal={workspace.onDeleteGoal}
              onAddGoal={workspace.onAddGoal}
              onNewGoalChange={workspace.onNewGoalChange}
              onGoalsChanged={workspace.refresh}
            />
          </TabsContent>
        )}
      </Tabs>

      <FullSizeImageDialog
        isOpen={!!workspace.fullSizeImage}
        onClose={() => workspace.setFullSizeImage(null)}
        imageSrc={workspace.fullSizeImage?.src ?? ""}
        imageAlt={workspace.fullSizeImage?.alt ?? ""}
      />
    </div>
  )
}

/**
 * Sub-tab trigger: icon + label from the panel's `@sm` width up; below that
 * only the active tab shows its label (inactive ones are icon-only, with an
 * aria-label/title so the name is never lost).
 */
function SubTabTrigger({
  value,
  label,
  accessibleLabel,
  icon,
  active,
  badge,
}: {
  value: TileSubTab
  label: string
  accessibleLabel?: string
  icon: React.ReactNode
  active: boolean
  badge?: React.ReactNode
}) {
  const name = accessibleLabel ?? label
  return (
    <TabsTrigger
      value={value}
      aria-label={name}
      title={name}
      className="min-h-9 min-w-0 flex-1 shrink gap-1.5 px-2 @sm/tile:px-3 pointer-coarse:min-h-11"
    >
      {icon}
      <span className={cn("truncate", !active && "hidden @sm/tile:inline")}>
        {label}
      </span>
      {badge}
    </TabsTrigger>
  )
}

/** Panel without a selection: the Team's progress and what needs attention. */
function TilePanelEmpty({
  bingo,
  currentTeamId,
  teams,
  onSelectTile,
  readOnly,
}: {
  bingo: Bingo
  currentTeamId: string | undefined
  teams: Team[]
  onSelectTile: (tileId: string) => void
  readOnly?: boolean
}) {
  const stats = useMemo(
    () => getBoardStats(bingo.tiles, currentTeamId),
    [bingo.tiles, currentTeamId]
  )
  const attention = useMemo(
    () =>
      getAttentionTiles(
        (bingo.tiles ?? []).filter((t) => !t.isHidden),
        currentTeamId
      ),
    [bingo.tiles, currentTeamId]
  )
  const team = teams.find((t) => t.id === currentTeamId)

  return (
    <div className="flex shrink-0 flex-col gap-4 pt-3">
      <div>
        <h2 className="osrs-heading text-foreground text-lg">
          {team ? `${team.name} progress` : "Select a Tile"}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {readOnly
            ? "Select a Tile on the board to see its description and Goals."
            : "Select a Tile on the board to see its details, Goals and Submissions."}
        </p>
      </div>

      {currentTeamId ? (
        <>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Completed" value={stats.completed} tone="success" />
            <Stat label="Pending" value={stats.pending} tone="pending" />
            <Stat label="Changes" value={stats.needsReview} tone="warning" />
          </dl>
          <p className="text-muted-foreground text-xs">
            {stats.xpEarned} / {stats.xpTotal} XP on this board ({stats.percent}
            %)
          </p>

          {attention.length > 0 && (
            <section aria-label="Needs attention">
              <h3 className="text-foreground mb-2 text-sm font-semibold">
                Needs attention
              </h3>
              <ul className="flex flex-col gap-1.5">
                {attention.map(({ tile, state }) => (
                  <li key={tile.id}>
                    <button
                      type="button"
                      onClick={() => onSelectTile(tile.id)}
                      className="osrs-panel-inset hover:border-primary focus-visible:ring-ring flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-hidden"
                    >
                      {state === "needs_review" ? (
                        <AlertCircle
                          aria-hidden="true"
                          className="text-warning h-4 w-4 shrink-0"
                        />
                      ) : (
                        <Clock
                          aria-hidden="true"
                          className="text-pending h-4 w-4 shrink-0"
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {tile.title}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {state === "needs_review"
                          ? "Changes requested"
                          : "Pending"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        !readOnly && (
          <Notice
            tone="info"
            icon={<Users aria-hidden="true" className="h-4 w-4" />}
          >
            Join a team to submit.
          </Notice>
        )
      )}
    </div>
  )
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: "info" | "warning"
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      role="status"
      className={`osrs-panel-inset flex items-start gap-2 rounded-sm p-2 text-sm ${
        tone === "warning" ? "border-warning" : "border-info"
      }`}
    >
      <span
        className={`mt-0.5 shrink-0 ${tone === "warning" ? "text-warning" : "text-info"}`}
      >
        {icon}
      </span>
      <p>{children}</p>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "success" | "pending" | "warning"
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "pending"
        ? "text-pending"
        : "text-warning"
  return (
    <div className="osrs-panel-inset rounded-sm px-2 py-2">
      <dd className={`osrs-heading text-2xl ${color}`}>{value}</dd>
      <dt className="text-muted-foreground text-xs">{label}</dt>
    </div>
  )
}
