import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Coins,
  Settings,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { EventData } from "@/app/actions/events"
import { getStatusLabel, type EventState } from "@/lib/event-time"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import { cn } from "@/lib/utils"
import { EventProgressBar } from "./event-progress-bar"
import { EventStatusChip } from "./event-status-chip"
import { EventWhen } from "./event-when"

interface DashboardEventCardProps {
  eventData: EventData
  state: EventState
  now: Date
}

const attentionLink =
  "osrs-btn inline-flex min-h-11 w-full items-center justify-start gap-2 rounded-sm px-3 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"

/**
 * Event card for the dashboard. The title is a real link stretched over the
 * whole card (after:inset-0); interactive extras sit above it with z-10.
 */
export function DashboardEventCard({
  eventData,
  state,
  now,
}: DashboardEventCardProps) {
  const { event, participantData, managerData } = eventData
  const start = new Date(event.startDate)
  const end = new Date(event.endDate)
  const tz = event.timezone || "UTC"
  const isAdmin = event.role === "admin"
  const isManager = isAdmin || event.role === "management"
  const team = participantData?.team ?? null
  const progress = participantData?.progress ?? null
  const attention = managerData?.actionItems
  const pendingRegistrations = attention?.pendingRegistrations ?? 0
  const pendingSubmissions = attention?.pendingSubmissions ?? 0
  const hasAttention = pendingRegistrations > 0 || pendingSubmissions > 0
  const boardCount = event.bingos?.length ?? 0

  const statusId = `event-${event.id}-status`
  const whenId = `event-${event.id}-when`
  const statusLabel = getStatusLabel(state, start, end, tz, now)
  const isPast = state === "past"

  return (
    <article
      className={cn(
        "group osrs-panel relative flex flex-col gap-2.5 rounded-sm p-3 transition-[filter] hover:brightness-110 has-focus-visible:ring-2 has-focus-visible:ring-ring sm:p-4",
        state === "active" && "border-l-4 border-l-success",
        state === "upcoming" && "border-l-4 border-l-pending"
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <EventStatusChip id={statusId} state={state} label={statusLabel} />
          {event.gameType === "rs3" && (
            <span className="osrs-slot rounded-sm px-1.5 py-0.5 text-xs font-medium text-info">
              RS3
            </span>
          )}
          {isPast && progress && progress.totalTiles > 0 && (
            <span className="text-sm text-muted-foreground">
              {progress.completedTiles}/{progress.totalTiles} tiles
            </span>
          )}
        </div>
        {isAdmin && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="relative z-10 -my-1 shrink-0"
          >
            <Link
              href={`/events/${event.id}/admin`}
              aria-label={`Manage ${event.title}`}
            >
              <Settings aria-hidden="true" />
            </Link>
          </Button>
        )}
      </header>

      <h3 className="osrs-heading flex items-start justify-between gap-2 text-lg leading-snug">
        <Link
          href={`/events/${event.id}`}
          aria-describedby={isPast ? statusId : `${statusId} ${whenId}`}
          className="line-clamp-2 break-words after:absolute after:inset-0 focus-visible:outline-hidden"
        >
          {event.title}
        </Link>
        <ChevronRight
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
        />
      </h3>

      {!isPast && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <EventWhen
            id={whenId}
            start={start}
            end={end}
            eventTz={tz}
            clanName={event.clan?.name}
            now={now}
          />
          {eventData.totalPrizePool > 0 && (
            <span
              aria-label={`Prize pool ${formatRunescapeGold(eventData.totalPrizePool)}`}
              className="inline-flex items-center gap-1 border border-black bg-osrs-stone-950 px-1.5 py-0.5 shadow-[inset_2px_2px_0_0_#17120b,inset_-1px_-1px_0_0_#4b4132]"
            >
              <Coins aria-hidden="true" className="size-3.5 text-osrs-gold" />
              <span aria-hidden="true" className="osrs-qty text-sm">
                {formatRunescapeGold(eventData.totalPrizePool)}
              </span>
            </span>
          )}
        </div>
      )}

      {isManager && hasAttention && (
        <ul
          aria-label="Needs your attention"
          className="relative z-10 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        >
          {pendingSubmissions > 0 && (
            <li>
              <Link
                href={
                  isAdmin
                    ? `/events/${event.id}/admin/submissions`
                    : `/events/${event.id}`
                }
                className={attentionLink}
              >
                <CheckCircle2 aria-hidden="true" className="size-4" />
                <span className="osrs-qty">{pendingSubmissions}</span>
                Submissions to review
                <span className="sr-only"> for {event.title}</span>
              </Link>
            </li>
          )}
          {pendingRegistrations > 0 && (
            <li>
              <Link
                href={`/events/${event.id}/participants?tab=registrations`}
                className={attentionLink}
              >
                <Users aria-hidden="true" className="size-4" />
                <span className="osrs-qty">{pendingRegistrations}</span>
                Join requests
                <span className="sr-only"> for {event.title}</span>
              </Link>
            </li>
          )}
        </ul>
      )}

      {isManager && !hasAttention && !isPast && managerData && (
        <p className="text-sm text-muted-foreground">
          {managerData.eventStats.totalParticipants} players ·{" "}
          {managerData.eventStats.activeTeams} teams
        </p>
      )}

      {isManager && state === "upcoming" && boardCount === 0 && (
        <p className="flex items-center gap-2 text-sm text-warning">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          No Board yet
        </p>
      )}

      {!isPast && team && (
        <div className="space-y-1.5">
          <p className="truncate text-sm">
            <span className="font-medium">{team.name}</span>
            <span className="text-muted-foreground">
              {" "}
              · {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
            </span>
          </p>
          {state === "active" && progress && (
            <EventProgressBar
              label={`${team.name} progress`}
              completed={progress.completedTiles}
              total={progress.totalTiles}
            />
          )}
        </div>
      )}

      {!isPast && !team && !isManager && (
        <p className="text-sm text-muted-foreground">No team yet</p>
      )}
    </article>
  )
}
