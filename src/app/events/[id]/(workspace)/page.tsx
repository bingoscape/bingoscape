import { getEventCapabilities } from "@/server/authz"
import { Suspense } from "react"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import type { UUID } from "crypto"
import { getServerAuthSession } from "@/server/auth"
import { getEventById } from "@/server/queries/events"
import { getBoardTierData } from "@/server/queries/tiers"
import {
  calculateEventPrizePool,
  getEventRules,
  getPendingRegistrationCount,
} from "@/app/actions/events"
import { getSelectableUsersForSubmission } from "@/app/actions/bingo"
import { getUserClans } from "@/app/actions/clan"
import { getCurrentTeamForUser } from "@/app/actions/team"
import { getBattleshipWorkspaceInfo } from "@/server/battleship"
import { EventWorkspace } from "@/components/event-workspace/event-workspace"
import { EventSummaryBar } from "@/components/event-workspace/event-summary-bar"
import { InfoPanel } from "@/components/event-workspace/info-panel"
import { PrizePanel } from "@/components/event-workspace/prize-panel"
import { TeamsPanel } from "@/components/event-workspace/teams-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { resolveWorkspaceSelection } from "@/lib/workspace-selection"
import {
  WORKSPACE_PREFS_COOKIE,
  parseWorkspacePrefs,
} from "@/lib/workspace-prefs"

function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null
}

function PanelSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-3/4" />
    </div>
  )
}

/**
 * The Event workspace. All data is fetched here, on the server, in parallel;
 * the client component only holds transient UI state. `?board=` and `?teamId=`
 * are read here so that tier data matches what the client renders.
 */
export default async function EventWorkspacePage(props: {
  params: Promise<{ id: UUID }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [params, search] = await Promise.all([props.params, props.searchParams])

  const cookieStore = await cookies()
  const layoutPrefs = parseWorkspacePrefs(
    cookieStore.get(WORKSPACE_PREFS_COOKIE)?.value
  )

  const session = await getServerAuthSession()
  if (!session?.user) {
    notFound()
  }

  const [data, currentTeam] = await Promise.all([
    getEventById(params.id),
    getCurrentTeamForUser(params.id),
  ])

  if (!data) {
    notFound()
  }

  const { event, userRole } = data
  if (!userRole) {
    // The Event layout shows the join / registration flow.
    return null
  }

  const capabilities = await getEventCapabilities(event.id)
  const isManagement = capabilities.canEditBoard

  const { bingo, effectiveTeamId } = resolveWorkspaceSelection({
    bingos: event.bingos,
    teams: event.teams,
    isManagement,
    ownTeamId: currentTeam?.id,
    board: firstParam(search.board),
    teamId: firstParam(search.teamId),
  })

  const now = new Date()
  const registrationOpen =
    !event.locked &&
    (!event.registrationDeadline || now <= new Date(event.registrationDeadline))

  const [
    prizePool,
    rules,
    pendingRegistrationsCount,
    userClans,
    selectableUsers,
    tierData,
    battleship,
  ] = await Promise.all([
    calculateEventPrizePool(event.id),
    getEventRules(event.id),
    isManagement ? getPendingRegistrationCount(event.id) : Promise.resolve(0),
    capabilities.canAssignClan ? getUserClans() : Promise.resolve([]),
    isManagement || currentTeam
      ? getSelectableUsersForSubmission(event.id, currentTeam?.id ?? "")
      : Promise.resolve([]),
    getBoardTierData(bingo, effectiveTeamId),
    bingo?.bingoType === "battleship"
      ? getBattleshipWorkspaceInfo({
          bingoId: bingo.id,
          eventId: event.id,
          startDate: event.startDate,
          userId: session.user.id,
        })
      : Promise.resolve(null),
  ])

  // Only the active Board's Tiles are needed on the client; switching Boards
  // re-renders this page with the new `?board=`.
  const slimEvent = {
    ...event,
    bingos: event.bingos?.map((b) =>
      b.id === bingo?.id ? b : { ...b, tiles: [] }
    ),
  }

  const currentUser = {
    id: session.user.id,
    runescapeName: session.user.runescapeName ?? null,
  }

  return (
    <EventWorkspace
      event={slimEvent}
      capabilities={capabilities}
      currentTeam={currentTeam}
      selectableUsers={selectableUsers}
      tierData={tierData}
      battleship={battleship}
      layoutPrefs={layoutPrefs}
      summaryBar={
        <EventSummaryBar
          eventId={event.id}
          title={event.title}
          startDate={event.startDate}
          endDate={event.endDate}
          timezone={event.timezone}
          totalPrizePool={prizePool.totalPrizePool}
          minimumBuyIn={event.minimumBuyIn}
          hasRegistrationDeadline={!!event.registrationDeadline}
          registrationOpen={registrationOpen}
          backHref="/events/mine"
          backLabel="Back to my events"
          members={{
            event,
            capabilities,
            rules,
            pendingRegistrationsCount,
            userClans,
          }}
        />
      }
      teamsPanel={
        <Suspense fallback={<PanelSkeleton />}>
          <TeamsPanel
            eventId={event.id}
            ownTeamId={currentTeam?.id}
            viewedTeamId={effectiveTeamId}
            isManagement={isManagement}
            currentUser={currentUser}
          />
        </Suspense>
      }
      prizePanel={
        <PrizePanel
          eventId={event.id}
          prizePool={prizePool}
          minimumBuyIn={event.minimumBuyIn}
          isManagement={isManagement}
        />
      }
      infoPanel={
        <InfoPanel
          eventId={event.id}
          title={event.title}
          description={event.description}
          startDate={event.startDate}
          endDate={event.endDate}
          timezone={event.timezone}
          locked={event.locked}
          registrationOpen={registrationOpen}
          hasRegistrationDeadline={!!event.registrationDeadline}
          isPublic={event.public}
          rules={rules}
          board={
            bingo
              ? {
                  title: bingo.title,
                  description: bingo.description,
                  rows: bingo.rows,
                  columns: bingo.columns,
                  codephrase: bingo.codephrase,
                }
              : null
          }
          canInvite={capabilities.canInvite}
        />
      }
    />
  )
}
