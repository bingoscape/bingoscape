import Link from "next/link"
import { ArrowLeft, Coins, Trophy, Users } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DraftEntryLink } from "@/components/draft/draft-entry-link"
import { EventHeaderActions } from "@/components/event-header-actions"
import { EventRulesSheet } from "@/components/event-rules-sheet"
import { PrizePoolDisplay } from "@/components/prize-pool-display"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import { getNow } from "@/lib/now"
import type { EventRule } from "@/app/actions/events"
import type { EventCapabilities } from "@/lib/authz/capabilities"
import type { DraftStatus } from "@/lib/draft/types"
import type { Event } from "@/types/model"

interface EventSummaryBarProps {
  eventId: string
  title: string
  startDate: Date
  endDate: Date
  timezone: string
  totalPrizePool: number
  minimumBuyIn: number
  /** Only meaningful when the Event has a registration deadline. */
  hasRegistrationDeadline?: boolean
  registrationOpen?: boolean
  backHref: string
  backLabel: string
  /** Rules sheet and admin menu; omitted in the public view. */
  members?: {
    event: Event
    capabilities: EventCapabilities
    rules: EventRule[]
    pendingRegistrationsCount: number
    userClans: Array<{ clan: { id: string; name: string } }>
    /** Status of the Event's live team draft, null when it has none. */
    draftStatus: DraftStatus | null
  }
}

/**
 * One compact row that replaces the Event header and the details card on the
 * workspace route: title and status, dates, Prize Pool, Rules and the admin
 * menu.
 */
export function EventSummaryBar({
  eventId,
  title,
  startDate: start,
  endDate: end,
  timezone,
  totalPrizePool,
  minimumBuyIn,
  hasRegistrationDeadline,
  registrationOpen,
  backHref,
  backLabel,
  members,
}: EventSummaryBarProps) {
  const tz = timezone || "UTC"

  const now = getNow()
  const startDate = new Date(start)
  const endDate = new Date(end)
  const status: "upcoming" | "active" | "completed" =
    now > endDate ? "completed" : now >= startDate ? "active" : "upcoming"

  const sameYear =
    formatInTimeZone(startDate, tz, "yyyy") ===
    formatInTimeZone(endDate, tz, "yyyy")
  const dateRange = `${formatInTimeZone(startDate, tz, sameYear ? "MMM d" : "MMM d, yyyy")} - ${formatInTimeZone(endDate, tz, "MMM d, yyyy")}`

  return (
    <header
      aria-label="Event summary"
      className="osrs-panel flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm px-3 py-1.5 text-sm"
    >
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="-ml-1 h-8 w-8 shrink-0 rounded-sm"
      >
        <Link href={backHref}>
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">{backLabel}</span>
        </Link>
      </Button>

      <h1 className="osrs-heading min-w-0 truncate text-lg text-primary">
        {title}
      </h1>
      <Badge
        variant={
          status === "active"
            ? "success"
            : status === "upcoming"
              ? "info"
              : "outline"
        }
      >
        {status === "active"
          ? "Active"
          : status === "upcoming"
            ? "Upcoming"
            : "Completed"}
      </Badge>

      <span className="text-muted-foreground" title={`Times in ${tz}`}>
        {dateRange}
      </span>

      {totalPrizePool > 0 && (
        <span className="flex items-center gap-1.5 font-medium">
          <Trophy aria-hidden="true" className="h-4 w-4 text-primary" />
          <span className="sr-only">Prize pool:</span>
          <PrizePoolDisplay prizePool={totalPrizePool} showIcon={false} />
        </span>
      )}
      {minimumBuyIn > 0 && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Coins aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Minimum buy-in:</span>
          {formatRunescapeGold(minimumBuyIn)} GP
        </span>
      )}
      {hasRegistrationDeadline && registrationOpen !== undefined && (
        <Badge variant={registrationOpen ? "success" : "destructive"}>
          <Users aria-hidden="true" className="h-3 w-3" />
          Reg {registrationOpen ? "open" : "closed"}
        </Badge>
      )}

      {members && (
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <DraftEntryLink
            eventId={eventId}
            status={members.draftStatus}
            canView={members.capabilities.canViewDraft}
            canManage={members.capabilities.canManageDraft}
          />
          <EventRulesSheet
            eventId={eventId}
            initialRules={members.rules}
            canManageRules={members.capabilities.canManageRules}
          />
          {members.capabilities.canViewManagerPages && (
            <EventHeaderActions
              eventId={eventId}
              capabilities={members.capabilities}
              requiresApproval={members.event.requiresApproval}
              pendingRegistrationsCount={members.pendingRegistrationsCount}
              event={members.event}
              userClans={members.userClans}
            />
          )}
        </div>
      )}
    </header>
  )
}
