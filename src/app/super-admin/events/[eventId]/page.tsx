import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  Crown,
  Grid3x3,
  ImageIcon,
  LayoutGrid,
  Users,
  UsersRound,
} from "lucide-react"

import { ClanLink, UserLink } from "@/components/super-admin/admin-links"
import {
  AdminDataTable,
  type AdminColumn,
} from "@/components/super-admin/admin-data-table"
import { ClanOptionsProvider } from "@/components/super-admin/clan-options-context"
import { CopyIdButton } from "@/components/super-admin/copy-id-button"
import {
  DetailTabs,
  resolveTab,
  type DetailTab,
} from "@/components/super-admin/detail-tabs"
import {
  EmptyNote,
  ListFootnote,
  ListSection,
} from "@/components/super-admin/entity-lists"
import { EventActions } from "@/components/super-admin/event-actions"
import {
  EventFlagBadges,
  EventStateBadge,
} from "@/components/super-admin/event-badges"
import {
  MembershipActions,
  RoleBadge,
} from "@/components/super-admin/membership-actions"
import { PageHeader } from "@/components/super-admin/page-header"
import { Stat } from "@/components/super-admin/stat"
import { UserAvatar } from "@/components/super-admin/user-avatar"
import { Badge } from "@/components/ui/badge"
import {
  parseListParams,
  toHrefState,
  type RawSearchParams,
} from "@/lib/admin-list-params"
import {
  formatDate,
  formatEventDateTime,
  plural,
  safeTimeZone,
  userConfirmText,
  userLabel,
} from "@/lib/super-admin-format"
import {
  PARTICIPANT_LIST_CONFIG,
  getClanOptions,
  getEventDetail,
  getEventStructure,
  listEventParticipants,
  type ParticipantRow,
} from "@/server/super-admin/queries"

interface PageProps {
  params: Promise<{ eventId: string }>
  searchParams: Promise<RawSearchParams>
}

export const metadata: Metadata = { title: "Event - Super admin" }

export default async function EventDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { eventId } = await params
  const detail = await getEventDetail(eventId)
  if (!detail) notFound()

  const { event, creator, clan, counts } = detail
  const raw = await searchParams
  const basePath = `/super-admin/events/${event.id}`
  const timeZone = safeTimeZone(event.timezone)
  const tabs: DetailTab[] = [
    { key: "overview", label: "Overview" },
    { key: "participants", label: "Participants", count: counts.participants },
    {
      key: "structure",
      label: "Teams and boards",
      count: counts.teams + counts.boards,
    },
  ]
  const active = resolveTab(raw.tab, tabs)
  const clanOptions = await getClanOptions()

  return (
    <>
      <PageHeader
        title={event.title}
        breadcrumbs={[
          { label: "Events", href: "/super-admin/events" },
          { label: event.title },
        ]}
        description={event.description}
        meta={
          <>
            <EventStateBadge start={event.startDate} end={event.endDate} />
            <EventFlagBadges locked={event.locked} isPublic={event.public} />
            <span>
              <time dateTime={event.startDate.toISOString()}>
                {formatEventDateTime(event.startDate, timeZone)}
              </time>
              {" to "}
              <time dateTime={event.endDate.toISOString()}>
                {formatEventDateTime(event.endDate, timeZone)}
              </time>{" "}
              ({timeZone})
            </span>
            <CopyIdButton id={event.id} noun="event" />
          </>
        }
        actions={
          <ClanOptionsProvider {...clanOptions}>
            <EventActions
              variant="buttons"
              event={{
                id: event.id,
                title: event.title,
                description: event.description,
                startDate: event.startDate,
                endDate: event.endDate,
                timezone: event.timezone,
                locked: event.locked,
                public: event.public,
                clanId: clan?.id ?? null,
              }}
              counts={counts}
              redirectAfterDelete="/super-admin/events"
            />
          </ClanOptionsProvider>
        }
      />

      <DetailTabs basePath={basePath} tabs={tabs} active={active} />

      {active === "overview" ? (
        <div className="space-y-6">
          <h2 className="sr-only">Overview</h2>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <li>
              <Stat
                label="Participants"
                value={counts.participants}
                icon={Users}
              />
            </li>
            <li>
              <Stat label="Teams" value={counts.teams} icon={UsersRound} />
            </li>
            <li>
              <Stat label="Boards" value={counts.boards} icon={LayoutGrid} />
            </li>
            <li>
              <Stat label="Tiles" value={counts.tiles} icon={Grid3x3} />
            </li>
            <li>
              <Stat
                label="Submissions"
                value={counts.submissions}
                icon={ImageIcon}
              />
            </li>
          </ul>
          <dl className="osrs-panel grid gap-3 rounded-sm p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Creator</dt>
              <dd>{creator ? <UserLink user={creator} /> : "No creator"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Clan</dt>
              <dd>{clan ? <ClanLink clan={clan} /> : "No clan"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Timezone</dt>
              <dd>{timeZone}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatDate(event.createdAt)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {active === "participants" ? (
        <ParticipantsTab
          eventId={event.id}
          eventTitle={event.title}
          basePath={basePath}
          raw={raw}
        />
      ) : null}

      {active === "structure" ? <StructureTab eventId={event.id} /> : null}
    </>
  )
}

async function ParticipantsTab({
  eventId,
  eventTitle,
  basePath,
  raw,
}: {
  eventId: string
  eventTitle: string
  basePath: string
  raw: RawSearchParams
}) {
  const params = parseListParams(raw, PARTICIPANT_LIST_CONFIG)
  const data = await listEventParticipants(eventId, params)

  const columns: AdminColumn<ParticipantRow>[] = [
    {
      key: "name",
      header: "Participant",
      sortKey: "name",
      isRowHeader: true,
      cell: (participant) => {
        const label = userLabel(participant.user)
        return (
          <div className="flex items-center gap-3">
            <UserAvatar label={label} image={participant.user.image} />
            <div className="min-w-0">
              <UserLink user={participant.user} />
              {participant.isCreator ? (
                <Badge variant="warning" className="ml-2">
                  <Crown className="h-3 w-3" aria-hidden="true" />
                  Creator
                </Badge>
              ) : null}
              {participant.user.runescapeName && participant.user.name ? (
                <div className="text-muted-foreground text-xs">
                  {participant.user.runescapeName}
                </div>
              ) : null}
            </div>
          </div>
        )
      },
    },
    {
      key: "role",
      header: "Role",
      sortKey: "role",
      firstDir: "desc",
      cell: (participant) => <RoleBadge role={participant.role} />,
    },
    {
      key: "joined",
      header: "Joined",
      sortKey: "joined",
      firstDir: "desc",
      hideOnMobile: true,
      cell: (participant) => formatDate(participant.joinedAt),
    },
  ]

  return (
    <div className="space-y-2">
      <h2 className="sr-only">Participants</h2>
      <AdminDataTable
        idPrefix="participants"
        caption={`Participants of ${eventTitle}`}
        noun="participants"
        columns={columns}
        rows={data.rows}
        getRowKey={(participant) => participant.userId}
        rowActions={(participant) => (
          <MembershipActions
            scope="event"
            parentId={eventId}
            parentName={eventTitle}
            member={{
              userId: participant.userId,
              label: userLabel(participant.user),
              confirmText: userConfirmText(participant.user),
              role: participant.role,
            }}
            isLastAdmin={participant.role === "admin" && data.adminCount === 1}
          />
        )}
        basePath={basePath}
        state={{
          tab: "participants",
          ...toHrefState(params, PARTICIPANT_LIST_CONFIG),
        }}
        sort={{ key: params.sort, dir: params.dir }}
        page={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchLabel="Search participants"
        searchPlaceholder="Search by name, email or RuneScape name"
      />
    </div>
  )
}

async function StructureTab({ eventId }: { eventId: string }) {
  const structure = await getEventStructure(eventId)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ListSection title="Teams" count={structure.teamTotal}>
        {structure.teams.length === 0 ? (
          <EmptyNote>No teams yet.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {structure.teams.map((team) => (
              <li
                key={team.id}
                className="osrs-panel-inset flex items-center justify-between gap-3 rounded-sm px-3 py-2"
              >
                <span className="min-w-0 truncate font-medium">
                  {team.name}
                </span>
                <span className="text-muted-foreground shrink-0 text-sm">
                  {plural(team.memberCount, "member")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <ListFootnote
          shown={structure.teams.length}
          total={structure.teamTotal}
        />
      </ListSection>

      <ListSection title="Boards" count={structure.boardTotal}>
        {structure.boards.length === 0 ? (
          <EmptyNote>No boards yet.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {structure.boards.map((board) => (
              <li
                key={board.id}
                className="osrs-panel-inset flex flex-wrap items-center justify-between gap-2 rounded-sm px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="font-medium">{board.title}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {board.columns} x {board.rows}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Badge variant={board.visible ? "success" : "secondary"}>
                    {board.visible ? "Visible" : "Hidden"}
                  </Badge>
                  {board.locked ? (
                    <Badge variant="warning">Locked</Badge>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <ListFootnote
          shown={structure.boards.length}
          total={structure.boardTotal}
        />
      </ListSection>
    </div>
  )
}
