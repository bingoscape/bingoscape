import Link from "next/link"
import type React from "react"

import { Badge } from "@/components/ui/badge"
import { formatDate, formatEventDate } from "@/lib/super-admin-format"
import { cn } from "@/lib/utils"
import { EventFlagBadges, EventStateBadge } from "./event-badges"
import { RoleBadge } from "./membership-actions"

export function ListSection({
  title,
  count,
  action,
  children,
  headingLevel: Heading = "h2",
}: {
  title: string
  count?: number
  action?: React.ReactNode
  children: React.ReactNode
  headingLevel?: "h2" | "h3"
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Heading className="osrs-heading text-primary text-lg">
          {title}
          {count !== undefined ? (
            <span className="text-muted-foreground ml-2 text-sm">
              ({count})
            </span>
          ) : null}
        </Heading>
        {action}
      </div>
      {children}
    </section>
  )
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="osrs-panel-inset text-muted-foreground rounded-sm px-4 py-6 text-center text-sm">
      {children}
    </p>
  )
}

/** "Showing 100 of 240" footnote, or a link to the full list. */
export function ListFootnote({
  shown,
  total,
  children,
}: {
  shown: number
  total: number
  children?: React.ReactNode
}) {
  if (total <= shown && !children) return null
  return (
    <p className="text-muted-foreground text-xs">
      {total > shown ? `Showing the first ${shown} of ${total}. ` : null}
      {children}
    </p>
  )
}

export function ViewAllLink({ href, total }: { href: string; total: number }) {
  return (
    <Link
      href={href}
      className="hover:text-primary focus-visible:ring-ring rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-hidden"
    >
      View all {total}
    </Link>
  )
}

const ROW_CLASS =
  "osrs-panel-inset flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-sm px-3 py-2"

export function EventRows({
  events,
  roleOf,
}: {
  events: {
    id: string
    title: string
    startDate: Date
    endDate: Date
    timezone: string
    locked: boolean
    public: boolean
  }[]
  roleOf?: (eventId: string) => string | undefined
}) {
  return (
    <ul className="space-y-2">
      {events.map((event) => {
        const role = roleOf?.(event.id)
        return (
          <li key={event.id} className={ROW_CLASS}>
            <div className="min-w-0">
              <Link
                href={`/super-admin/events/${event.id}`}
                className="focus-visible:ring-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
              >
                {event.title}
              </Link>
              <p className="text-muted-foreground text-xs">
                {formatEventDate(event.startDate, event.timezone)} to{" "}
                {formatEventDate(event.endDate, event.timezone)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {role ? <RoleBadge role={role} /> : null}
              <EventStateBadge start={event.startDate} end={event.endDate} />
              <EventFlagBadges locked={event.locked} isPublic={event.public} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function ClanMembershipRows({
  memberships,
  className,
}: {
  memberships: {
    clanId: string
    clanName: string
    role: string
    isMain: boolean
    joinedAt: Date
  }[]
  className?: string
}) {
  return (
    <ul className={cn("space-y-2", className)}>
      {memberships.map((membership) => (
        <li key={membership.clanId} className={ROW_CLASS}>
          <div className="min-w-0">
            <Link
              href={`/super-admin/clans/${membership.clanId}`}
              className="focus-visible:ring-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
            >
              {membership.clanName}
            </Link>
            <p className="text-muted-foreground text-xs">
              Joined {formatDate(membership.joinedAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <RoleBadge role={membership.role} />
            {membership.isMain ? <Badge variant="info">Main clan</Badge> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
