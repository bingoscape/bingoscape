import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Calendar, ImageIcon, Lock, Globe, Users, Crown } from "lucide-react"

import { UserLink } from "@/components/super-admin/admin-links"
import {
  AdminDataTable,
  type AdminColumn,
} from "@/components/super-admin/admin-data-table"
import { ClanActions } from "@/components/super-admin/clan-actions"
import { CopyIdButton } from "@/components/super-admin/copy-id-button"
import {
  DetailTabs,
  resolveTab,
  type DetailTab,
} from "@/components/super-admin/detail-tabs"
import {
  EmptyNote,
  EventRows,
  ListSection,
  ViewAllLink,
} from "@/components/super-admin/entity-lists"
import { EventsTable } from "@/components/super-admin/events-table"
import {
  MembershipActions,
  RoleBadge,
} from "@/components/super-admin/membership-actions"
import { PageHeader } from "@/components/super-admin/page-header"
import { Stat } from "@/components/super-admin/stat"
import { isLastAdmin } from "@/lib/authz/roles"
import { UserAvatar } from "@/components/super-admin/user-avatar"
import { Badge } from "@/components/ui/badge"
import {
  parseListParams,
  toHrefState,
  type RawSearchParams,
} from "@/lib/admin-list-params"
import {
  formatDate,
  plural,
  userConfirmText,
  userLabel,
} from "@/lib/super-admin-format"
import {
  CLAN_MEMBER_LIST_CONFIG,
  EVENT_LIST_CONFIG,
  getClanDetail,
  getClanOwnerOptions,
  listClanMembers,
  listEvents,
  type ClanMemberRow,
} from "@/server/super-admin/queries"

interface PageProps {
  params: Promise<{ clanId: string }>
  searchParams: Promise<RawSearchParams>
}

export const metadata: Metadata = { title: "Clan - Super admin" }

export default async function ClanDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { clanId } = await params
  const detail = await getClanDetail(clanId)
  if (!detail) notFound()

  const { clan, owner } = detail
  const raw = await searchParams
  const basePath = `/super-admin/clans/${clan.id}`
  const tabs: DetailTab[] = [
    { key: "overview", label: "Overview" },
    { key: "members", label: "Members", count: detail.memberCount },
    { key: "events", label: "Events", count: detail.eventCount },
  ]
  const active = resolveTab(raw.tab, tabs)
  const ownerOptions = await getClanOwnerOptions(clan.id, owner?.id ?? null)

  return (
    <>
      <PageHeader
        title={clan.name}
        breadcrumbs={[
          { label: "Clans", href: "/super-admin/clans" },
          { label: clan.name },
        ]}
        description={clan.description}
        meta={
          <>
            <span>Created {formatDate(clan.createdAt)}</span>
            <span className="flex items-center gap-1">
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
              Owner:{" "}
              {owner ? (
                <UserLink user={owner} />
              ) : (
                <Badge variant="warning">No owner</Badge>
              )}
            </span>
            <CopyIdButton id={clan.id} noun="clan" />
          </>
        }
        actions={
          <ClanActions
            variant="buttons"
            clan={{
              id: clan.id,
              name: clan.name,
              description: clan.description,
              ownerId: owner?.id ?? null,
            }}
            counts={{ members: detail.memberCount, events: detail.eventCount }}
            ownerOptions={ownerOptions}
            redirectAfterDelete="/super-admin/clans"
          />
        }
      />

      <DetailTabs basePath={basePath} tabs={tabs} active={active} />

      {active === "overview" ? (
        <OverviewTab detail={detail} basePath={basePath} />
      ) : null}

      {active === "members" ? (
        <MembersTab
          clanId={clan.id}
          clanName={clan.name}
          basePath={basePath}
          raw={raw}
        />
      ) : null}

      {active === "events" ? (
        <EventsTab clanId={clan.id} basePath={basePath} raw={raw} />
      ) : null}
    </>
  )
}

async function OverviewTab({
  detail,
  basePath,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getClanDetail>>>
  basePath: string
}) {
  const recent = await listEvents(
    {
      q: "",
      page: 1,
      sort: "start",
      dir: "desc",
      filter: null,
    },
    { clanId: detail.clan.id }
  )
  const { roles } = detail

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Overview</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <li>
          <Stat label="Members" value={detail.memberCount} icon={Users}>
            {roles.admin > 0 ? (
              <Badge variant="outline">{plural(roles.admin, "admin")}</Badge>
            ) : null}
            {roles.management > 0 ? (
              <Badge variant="outline">{roles.management} management</Badge>
            ) : null}
            {roles.member > 0 ? (
              <Badge variant="outline">{plural(roles.member, "member")}</Badge>
            ) : null}
            {roles.guest > 0 ? (
              <Badge variant="outline">{plural(roles.guest, "guest")}</Badge>
            ) : null}
          </Stat>
        </li>
        <li>
          <Stat label="Events" value={detail.eventCount} icon={Calendar}>
            {detail.lockedEvents > 0 ? (
              <Badge variant="warning">
                <Lock className="h-3 w-3" aria-hidden="true" />
                {detail.lockedEvents} locked
              </Badge>
            ) : null}
            {detail.publicEvents > 0 ? (
              <Badge variant="outline">
                <Globe className="h-3 w-3" aria-hidden="true" />
                {detail.publicEvents} public
              </Badge>
            ) : null}
          </Stat>
        </li>
        <li>
          <Stat
            label="Submissions in clan events"
            value={detail.submissionCount}
            icon={ImageIcon}
          />
        </li>
      </ul>

      <ListSection
        title="Latest events"
        count={detail.eventCount}
        action={
          detail.eventCount > 5 ? (
            <ViewAllLink
              href={`${basePath}?tab=events`}
              total={detail.eventCount}
            />
          ) : null
        }
      >
        {recent.rows.length === 0 ? (
          <EmptyNote>This clan has no events.</EmptyNote>
        ) : (
          <EventRows events={recent.rows.slice(0, 5)} />
        )}
      </ListSection>
      <p className="text-muted-foreground text-sm">
        <Link
          href={`${basePath}?tab=members`}
          className="hover:text-primary focus-visible:ring-ring rounded-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-hidden"
        >
          Manage {plural(detail.memberCount, "member")}
        </Link>
      </p>
    </div>
  )
}

async function MembersTab({
  clanId,
  clanName,
  basePath,
  raw,
}: {
  clanId: string
  clanName: string
  basePath: string
  raw: RawSearchParams
}) {
  const params = parseListParams(raw, CLAN_MEMBER_LIST_CONFIG)
  const data = await listClanMembers(clanId, params)

  const columns: AdminColumn<ClanMemberRow>[] = [
    {
      key: "name",
      header: "Member",
      sortKey: "name",
      isRowHeader: true,
      cell: (member) => {
        const label = userLabel(member.user)
        return (
          <div className="flex items-center gap-3">
            <UserAvatar label={label} image={member.user.image} />
            <div className="min-w-0">
              <UserLink user={member.user} />
              {member.isOwner ? (
                <Badge variant="warning" className="ml-2">
                  <Crown className="h-3 w-3" aria-hidden="true" />
                  Owner
                </Badge>
              ) : null}
              {member.user.runescapeName && member.user.name ? (
                <div className="text-muted-foreground text-xs">
                  {member.user.runescapeName}
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
      cell: (member) => <RoleBadge role={member.role} />,
    },
    {
      key: "joined",
      header: "Joined",
      sortKey: "joined",
      firstDir: "desc",
      hideOnMobile: true,
      cell: (member) => formatDate(member.joinedAt),
    },
    {
      key: "submissions",
      header: "Submissions",
      sortKey: "submissions",
      firstDir: "desc",
      hideOnMobile: true,
      cell: (member) => member.submissionCount,
    },
  ]

  return (
    <div className="space-y-2">
      <h2 className="sr-only">Members</h2>
      <AdminDataTable
        idPrefix="members"
        caption={`Members of ${clanName}`}
        noun="members"
        columns={columns}
        rows={data.rows}
        getRowKey={(member) => member.userId}
        rowActions={(member) => (
          <MembershipActions
            scope="clan"
            parentId={clanId}
            parentName={clanName}
            member={{
              userId: member.userId,
              label: userLabel(member.user),
              confirmText: userConfirmText(member.user),
              role: member.role,
            }}
            isLastAdmin={isLastAdmin(member.role, data.adminCount)}
            lockedReason={
              member.isOwner
                ? "Owner. Transfer ownership via Edit clan first."
                : undefined
            }
          />
        )}
        basePath={basePath}
        state={{
          tab: "members",
          ...toHrefState(params, CLAN_MEMBER_LIST_CONFIG),
        }}
        sort={{ key: params.sort, dir: params.dir }}
        page={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchLabel="Search members"
        searchPlaceholder="Search by name, email or RuneScape name"
      />
    </div>
  )
}

async function EventsTab({
  clanId,
  basePath,
  raw,
}: {
  clanId: string
  basePath: string
  raw: RawSearchParams
}) {
  const params = parseListParams(raw, EVENT_LIST_CONFIG)
  const data = await listEvents(params, { clanId })
  return (
    <div className="space-y-2">
      <h2 className="sr-only">Events</h2>
      <EventsTable
        data={data}
        params={params}
        basePath={basePath}
        extraState={{ tab: "events" }}
        showClan={false}
        idPrefix="clan-events"
      />
    </div>
  )
}
