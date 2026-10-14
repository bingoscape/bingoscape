import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, EyeOff, Lock } from "lucide-react"

import { ShipPlacementClient } from "@/components/ship-placement/ship-placement-client"
import type { PlacementTile } from "@/components/ship-placement/ship-placement-board"
import { getServerAuthSession } from "@/server/auth"
import {
  assertTeamLeaderOrManager,
  AuthzError,
  hasPermission,
} from "@/server/authz"
import {
  getBingoShipRules,
  getLedTeamId,
  getTeamShipPlacements,
} from "@/server/battleship"
import { getEventById } from "@/server/queries/events"
import { hasEventStarted } from "@/lib/event-status"
import { resolvePlacementAccess } from "@/lib/ship-placement-access"
import { cn } from "@/lib/utils"

function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null
}

function Notice({
  eventId,
  bingoId,
  children,
}: {
  eventId: string
  bingoId: string
  children: React.ReactNode
}) {
  return (
    <div className="osrs-panel mx-auto max-w-xl space-y-3 rounded-sm p-6">
      <h1 className="osrs-heading text-2xl">Place ships</h1>
      <p className="text-sm">{children}</p>
      <Link
        href={`/events/${eventId}?board=${encodeURIComponent(bingoId)}`}
        className="text-primary inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to the board
      </Link>
    </div>
  )
}

/**
 * Ship placement of one team on a battleship Board. Everything is decided on
 * the server: who the viewer is, which team they may place for (`?teamId=`),
 * the fleet rules and the ships the team saved. The client part only holds the
 * draft fleet.
 */
export default async function ShipPlacementPage(props: {
  params: Promise<{ id: string; bingoId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id: eventId, bingoId }, search] = await Promise.all([
    props.params,
    props.searchParams,
  ])

  const session = await getServerAuthSession()
  if (!session?.user) notFound()

  const data = await getEventById(eventId)
  if (!data?.userRole) notFound()
  const { event } = data

  const bingo = event.bingos?.find((b) => b.id === bingoId)
  if (!bingo) notFound()

  const isManager = await hasPermission(event.id, "board:manage")
  const teams = event.teams ?? []

  const access = resolvePlacementAccess({
    bingoType: bingo.bingoType,
    isManager,
    ledTeamId: await getLedTeamId(event.id, session.user.id),
    teamIds: teams.map((t) => t.id),
    requestedTeamId: firstParam(search.teamId),
  })

  if (!access.ok) {
    if (
      access.reason === "not-battleship" ||
      access.reason === "team-not-found"
    )
      notFound()
    return (
      <Notice eventId={event.id} bingoId={bingo.id}>
        {access.reason === "no-team"
          ? "This event has no teams yet, so there is nothing to place ships for."
          : "Only the leader of a team and event managers can place ships."}
      </Notice>
    )
  }

  const team = teams.find((t) => t.id === access.teamId)
  if (!team) notFound()

  // The authoritative check: the checks above only choose what to show.
  let savedShips
  try {
    await assertTeamLeaderOrManager(team.id)
    savedShips = await getTeamShipPlacements(bingo.id, team.id)
  } catch (error) {
    if (error instanceof AuthzError) {
      return (
        <Notice eventId={event.id} bingoId={bingo.id}>
          Only the leader of a team and event managers can place ships.
        </Notice>
      )
    }
    throw error
  }

  const rules = await getBingoShipRules(bingo.id)
  if (rules.length === 0) {
    return (
      <Notice eventId={event.id} bingoId={bingo.id}>
        This board has no ship rules yet. An event manager can set them in the
        board settings.
      </Notice>
    )
  }

  const locked = hasEventStarted(event.startDate)
  const tiles: PlacementTile[] = (bingo.tiles ?? []).map((tile) => ({
    id: tile.id,
    index: tile.index,
    title: tile.title,
    isHidden: tile.isHidden,
    isBlind: tile.isBlind ?? false,
  }))

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="space-y-1">
        <Link
          href={`/events/${event.id}?board=${encodeURIComponent(bingo.id)}`}
          className="text-primary inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to {bingo.title}
        </Link>
        <h1 className="osrs-heading text-3xl">Place ships: {team.name}</h1>
        <p className="text-muted-foreground text-sm">
          {bingo.title}, {bingo.rows} rows by {bingo.columns} columns
        </p>
      </div>

      {access.canSwitchTeam && (
        <nav aria-label="Team" className="flex flex-wrap gap-2">
          {teams.map((t) => {
            const active = t.id === team.id
            return (
              <Link
                key={t.id}
                href={`/events/${event.id}/bingos/${bingo.id}/ships?teamId=${encodeURIComponent(t.id)}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "osrs-btn focus-visible:ring-ring inline-flex h-9 items-center rounded-sm px-3 text-sm focus-visible:ring-2 focus-visible:outline-hidden pointer-coarse:min-h-11",
                  active && "osrs-bevel-inset !text-osrs-yellow translate-y-px"
                )}
              >
                {t.name}
              </Link>
            )
          })}
        </nav>
      )}

      <section
        aria-label="How placement works"
        className="osrs-panel-inset space-y-2 rounded-sm p-3 text-sm"
      >
        {!locked && (
          <p className="flex items-start gap-2">
            <EyeOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              The board is blind until the event starts. Players see only tile
              numbers, so ships are placed by position.
              {isManager &&
                " As a manager you see the real tile titles on this page."}
            </span>
          </p>
        )}
        <p className="flex items-start gap-2">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Each team only sees its own ships. The other team cannot see{" "}
            {team.name}&apos;s fleet, and {team.name} cannot see theirs.
            {isManager &&
              " As a manager you can see and change the fleet of either team."}
          </span>
        </p>
      </section>

      <ShipPlacementClient
        key={team.id}
        bingoId={bingo.id}
        teamId={team.id}
        teamName={team.name}
        rows={bingo.rows}
        columns={bingo.columns}
        tiles={tiles}
        rules={rules}
        savedShips={savedShips}
        locked={locked}
      />
    </div>
  )
}
