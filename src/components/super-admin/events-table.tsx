import Link from "next/link"

import { ClanLink, UserLink } from "@/components/super-admin/admin-links"
import {
  AdminDataTable,
  type AdminColumn,
} from "@/components/super-admin/admin-data-table"
import { ClanOptionsProvider } from "@/components/super-admin/clan-options-context"
import { EventActions } from "@/components/super-admin/event-actions"
import {
  EventFlagBadges,
  EventStateBadge,
} from "@/components/super-admin/event-badges"
import {
  toHrefState,
  type HrefState,
  type ListParams,
} from "@/lib/admin-list-params"
import { formatEventDate } from "@/lib/super-admin-format"
import {
  EVENT_LIST_CONFIG,
  getClanOptions,
  type EventListRow,
  type EventSortKey,
  type Paged,
} from "@/server/super-admin/queries"

interface EventsTableProps {
  data: Paged<EventListRow>
  params: ListParams<EventSortKey>
  basePath: string
  /** Extra URL state to keep, e.g. `{ tab: "events" }`. */
  extraState?: HrefState
  /** Hide the clan column when every row belongs to one clan. */
  showClan?: boolean
  idPrefix: string
}

/** The events list, shared by /super-admin/events and the clan's Events tab. */
export async function EventsTable({
  data,
  params,
  basePath,
  extraState,
  showClan = true,
  idPrefix,
}: EventsTableProps) {
  const clanOptions = await getClanOptions()

  const columns: AdminColumn<EventListRow>[] = [
    {
      key: "title",
      header: "Event",
      sortKey: "title",
      isRowHeader: true,
      cell: (event) => (
        <div className="min-w-0">
          <Link
            href={`/super-admin/events/${event.id}`}
            className="focus-visible:ring-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
          >
            {event.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <EventStateBadge start={event.startDate} end={event.endDate} />
            <EventFlagBadges locked={event.locked} isPublic={event.public} />
          </div>
        </div>
      ),
    },
    {
      key: "start",
      header: "Dates",
      sortKey: "start",
      firstDir: "desc",
      cell: (event) => (
        <span className="text-sm whitespace-nowrap">
          {formatEventDate(event.startDate, event.timezone)}
          <span className="text-muted-foreground"> to </span>
          {formatEventDate(event.endDate, event.timezone)}
        </span>
      ),
    },
    {
      key: "creator",
      header: "Creator",
      hideOnMobile: true,
      cell: (event) =>
        event.creator ? (
          <UserLink user={event.creator} />
        ) : (
          <span className="text-muted-foreground">No creator</span>
        ),
    },
    ...(showClan
      ? [
          {
            key: "clan",
            header: "Clan",
            hideOnMobile: true,
            cell: (event: EventListRow) =>
              event.clan ? (
                <ClanLink clan={event.clan} />
              ) : (
                <span className="text-muted-foreground">No clan</span>
              ),
          },
        ]
      : []),
    {
      key: "participants",
      header: "Players",
      sortKey: "participants",
      firstDir: "desc",
      hideOnMobile: true,
      cell: (event) => event.participantCount,
    },
  ]

  return (
    <ClanOptionsProvider {...clanOptions}>
      <AdminDataTable
        idPrefix={idPrefix}
        caption="Events"
        noun="events"
        columns={columns}
        rows={data.rows}
        getRowKey={(event) => event.id}
        rowActions={(event) => (
          <EventActions
            variant="menu"
            event={{
              id: event.id,
              title: event.title,
              description: event.description,
              startDate: event.startDate,
              endDate: event.endDate,
              timezone: event.timezone,
              locked: event.locked,
              public: event.public,
              clanId: event.clan?.id ?? null,
            }}
            counts={{
              participants: event.participantCount,
              teams: event.teamCount,
              boards: event.boardCount,
            }}
          />
        )}
        basePath={basePath}
        state={{ ...extraState, ...toHrefState(params, EVENT_LIST_CONFIG) }}
        sort={{ key: params.sort, dir: params.dir }}
        page={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchLabel="Search events"
        searchPlaceholder="Search by title or description"
        filters={[
          { label: "All", value: null },
          { label: "Live", value: "live" },
          { label: "Upcoming", value: "upcoming" },
          { label: "Ended", value: "ended" },
        ]}
      />
    </ClanOptionsProvider>
  )
}
