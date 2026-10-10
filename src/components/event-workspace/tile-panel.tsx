"use client"

import { useMemo, useState } from "react"
import type React from "react"
import Image from "next/image"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  EyeOff,
  Lock,
  Users,
  X,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  onSelectTile: (tileId: string) => void
  onClose?: () => void
}

type SubTab = "details" | "submissions" | "goals"

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
  onSelectTile,
  onClose,
}: TilePanelProps) {
  const canEdit = !readOnly && (userRole === "admin" || userRole === "management")

  if (!tile) {
    return (
      <TilePanelEmpty
        bingo={bingo}
        currentTeamId={currentTeamId}
        teams={teams}
        onSelectTile={onSelectTile}
        readOnly={readOnly}
      />
    )
  }

  return (
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
      onClose={onClose}
    />
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
  onClose,
}: Omit<TilePanelProps, "onSelectTile" | "tile"> & {
  tile: Tile
  canEdit: boolean
}) {
  const [subTab, setSubTab] = useState<SubTab>("details")

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

  const showJoinBanner = !readOnly && !isManagement && !currentTeamId

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <header className="flex items-start gap-3">
        <div className="osrs-slot relative size-16 shrink-0 overflow-hidden rounded-sm">
          {tile.headerImage ? (
            <Image
              unoptimized
              src={tile.headerImage || getRandomFrog()}
              alt=""
              fill
              sizes="64px"
              className="object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary text-xs text-muted-foreground">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="osrs-heading text-lg leading-tight wrap-break-word text-foreground">
            {tile.title || "Hidden tile"}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="gap-1">
              <Zap aria-hidden="true" className="h-3 w-3 text-warning" />
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
            className="-mt-1 -mr-1 shrink-0"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Close tile details</span>
          </Button>
        )}
      </header>

      {tierLock && (
        <Notice tone="warning" icon={<Lock aria-hidden="true" className="h-4 w-4" />}>
          Locked: need {tierLock.xpNeeded} more XP in Tier {tierLock.tier - 1}{" "}
          to unlock Tier {tierLock.tier}.
        </Notice>
      )}

      {showJoinBanner && (
        <Notice tone="info" icon={<Users aria-hidden="true" className="h-4 w-4" />}>
          Join a team to submit. Ask an event organizer to add you to one.
        </Notice>
      )}

      <Tabs
        value={subTab}
        onValueChange={(v) => setSubTab(v as SubTab)}
        className="flex min-h-0 flex-col"
      >
        <TabsList className="h-10 w-full">
          <TabsTrigger value="details" className="flex-1">
            Details
          </TabsTrigger>
          {!readOnly && (
            <TabsTrigger value="submissions" className="flex-1 gap-1.5">
              Submissions
              {pendingCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-sm bg-info px-1 text-[10px] font-medium text-info-foreground">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          )}
          {canEdit && (
            <TabsTrigger value="goals" className="flex-1">
              Goals (edit)
            </TabsTrigger>
          )}
        </TabsList>

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
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="osrs-heading text-lg text-foreground">
          {team ? `${team.name} progress` : "Select a Tile"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
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
          <p className="text-xs text-muted-foreground">
            {stats.xpEarned} / {stats.xpTotal} XP on this board ({stats.percent}%)
          </p>

          {attention.length > 0 && (
            <section aria-label="Needs attention">
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                Needs attention
              </h3>
              <ul className="flex flex-col gap-1.5">
                {attention.map(({ tile, state }) => (
                  <li key={tile.id}>
                    <button
                      type="button"
                      onClick={() => onSelectTile(tile.id)}
                      className="osrs-panel-inset flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                    >
                      {state === "needs_review" ? (
                        <AlertCircle
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-warning"
                        />
                      ) : (
                        <Clock
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-pending"
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {tile.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
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
          <Notice tone="info" icon={<Users aria-hidden="true" className="h-4 w-4" />}>
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
      <span className={`mt-0.5 shrink-0 ${tone === "warning" ? "text-warning" : "text-info"}`}>
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  )
}
