import { Suspense } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import {
  getPublicEvent,
  getPublicWorkspaceData,
} from "@/app/actions/public-events"
import { EventWorkspace } from "@/components/event-workspace/event-workspace"
import { EventSummaryBar } from "@/components/event-workspace/event-summary-bar"
import { InfoPanel } from "@/components/event-workspace/info-panel"
import { PrizePanel } from "@/components/event-workspace/prize-panel"
import { TeamsPanel } from "@/components/event-workspace/teams-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { computeCapabilities } from "@/lib/authz/capabilities"
import { getBoardTierData } from "@/server/queries/tiers"
import { resolveWorkspaceSelection } from "@/lib/workspace-selection"

// Generate metadata for SEO
export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params
  const event = await getPublicEvent(params.id)

  if (!event) {
    return {
      title: "Event Not Found",
      description:
        "The requested event could not be found or is not publicly available.",
    }
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://next.bingoscape.org"
  const eventUrl = `${baseUrl}/public/events/${params.id}`

  // Format dates for description
  const startDate = new Date(event.startDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  const endDate = new Date(event.endDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const description =
    event.description ??
    `Join this RuneScape bingo event from ${startDate} to ${endDate}. ${event.clanName ? `Hosted by ${event.clanName}.` : ""} ${event.bingoCount > 0 ? `Features ${event.bingoCount} bingo board${event.bingoCount === 1 ? "" : "s"}.` : ""}`

  return {
    title: `${event.title} | BingoScape`,
    description,
    openGraph: {
      title: event.title,
      description,
      type: "website",
      url: eventUrl,
      siteName: "BingoScape",
      images: [
        {
          url: `${eventUrl}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${event.title} - BingoScape Event`,
        },
      ],
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: [`${eventUrl}/opengraph-image`],
      creator: "@bingoscape",
      site: "@bingoscape",
    },
    metadataBase: new URL(baseUrl),
  }
}

function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null
}

/**
 * Public, read-only view of an Event. It is the same workspace as
 * `/events/[id]` (Board fitted to the viewport, side panel with the Tile,
 * Teams, Prize and Info tabs) without submissions, images or admin actions.
 * Only the Board selected by `?board=` is loaded.
 */
export default async function PublicEventPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [params, search] = await Promise.all([props.params, props.searchParams])

  const event = await getPublicEvent(params.id)
  if (!event) {
    notFound()
  }

  const board = firstParam(search.board)
  const data = await getPublicWorkspaceData(params.id, board)
  if (!data) {
    notFound()
  }

  const { bingo, effectiveTeamId } = resolveWorkspaceSelection({
    bingos: data.bingos,
    teams: data.teams,
    isManagement: false,
    readOnly: true,
    ownTeamId: undefined,
    board,
    teamId: firstParam(search.teamId),
  })

  const tierData = await getBoardTierData(bingo, effectiveTeamId)

  const now = new Date()
  const registrationOpen =
    !event.locked &&
    (!event.registrationDeadline || now <= new Date(event.registrationDeadline))

  // Public view: only the base prize pool is shown.
  const prizePool = {
    basePrizePool: event.basePrizePool,
    totalBuyIns: 0,
    totalDonations: 0,
    totalPrizePool: event.basePrizePool,
  }

  return (
    <EventWorkspace
      readOnly
      event={{
        id: event.id,
        startDate: event.startDate,
        timezone: event.timezone,
        gameType: event.gameType,
        bingos: data.bingos,
        teams: data.teams,
      }}
      capabilities={computeCapabilities(null)}
      currentTeam={null}
      selectableUsers={[]}
      tierData={tierData}
      summaryBar={
        <EventSummaryBar
          eventId={event.id}
          title={event.title}
          startDate={event.startDate}
          endDate={event.endDate}
          timezone={event.timezone}
          totalPrizePool={event.basePrizePool}
          minimumBuyIn={event.minimumBuyIn}
          hasRegistrationDeadline={!!event.registrationDeadline}
          registrationOpen={registrationOpen}
          backHref="/"
          backLabel="Back to home"
        />
      }
      teamsPanel={
        <Suspense
          fallback={<Skeleton className="h-24 w-full" aria-label="Loading" />}
        >
          <TeamsPanel
            readOnly
            eventId={event.id}
            ownTeamId={undefined}
            viewedTeamId={effectiveTeamId}
            isManagement={false}
            currentUser={null}
          />
        </Suspense>
      }
      prizePanel={
        <PrizePanel
          readOnly
          eventId={event.id}
          prizePool={prizePool}
          minimumBuyIn={event.minimumBuyIn}
          isManagement={false}
        />
      }
      infoPanel={
        <InfoPanel
          readOnly
          eventId={event.id}
          title={event.title}
          description={event.description}
          startDate={event.startDate}
          endDate={event.endDate}
          timezone={event.timezone}
          locked={event.locked}
          registrationOpen={registrationOpen}
          hasRegistrationDeadline={!!event.registrationDeadline}
          isPublic
          rules={[]}
          board={
            bingo
              ? {
                  title: bingo.title,
                  description: bingo.description,
                  rows: bingo.rows,
                  columns: bingo.columns,
                  codephrase: "",
                }
              : null
          }
          canInvite={false}
        />
      }
    />
  )
}
